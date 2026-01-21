use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::match_result::MatchResult;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StandingEntry {
    pub club_id: Uuid,
    pub played: u16,
    pub wins: u16,
    pub draws: u16,
    pub losses: u16,
    pub goals_for: u16,
    pub goals_against: u16,
    pub points: u16,
}

impl StandingEntry {
    fn new(club_id: Uuid) -> Self {
        Self {
            club_id,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goals_for: 0,
            goals_against: 0,
            points: 0,
        }
    }

    pub fn goal_difference(&self) -> i16 {
        self.goals_for as i16 - self.goals_against as i16
    }

    fn record_match(&mut self, goals_for: u8, goals_against: u8) {
        self.played = self.played.saturating_add(1);
        self.goals_for = self.goals_for.saturating_add(goals_for as u16);
        self.goals_against = self.goals_against.saturating_add(goals_against as u16);

        if goals_for > goals_against {
            self.wins = self.wins.saturating_add(1);
            self.points = self.points.saturating_add(3);
        } else if goals_for == goals_against {
            self.draws = self.draws.saturating_add(1);
            self.points = self.points.saturating_add(1);
        } else {
            self.losses = self.losses.saturating_add(1);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StandingsTable {
    pub entries: Vec<StandingEntry>,
}

impl StandingsTable {
    pub fn new(club_ids: &[Uuid]) -> Self {
        let mut entries: Vec<StandingEntry> = club_ids.iter().copied().map(StandingEntry::new).collect();
        entries.sort_by(|a, b| a.club_id.cmp(&b.club_id));
        Self { entries }
    }

    pub fn record_result(&mut self, result: &MatchResult) {
        if let Some(entry) = self.entry_mut(result.home_club_id) {
            entry.record_match(result.home_score, result.away_score);
        }

        if let Some(entry) = self.entry_mut(result.away_club_id) {
            entry.record_match(result.away_score, result.home_score);
        }

        self.sort_entries();
    }

    pub fn entry(&self, club_id: Uuid) -> Option<&StandingEntry> {
        self.entries.iter().find(|entry| entry.club_id == club_id)
    }

    fn entry_mut(&mut self, club_id: Uuid) -> Option<&mut StandingEntry> {
        self.entries.iter_mut().find(|entry| entry.club_id == club_id)
    }

    fn sort_entries(&mut self) {
        self.entries.sort_by(|left, right| {
            right
                .points
                .cmp(&left.points)
                .then_with(|| right.goal_difference().cmp(&left.goal_difference()))
                .then_with(|| right.goals_for.cmp(&left.goals_for))
                .then_with(|| left.club_id.cmp(&right.club_id))
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn club_id(seed: u128) -> Uuid {
        Uuid::from_u128(seed)
    }

    #[test]
    fn standings_sort_by_points_and_goal_difference() {
        let clubs = vec![club_id(1), club_id(2), club_id(3), club_id(4)];
        let mut table = StandingsTable::new(&clubs);

        table.record_result(&MatchResult {
            fixture_id: Uuid::from_u128(10),
            home_club_id: club_id(1),
            away_club_id: club_id(2),
            home_score: 2,
            away_score: 0,
        });

        table.record_result(&MatchResult {
            fixture_id: Uuid::from_u128(11),
            home_club_id: club_id(3),
            away_club_id: club_id(4),
            home_score: 1,
            away_score: 1,
        });

        let top = &table.entries[0];
        assert_eq!(top.club_id, club_id(1));
        assert_eq!(top.points, 3);
    }
}
