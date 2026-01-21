use crate::attribute::Attribute;
use crate::models::club::Club;
use crate::models::player::Player;
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const DEFAULT_RATING: f32 = 30.0;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Possession {
    Home,
    Away,
}

impl Possession {
    fn opponent(self) -> Self {
        match self {
            Self::Home => Self::Away,
            Self::Away => Self::Home,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum BallZone {
    DefensiveBox,
    LeftDefBox,
    RightDefBox,
    DefMidLeft,
    DefMidRight,
    DefMidCenter,
    MidfieldRight,
    MidfieldCenter,
    MidfieldLeft,
    OffensiveMidLeft,
    OffensiveMidRight,
    OffensiveMidCenter,
    OffensiveBoxLeft,
    OffensiveBoxRight,
    OffensiveBox,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ZoneLine {
    DefensiveBox,
    DefensiveMid,
    Midfield,
    OffensiveMid,
    OffensiveBox,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ZoneSide {
    Left,
    Center,
    Right,
}

impl BallZone {
    fn line(self) -> ZoneLine {
        match self {
            BallZone::DefensiveBox | BallZone::LeftDefBox | BallZone::RightDefBox => {
                ZoneLine::DefensiveBox
            }
            BallZone::DefMidLeft | BallZone::DefMidCenter | BallZone::DefMidRight => {
                ZoneLine::DefensiveMid
            }
            BallZone::MidfieldLeft | BallZone::MidfieldCenter | BallZone::MidfieldRight => {
                ZoneLine::Midfield
            }
            BallZone::OffensiveMidLeft
            | BallZone::OffensiveMidCenter
            | BallZone::OffensiveMidRight => ZoneLine::OffensiveMid,
            BallZone::OffensiveBoxLeft | BallZone::OffensiveBox | BallZone::OffensiveBoxRight => {
                ZoneLine::OffensiveBox
            }
        }
    }

    fn side(self) -> ZoneSide {
        match self {
            BallZone::LeftDefBox
            | BallZone::DefMidLeft
            | BallZone::MidfieldLeft
            | BallZone::OffensiveMidLeft
            | BallZone::OffensiveBoxLeft => ZoneSide::Left,
            BallZone::RightDefBox
            | BallZone::DefMidRight
            | BallZone::MidfieldRight
            | BallZone::OffensiveMidRight
            | BallZone::OffensiveBoxRight => ZoneSide::Right,
            BallZone::DefensiveBox
            | BallZone::DefMidCenter
            | BallZone::MidfieldCenter
            | BallZone::OffensiveMidCenter
            | BallZone::OffensiveBox => ZoneSide::Center,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ShotOutcome {
    Goal,
    Saved,
    Missed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MatchEventKind {
    Kickoff,
    Chance,
    Shot { outcome: ShotOutcome },
    HalfTime,
    FullTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MatchEvent {
    pub minute: u8,
    pub team: Option<Possession>,
    pub kind: MatchEventKind,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MatchOutcome {
    pub match_id: Uuid,
    pub home_score: u8,
    pub away_score: u8,
    pub events: Vec<MatchEvent>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct MatchConfig {
    pub seed: u64,
    pub duration_minutes: u8,
    pub half_time_minute: u8,
    pub match_id: Uuid,
}

impl MatchConfig {
    pub fn new(seed: u64) -> Self {
        Self {
            seed,
            duration_minutes: 90,
            half_time_minute: 45,
            match_id: Uuid::from_u128(seed as u128),
        }
    }

    pub fn with_match_id(mut self, match_id: Uuid) -> Self {
        self.match_id = match_id;
        self
    }
}

#[derive(Debug)]
pub struct MatchEngine {
    rng: StdRng,
    config: MatchConfig,
}

impl MatchEngine {
    pub fn new(config: MatchConfig) -> Self {
        Self {
            rng: StdRng::seed_from_u64(config.seed),
            config,
        }
    }

    pub fn simulate(&mut self, home: &Club, away: &Club) -> MatchOutcome {
        let home_ratings = TeamRatings::from_club(home);
        let away_ratings = TeamRatings::from_club(away);
        let mut state = MatchSimulationState::new(home_ratings, away_ratings);
        let mut events = Vec::new();

        events.push(MatchEvent::kickoff(home, away));

        for minute in 1..=self.config.duration_minutes {
            if minute == self.config.half_time_minute {
                events.push(MatchEvent::half_time(minute, home, away, &state));
            }

            state.apply_fatigue();

            if let Some(event) = self.step_minute(minute, home, away, &mut state) {
                events.push(event);
            }
        }

        events.push(MatchEvent::full_time(
            self.config.duration_minutes,
            home,
            away,
            &state,
        ));

        MatchOutcome {
            match_id: self.config.match_id,
            home_score: state.home_score,
            away_score: state.away_score,
            events,
        }
    }

    fn step_minute(
        &mut self,
        minute: u8,
        home: &Club,
        away: &Club,
        state: &mut MatchSimulationState,
    ) -> Option<MatchEvent> {
        let possession = state.possession;
        let (attacking_team, defending_team) = match possession {
            Possession::Home => (home, away),
            Possession::Away => (away, home),
        };

        let (attacking_ratings, defending_ratings) = match possession {
            Possession::Home => (state.home_ratings, state.away_ratings),
            Possession::Away => (state.away_ratings, state.home_ratings),
        };

        let attack_factor = state.team_state(possession).condition_factor();
        let defense_factor = state.team_state(possession.opponent()).condition_factor();

        let attack = attacking_ratings.attack * attack_factor;
        let build_up = attacking_ratings.build_up * attack_factor;
        let defense = defending_ratings.defense * defense_factor;
        let goalkeeping = defending_ratings.goalkeeping * defense_factor;

        let line = state.zone.line();
        let (shot_probability, shot_quality) = match line {
            ZoneLine::OffensiveBox => (probability(0.32 + (attack - defense) / 220.0), 1.0),
            ZoneLine::OffensiveMid => (probability(0.08 + (attack - defense) / 320.0), 0.75),
            _ => (0.0, 1.0),
        };

        let mut progress = probability(0.32 + (build_up - defense) / 230.0);
        let turnover = probability(0.18 + (defense - build_up) / 240.0);
        let lateral = probability(0.2 + (build_up - defense) / 300.0);
        let mut retreat = probability(0.1 + (defense - build_up) / 280.0);

        if line == ZoneLine::DefensiveBox {
            retreat = 0.0;
        }

        if line == ZoneLine::OffensiveBox {
            progress *= 0.6;
        }

        let mut weights = [shot_probability, turnover, progress, lateral, retreat];
        normalize_weights(&mut weights);

        let roll = self.rng.gen_range(0.0..1.0);
        let mut cursor = 0.0;

        cursor += weights[0];
        if roll < cursor {
            let shot_attack = attack * shot_quality;
            return Some(self.resolve_shot(
                minute,
                possession,
                attacking_team,
                defending_team,
                shot_attack,
                defense,
                goalkeeping,
                state,
            ));
        }

        cursor += weights[1];
        if roll < cursor {
            state.switch_possession();
            return None;
        }

        cursor += weights[2];
        if roll < cursor {
            let previous_line = state.zone.line();
            state.zone = self.advance_zone(state.zone);
            if previous_line != ZoneLine::OffensiveBox && state.zone.line() == ZoneLine::OffensiveBox {
                return Some(MatchEvent::chance(minute, possession, attacking_team));
            }
            return None;
        }

        cursor += weights[3];
        if roll < cursor {
            state.zone = self.lateral_zone(state.zone);
            return None;
        }

        cursor += weights[4];
        if roll < cursor {
            state.zone = self.retreat_zone(state.zone);
        }

        None
    }

    fn resolve_shot(
        &mut self,
        minute: u8,
        possession: Possession,
        attacking_team: &Club,
        defending_team: &Club,
        attack: f32,
        defense: f32,
        goalkeeping: f32,
        state: &mut MatchSimulationState,
    ) -> MatchEvent {
        let on_target = probability(0.3 + (attack - defense) / 200.0);
        let roll = self.rng.gen_range(0.0..1.0);
        let outcome = if roll < on_target {
            let goal_probability = probability(0.08 + (attack - goalkeeping) / 220.0);
            let goal_roll = self.rng.gen_range(0.0..1.0);
            if goal_roll < goal_probability {
                state.score_goal(possession);
                state.reset_after_goal(possession);
                ShotOutcome::Goal
            } else {
                state.reset_after_save(possession);
                ShotOutcome::Saved
            }
        } else {
            state.reset_after_save(possession);
            ShotOutcome::Missed
        };

        MatchEvent::shot(minute, possession, attacking_team, defending_team, outcome)
    }

    fn advance_zone(&mut self, zone: BallZone) -> BallZone {
        match zone {
            BallZone::DefensiveBox => BallZone::DefMidCenter,
            BallZone::LeftDefBox => BallZone::DefMidLeft,
            BallZone::RightDefBox => BallZone::DefMidRight,
            BallZone::DefMidLeft => BallZone::MidfieldLeft,
            BallZone::DefMidCenter => BallZone::MidfieldCenter,
            BallZone::DefMidRight => BallZone::MidfieldRight,
            BallZone::MidfieldLeft => BallZone::OffensiveMidLeft,
            BallZone::MidfieldCenter => BallZone::OffensiveMidCenter,
            BallZone::MidfieldRight => BallZone::OffensiveMidRight,
            BallZone::OffensiveMidLeft => BallZone::OffensiveBoxLeft,
            BallZone::OffensiveMidCenter => BallZone::OffensiveBox,
            BallZone::OffensiveMidRight => BallZone::OffensiveBoxRight,
            BallZone::OffensiveBoxLeft | BallZone::OffensiveBox | BallZone::OffensiveBoxRight => {
                zone
            }
        }
    }

    fn lateral_zone(&mut self, zone: BallZone) -> BallZone {
        let line = zone.line();
        let side = zone.side();
        match (line, side) {
            (ZoneLine::DefensiveBox, ZoneSide::Left) => BallZone::DefensiveBox,
            (ZoneLine::DefensiveBox, ZoneSide::Right) => BallZone::DefensiveBox,
            (ZoneLine::DefensiveBox, ZoneSide::Center) => {
                if self.rng.gen_range(0.0..1.0) < 0.5 {
                    BallZone::LeftDefBox
                } else {
                    BallZone::RightDefBox
                }
            }
            (ZoneLine::DefensiveMid, ZoneSide::Left) => BallZone::DefMidCenter,
            (ZoneLine::DefensiveMid, ZoneSide::Right) => BallZone::DefMidCenter,
            (ZoneLine::DefensiveMid, ZoneSide::Center) => {
                if self.rng.gen_range(0.0..1.0) < 0.5 {
                    BallZone::DefMidLeft
                } else {
                    BallZone::DefMidRight
                }
            }
            (ZoneLine::Midfield, ZoneSide::Left) => BallZone::MidfieldCenter,
            (ZoneLine::Midfield, ZoneSide::Right) => BallZone::MidfieldCenter,
            (ZoneLine::Midfield, ZoneSide::Center) => {
                if self.rng.gen_range(0.0..1.0) < 0.5 {
                    BallZone::MidfieldLeft
                } else {
                    BallZone::MidfieldRight
                }
            }
            (ZoneLine::OffensiveMid, ZoneSide::Left) => BallZone::OffensiveMidCenter,
            (ZoneLine::OffensiveMid, ZoneSide::Right) => BallZone::OffensiveMidCenter,
            (ZoneLine::OffensiveMid, ZoneSide::Center) => {
                if self.rng.gen_range(0.0..1.0) < 0.5 {
                    BallZone::OffensiveMidLeft
                } else {
                    BallZone::OffensiveMidRight
                }
            }
            (ZoneLine::OffensiveBox, ZoneSide::Left) => BallZone::OffensiveBox,
            (ZoneLine::OffensiveBox, ZoneSide::Right) => BallZone::OffensiveBox,
            (ZoneLine::OffensiveBox, ZoneSide::Center) => {
                if self.rng.gen_range(0.0..1.0) < 0.5 {
                    BallZone::OffensiveBoxLeft
                } else {
                    BallZone::OffensiveBoxRight
                }
            }
        }
    }

    fn retreat_zone(&mut self, zone: BallZone) -> BallZone {
        match zone {
            BallZone::OffensiveBoxLeft => BallZone::OffensiveMidLeft,
            BallZone::OffensiveBox => BallZone::OffensiveMidCenter,
            BallZone::OffensiveBoxRight => BallZone::OffensiveMidRight,
            BallZone::OffensiveMidLeft => BallZone::MidfieldLeft,
            BallZone::OffensiveMidCenter => BallZone::MidfieldCenter,
            BallZone::OffensiveMidRight => BallZone::MidfieldRight,
            BallZone::MidfieldLeft => BallZone::DefMidLeft,
            BallZone::MidfieldCenter => BallZone::DefMidCenter,
            BallZone::MidfieldRight => BallZone::DefMidRight,
            BallZone::DefMidLeft => BallZone::LeftDefBox,
            BallZone::DefMidCenter => BallZone::DefensiveBox,
            BallZone::DefMidRight => BallZone::RightDefBox,
            BallZone::DefensiveBox | BallZone::LeftDefBox | BallZone::RightDefBox => zone,
        }
    }
}

#[derive(Clone, Copy)]
struct TeamRatings {
    attack: f32,
    build_up: f32,
    defense: f32,
    goalkeeping: f32,
    stamina: f32,
    energy: f32,
}

impl TeamRatings {
    fn from_club(club: &Club) -> Self {
        let players = &club.players;
        let morale = average(players, |player| {
            (player.form.value() as f32 + player.morale.value() as f32) * 0.5
        });
        let morale_factor = 0.85 + (morale / 100.0) * 0.3;

        let attack = average(players, |player| {
            let technical = &player.technical_attributes;
            let physical = &player.physical_attributes;
            average_attributes(&[
                technical.shooting,
                technical.dribbling,
                technical.technique,
                technical.heading,
                technical.long_shot,
                technical.ball_control,
                technical.first_touch,
                physical.acceleration,
                physical.agility,
            ])
        }) * morale_factor;

        let build_up = average(players, |player| {
            let technical = &player.technical_attributes;
            let mental = &player.mental_attributes;
            average_attributes(&[
                technical.passing,
                technical.long_passing,
                technical.technique,
                mental.decision,
                mental.team_work,
                mental.positioning,
            ])
        }) * morale_factor;

        let defense = average(players, |player| {
            let technical = &player.technical_attributes;
            let mental = &player.mental_attributes;
            let physical = &player.physical_attributes;
            average_attributes(&[
                technical.tackling,
                technical.marking,
                mental.interceptions,
                mental.positioning,
                physical.strength,
                physical.jumping,
            ])
        }) * morale_factor;

        let goalkeeping = average(players, |player| {
            let technical = &player.technical_attributes;
            let mental = &player.mental_attributes;
            let physical = &player.physical_attributes;
            average_attributes(&[
                technical.gk_reflexes,
                technical.gk_composure,
                technical.gk_penalty,
                technical.gk_free_kick,
                mental.gk_positioning,
                physical.gk_diving,
                physical.gk_jumping,
            ])
        });

        let stamina = average(players, |player| player.physical_attributes.stamina.value() as f32);
        let energy = average(players, |player| player.energy.value() as f32);

        Self {
            attack,
            build_up,
            defense,
            goalkeeping,
            stamina,
            energy,
        }
    }
}

#[derive(Clone, Copy)]
struct TeamMatchState {
    energy: f32,
}

impl TeamMatchState {
    fn new(ratings: TeamRatings) -> Self {
        Self {
            energy: ratings.energy,
        }
    }

    fn condition_factor(&self) -> f32 {
        (0.7 + (self.energy / 200.0)).clamp(0.5, 1.25)
    }

    fn apply_fatigue(&mut self, stamina: f32) {
        let drain = (0.8 + ((50.0 - stamina) / 100.0)).clamp(0.4, 1.6);
        self.energy = (self.energy - drain).clamp(5.0, 100.0);
    }
}

struct MatchSimulationState {
    possession: Possession,
    zone: BallZone,
    home_score: u8,
    away_score: u8,
    home: TeamMatchState,
    away: TeamMatchState,
    home_ratings: TeamRatings,
    away_ratings: TeamRatings,
}

impl MatchSimulationState {
    fn new(home_ratings: TeamRatings, away_ratings: TeamRatings) -> Self {
        Self {
            possession: Possession::Home,
            zone: BallZone::MidfieldCenter,
            home_score: 0,
            away_score: 0,
            home: TeamMatchState::new(home_ratings),
            away: TeamMatchState::new(away_ratings),
            home_ratings,
            away_ratings,
        }
    }

    fn apply_fatigue(&mut self) {
        self.home.apply_fatigue(self.home_ratings.stamina);
        self.away.apply_fatigue(self.away_ratings.stamina);
    }

    fn team_state(&self, possession: Possession) -> &TeamMatchState {
        match possession {
            Possession::Home => &self.home,
            Possession::Away => &self.away,
        }
    }

    fn switch_possession(&mut self) {
        self.possession = self.possession.opponent();
        self.zone = BallZone::DefMidCenter;
    }

    fn reset_after_goal(&mut self, scoring_team: Possession) {
        self.possession = scoring_team.opponent();
        self.zone = BallZone::MidfieldCenter;
    }

    fn reset_after_save(&mut self, shooting_team: Possession) {
        self.possession = shooting_team.opponent();
        self.zone = BallZone::DefensiveBox;
    }

    fn score_goal(&mut self, scoring_team: Possession) {
        match scoring_team {
            Possession::Home => self.home_score = self.home_score.saturating_add(1),
            Possession::Away => self.away_score = self.away_score.saturating_add(1),
        }
    }
}

impl MatchEvent {
    fn kickoff(home: &Club, away: &Club) -> Self {
        Self {
            minute: 0,
            team: None,
            kind: MatchEventKind::Kickoff,
            description: format!("Kickoff: {} vs {}.", home.name, away.name),
        }
    }

    fn chance(minute: u8, team: Possession, club: &Club) -> Self {
        Self {
            minute,
            team: Some(team),
            kind: MatchEventKind::Chance,
            description: format!("{} carve out a chance.", club.name),
        }
    }

    fn shot(
        minute: u8,
        team: Possession,
        attacking: &Club,
        defending: &Club,
        outcome: ShotOutcome,
    ) -> Self {
        let description = match outcome {
            ShotOutcome::Goal => format!("Goal for {}!", attacking.name),
            ShotOutcome::Saved => format!("{}'s shot is saved by {}.", attacking.name, defending.name),
            ShotOutcome::Missed => format!("{} miss the target.", attacking.name),
        };

        Self {
            minute,
            team: Some(team),
            kind: MatchEventKind::Shot { outcome },
            description,
        }
    }

    fn half_time(minute: u8, home: &Club, away: &Club, state: &MatchSimulationState) -> Self {
        Self {
            minute,
            team: None,
            kind: MatchEventKind::HalfTime,
            description: format!(
                "Half time: {} {}-{} {}.",
                home.name, state.home_score, state.away_score, away.name
            ),
        }
    }

    fn full_time(minute: u8, home: &Club, away: &Club, state: &MatchSimulationState) -> Self {
        Self {
            minute,
            team: None,
            kind: MatchEventKind::FullTime,
            description: format!(
                "Full time: {} {}-{} {}.",
                home.name, state.home_score, state.away_score, away.name
            ),
        }
    }
}

fn average(players: &[Player], measure: impl Fn(&Player) -> f32) -> f32 {
    if players.is_empty() {
        return DEFAULT_RATING;
    }

    let total: f32 = players.iter().map(measure).sum();
    total / players.len() as f32
}

fn average_attributes(attributes: &[Attribute]) -> f32 {
    if attributes.is_empty() {
        return DEFAULT_RATING;
    }

    let total: u32 = attributes.iter().map(|attr| attr.value() as u32).sum();
    total as f32 / attributes.len() as f32
}

fn probability(value: f32) -> f32 {
    value.clamp(0.02, 0.9)
}

fn normalize_weights(weights: &mut [f32]) {
    let total: f32 = weights.iter().sum();
    if total <= f32::EPSILON {
        let fallback = 1.0 / weights.len().max(1) as f32;
        for weight in weights.iter_mut() {
            *weight = fallback;
        }
        return;
    }

    for weight in weights.iter_mut() {
        *weight = *weight / total;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn test_player(seed: u128) -> Player {
        let mut player = Player::default();
        player.id = Uuid::from_u128(seed);
        player.name = format!("Player {}", seed);
        player.short_name = format!("P{}", seed % 100);
        player
    }

    fn test_club(name: &str, seed: u128) -> Club {
        let players = (0..18).map(|i| test_player(seed + i as u128 + 1)).collect();
        Club {
            id: Uuid::from_u128(seed),
            name: name.to_string(),
            short_name: name.chars().take(3).collect(),
            date_of_foundation: Some(NaiveDate::from_ymd_opt(1900, 1, 1).unwrap()),
            nationality: "Test".to_string(),
            stadium: None,
            manager: None,
            players,
        }
    }

    #[test]
    fn simulation_is_deterministic() {
        let home = test_club("Home FC", 1);
        let away = test_club("Away United", 2);
        let config = MatchConfig::new(42);

        let outcome_one = MatchEngine::new(config).simulate(&home, &away);
        let outcome_two = MatchEngine::new(config).simulate(&home, &away);

        assert_eq!(outcome_one, outcome_two);
    }

    #[test]
    fn simulation_emits_full_time_event() {
        let home = test_club("Home FC", 10);
        let away = test_club("Away United", 20);
        let config = MatchConfig::new(7);
        let outcome = MatchEngine::new(config).simulate(&home, &away);

        let last_event = outcome.events.last().expect("events should exist");
        assert_eq!(last_event.kind, MatchEventKind::FullTime);
    }
}
