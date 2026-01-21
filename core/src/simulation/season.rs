use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

use crate::models::club::Club;
use crate::models::match_result::MatchResult;
use crate::models::schedule::{Fixture, Round, Schedule};
use crate::models::standings::StandingsTable;
use crate::simulation::engine::{MatchConfig, MatchEngine, MatchOutcome};
use crate::simulation::schedule::double_round_robin;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SeasonError {
    #[error("fixture {0} not found in schedule")]
    FixtureNotFound(Uuid),
    #[error("fixture {0} already has a result")]
    FixtureAlreadyPlayed(Uuid),
    #[error("fixture {0} does not match home/away clubs")]
    FixtureMismatch(Uuid),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonState {
    pub season_id: Uuid,
    pub schedule: Schedule,
    pub standings: StandingsTable,
    pub results: HashMap<Uuid, MatchResult>,
    pub current_round_index: usize,
}

impl SeasonState {
    pub fn new(season_id: Uuid, club_ids: &[Uuid]) -> Self {
        let schedule = double_round_robin(club_ids);
        let standings = StandingsTable::new(club_ids);
        let current_round_index = 0;

        Self {
            season_id,
            schedule,
            standings,
            results: HashMap::new(),
            current_round_index,
        }
    }

    pub fn current_round(&self) -> Option<&Round> {
        self.schedule.rounds.get(self.current_round_index)
    }

    pub fn round(&self, index: usize) -> Option<&Round> {
        self.schedule.rounds.get(index)
    }

    pub fn advance_round(&mut self) -> bool {
        if self.current_round_index + 1 >= self.schedule.rounds.len() {
            return false;
        }

        self.current_round_index += 1;
        true
    }

    pub fn record_result(&mut self, result: MatchResult) -> Result<(), SeasonError> {
        let fixture = self
            .fixture_by_id(result.fixture_id)
            .ok_or(SeasonError::FixtureNotFound(result.fixture_id))?;

        if fixture.home_club_id != result.home_club_id
            || fixture.away_club_id != result.away_club_id
        {
            return Err(SeasonError::FixtureMismatch(result.fixture_id));
        }

        if self.results.contains_key(&result.fixture_id) {
            return Err(SeasonError::FixtureAlreadyPlayed(result.fixture_id));
        }

        self.standings.record_result(&result);
        self.results.insert(result.fixture_id, result);
        Ok(())
    }

    pub fn simulate_fixture(
        &mut self,
        fixture_id: Uuid,
        home: &Club,
        away: &Club,
        config: MatchConfig,
    ) -> Result<MatchOutcome, SeasonError> {
        let fixture = self
            .fixture_by_id(fixture_id)
            .ok_or(SeasonError::FixtureNotFound(fixture_id))?;

        if fixture.home_club_id != home.id || fixture.away_club_id != away.id {
            return Err(SeasonError::FixtureMismatch(fixture_id));
        }

        if self.results.contains_key(&fixture_id) {
            return Err(SeasonError::FixtureAlreadyPlayed(fixture_id));
        }

        let mut engine = MatchEngine::new(config.with_match_id(fixture_id));
        let outcome = engine.simulate(home, away);
        let result = MatchResult {
            fixture_id,
            home_club_id: fixture.home_club_id,
            away_club_id: fixture.away_club_id,
            home_score: outcome.home_score,
            away_score: outcome.away_score,
        };

        self.record_result(result)?;
        Ok(outcome)
    }

    fn fixture_by_id(&self, fixture_id: Uuid) -> Option<&Fixture> {
        self.schedule
            .rounds
            .iter()
            .flat_map(|round| round.fixtures.iter())
            .find(|fixture| fixture.id == fixture_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::player::Player;

    fn club_id(seed: u128) -> Uuid {
        Uuid::from_u128(seed)
    }

    fn test_club(id: Uuid, name: &str) -> Club {
        let players = (0..18)
            .map(|index| {
                let mut player = Player::default();
                player.name = format!("{} Player {}", name, index + 1);
                player.short_name = format!("{}{}", name.chars().next().unwrap_or('P'), index + 1);
                player
            })
            .collect();

        Club {
            id,
            name: name.to_string(),
            short_name: name.chars().take(3).collect(),
            date_of_foundation: None,
            nationality: "Test".to_string(),
            stadium: None,
            manager: None,
            players,
        }
    }

    #[test]
    fn season_records_result_and_updates_standings() {
        let clubs = vec![club_id(1), club_id(2), club_id(3), club_id(4)];
        let mut season = SeasonState::new(Uuid::from_u128(1), &clubs);
        let fixture = season.schedule.rounds[0].fixtures[0].clone();

        let result = MatchResult {
            fixture_id: fixture.id,
            home_club_id: fixture.home_club_id,
            away_club_id: fixture.away_club_id,
            home_score: 3,
            away_score: 1,
        };

        season.record_result(result).expect("result recorded");
        let entry = season.standings.entry(fixture.home_club_id).expect("entry");

        assert_eq!(entry.points, 3);
        assert_eq!(entry.goals_for, 3);
        assert_eq!(entry.goals_against, 1);
    }

    #[test]
    fn season_rejects_duplicate_results() {
        let clubs = vec![club_id(1), club_id(2), club_id(3), club_id(4)];
        let mut season = SeasonState::new(Uuid::from_u128(2), &clubs);
        let fixture = season.schedule.rounds[0].fixtures[0].clone();

        let result = MatchResult {
            fixture_id: fixture.id,
            home_club_id: fixture.home_club_id,
            away_club_id: fixture.away_club_id,
            home_score: 1,
            away_score: 0,
        };

        season.record_result(result.clone()).expect("first result");
        let error = season.record_result(result).expect_err("should reject duplicate");

        assert_eq!(error, SeasonError::FixtureAlreadyPlayed(fixture.id));
    }

    #[test]
    fn season_simulates_fixture_and_records_result() {
        let clubs = vec![club_id(10), club_id(20), club_id(30), club_id(40)];
        let mut season = SeasonState::new(Uuid::from_u128(3), &clubs);
        let fixture = season.schedule.rounds[0].fixtures[0].clone();

        let home = test_club(fixture.home_club_id, "Home FC");
        let away = test_club(fixture.away_club_id, "Away FC");

        let outcome = season
            .simulate_fixture(fixture.id, &home, &away, MatchConfig::new(99))
            .expect("simulation should succeed");

        assert_eq!(outcome.match_id, fixture.id);
        assert!(season.results.contains_key(&fixture.id));
        assert_eq!(season.standings.entry(home.id).unwrap().played, 1);
        assert_eq!(season.standings.entry(away.id).unwrap().played, 1);
    }
}
