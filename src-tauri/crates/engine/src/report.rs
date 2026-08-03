use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::event::{EventType, MatchEvent};
use crate::types::{Side, Zone};

// ---------------------------------------------------------------------------
// TeamStats — aggregate stats for one side
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TeamStats {
    pub goals: u8,
    pub shots: u16,
    pub shots_on_target: u16,
    pub shots_off_target: u16,
    pub shots_blocked: u16,
    pub passes_completed: u16,
    pub passes_intercepted: u16,
    pub tackles: u16,
    pub interceptions: u16,
    pub fouls: u16,
    pub corners: u16,
    pub free_kicks: u16,
    pub penalties: u16,
    pub yellow_cards: u8,
    pub red_cards: u8,
    pub possession_ticks: u32,
}

impl TeamStats {
    pub fn pass_accuracy(&self) -> f64 {
        let total = self.passes_completed as f64 + self.passes_intercepted as f64;
        if total == 0.0 {
            return 0.0;
        }
        self.passes_completed as f64 / total * 100.0
    }
}

// ---------------------------------------------------------------------------
// PlayerMatchStats — individual player performance
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlayerMatchStats {
    pub minutes_played: u8,
    pub goals: u8,
    pub assists: u8,
    pub shots: u8,
    pub shots_on_target: u8,
    pub passes_completed: u8,
    pub passes_attempted: u8,
    pub tackles_won: u8,
    pub interceptions: u8,
    pub fouls_committed: u8,
    pub yellow_cards: u8,
    pub red_cards: u8,
    /// Match rating 0.0–10.0, computed after the match.
    pub rating: f32,
}


// ---------------------------------------------------------------------------
// Match ratings
// ---------------------------------------------------------------------------

/// A player who did nothing notable rates here.
const BASE_RATING: f32 = 6.0;

impl MatchReport {
    /// Score every player's performance out of ten.
    ///
    /// `PlayerMatchStats::rating` was never assigned anywhere in the engine. It
    /// stayed at zero for every player in every save, which meant `avg_rating`
    /// was permanently zero and the morale rule keyed on it — "a rating below
    /// 5.5 costs morale" — fired after every appearance by everyone, while its
    /// reward branch was unreachable. The only real ratings in the product were
    /// computed in the frontend and never reached the backend.
    ///
    /// Contributions are scaled by minutes played, so a substitute who came on
    /// for ten minutes is judged on ten minutes rather than being dragged to
    /// the base by a full match's worth of expectations.
    pub fn assign_ratings(&mut self, home_player_ids: &[&str], away_player_ids: &[&str]) {
        let home_result = match self.home_goals.cmp(&self.away_goals) {
            std::cmp::Ordering::Greater => 0.3,
            std::cmp::Ordering::Less => -0.3,
            std::cmp::Ordering::Equal => 0.0,
        };

        // Borrowed and hashed rather than cloned and scanned: this runs for
        // every player of every match the league simulates.
        let home: std::collections::HashSet<&str> = home_player_ids.iter().copied().collect();
        let away: std::collections::HashSet<&str> = away_player_ids.iter().copied().collect();

        for (id, stats) in self.player_stats.iter_mut() {
            let result_bonus = if home.contains(id.as_str()) {
                home_result
            } else if away.contains(id.as_str()) {
                -home_result
            } else {
                // Neither side claims him — nothing to reward or punish.
                0.0
            };
            stats.rating = rate(stats, result_bonus);
        }
    }
}

/// Turn one player's match into a mark out of ten.
///
/// Deliberately built from rates rather than raw totals: the possession chain
/// produces far more passes and duels than the old model, and a rating keyed on
/// totals would drift every time event volume changed.
fn rate(stats: &PlayerMatchStats, result_bonus: f32) -> f32 {
    if stats.minutes_played == 0 {
        return 0.0;
    }
    // A full match is the yardstick; a short appearance is judged on its own
    // length rather than against ninety minutes of expectations.
    let share = (stats.minutes_played as f32 / 90.0).clamp(0.15, 1.2);

    let mut score = 0.0f32;

    // Decisive contributions, which are not scaled — a goal is a goal whether
    // it came in the first minute or the last.
    score += stats.goals as f32 * 1.0;
    score += stats.assists as f32 * 0.7;

    // Attacking work.
    score += stats.shots_on_target as f32 * 0.12;
    score += (stats.shots.saturating_sub(stats.shots_on_target)) as f32 * -0.04;

    // Defensive work.
    score += stats.tackles_won as f32 * 0.05;
    score += stats.interceptions as f32 * 0.05;

    // Passing is judged on accuracy against a competent baseline, weighted by
    // how much of it the player actually did. Volume alone is not merit.
    if stats.passes_attempted > 0 {
        let accuracy = stats.passes_completed as f32 / stats.passes_attempted as f32;
        let involvement = (stats.passes_attempted as f32 / (18.0 * share)).clamp(0.0, 2.0);
        score += (accuracy - 0.78) * 3.0 * involvement;
    }

    // Discipline.
    score -= stats.fouls_committed as f32 * 0.06;
    score -= stats.yellow_cards as f32 * 0.35;
    score -= stats.red_cards as f32 * 1.5;

    (BASE_RATING + score * share.min(1.0) + result_bonus * share).clamp(1.0, 10.0)
}

// ---------------------------------------------------------------------------
// GoalSource — how a goal was created (distinct from event.rs GoalContext which tracks narrative)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GoalSource {
    OpenPlay,
    Corner,
    FreeKick,
    Penalty,
}

// ---------------------------------------------------------------------------
// GoalDetail — enriched goal info for the report
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalDetail {
    pub minute: u8,
    pub scorer_id: String,
    pub assist_id: Option<String>,
    pub goal_source: GoalSource,
    pub side: Side,
}

// ---------------------------------------------------------------------------
// MatchReport — the complete output of a simulated match
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchReport {
    pub home_goals: u8,
    pub away_goals: u8,
    pub home_stats: TeamStats,
    pub away_stats: TeamStats,
    pub events: Vec<MatchEvent>,
    pub goals: Vec<GoalDetail>,
    pub player_stats: HashMap<String, PlayerMatchStats>,
    /// Possession percentage for the home team (0–100).
    pub home_possession: f64,
    /// Total simulated minutes (90 + stoppage).
    pub total_minutes: u8,
    /// Penalty-shootout score when the match went to one; `None` otherwise.
    /// Shootout kicks are never counted in `home_goals`/`away_goals`.
    #[serde(default)]
    pub home_penalties: Option<u8>,
    #[serde(default)]
    pub away_penalties: Option<u8>,
}

impl MatchReport {
    /// Build the report from the raw event log and possession counters.
    pub fn from_events(
        events: Vec<MatchEvent>,
        home_possession_ticks: u32,
        away_possession_ticks: u32,
        total_minutes: u8,
    ) -> Self {
        Self::from_events_with_players(
            events,
            home_possession_ticks,
            away_possession_ticks,
            total_minutes,
            Vec::new(),
        )
    }

    /// Build the report while also assigning minutes played for tracked players.
    pub fn from_events_with_players(
        events: Vec<MatchEvent>,
        home_possession_ticks: u32,
        away_possession_ticks: u32,
        total_minutes: u8,
        tracked_player_ids: Vec<String>,
    ) -> Self {
        let mut home_stats = TeamStats::default();
        let mut away_stats = TeamStats::default();
        let mut goals = Vec::new();
        let mut player_stats: HashMap<String, PlayerMatchStats> = HashMap::new();

        home_stats.possession_ticks = home_possession_ticks;
        away_stats.possession_ticks = away_possession_ticks;

        // State machine to determine goal source from preceding set-piece event.
        // Tracks (event_type, side) so a set piece earned by one team doesn't
        // accidentally attribute a goal scored by the other.
        let mut last_set_piece: Option<(EventType, Side)> = None;

        for event in &events {
            let stats = match event.side {
                Side::Home => &mut home_stats,
                Side::Away => &mut away_stats,
            };

            // Track set-piece window: reset on events that clear the opportunity
            match &event.event_type {
                EventType::Corner => last_set_piece = Some((EventType::Corner, event.side)),
                EventType::FreeKick => {
                    // Only dangerous free kicks count: the taking side must be in their attacking
                    // third (opponent's defensive third). A free kick in HomeDefense is only
                    // dangerous when Away is taking it, and vice-versa.
                    let dangerous_zone = match event.side {
                        Side::Home => Zone::AwayDefense,
                        Side::Away => Zone::HomeDefense,
                    };
                    if event.zone == dangerous_zone {
                        last_set_piece = Some((EventType::FreeKick, event.side));
                    }
                }
                // Defensive events clear the set-piece window
                EventType::ShotOffTarget
                | EventType::ShotBlocked
                | EventType::ShotSaved
                | EventType::PenaltyMiss
                | EventType::Clearance
                | EventType::Interception
                | EventType::PassIntercepted
                | EventType::GoalKick => last_set_piece = None,
                _ => {}
            }

            // Update player stats helper
            let pid = event.player_id.as_deref().unwrap_or("");

            match &event.event_type {
                EventType::Goal => {
                    stats.goals += 1;
                    stats.shots += 1;
                    stats.shots_on_target += 1;
                    let source = match last_set_piece.take() {
                        Some((EventType::Corner, sp_side)) if sp_side == event.side => GoalSource::Corner,
                        Some((EventType::FreeKick, sp_side)) if sp_side == event.side => GoalSource::FreeKick,
                        _ => GoalSource::OpenPlay,
                    };
                    goals.push(GoalDetail {
                        minute: event.minute,
                        scorer_id: pid.to_string(),
                        assist_id: event.secondary_player_id.clone(),
                        goal_source: source,
                        side: event.side,
                    });
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.goals += 1;
                        ps.shots += 1;
                        ps.shots_on_target += 1;
                    }
                    if let Some(ref assist_id) = event.secondary_player_id {
                        let ps = player_stats.entry(assist_id.clone()).or_default();
                        ps.assists += 1;
                    }
                }
                EventType::PenaltyGoal => {
                    stats.goals += 1;
                    stats.shots += 1;
                    stats.shots_on_target += 1;
                    stats.penalties += 1;
                    last_set_piece = None;
                    goals.push(GoalDetail {
                        minute: event.minute,
                        scorer_id: pid.to_string(),
                        assist_id: None,
                        goal_source: GoalSource::Penalty,
                        side: event.side,
                    });
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.goals += 1;
                        ps.shots += 1;
                        ps.shots_on_target += 1;
                    }
                }
                EventType::PenaltyMiss => {
                    stats.shots += 1;
                    // A missed penalty is still a shot, so it has to land in one
                    // of the outcome buckets or `shots` stops equalling
                    // on-target + off-target + blocked. The engine resolves a
                    // penalty with a single conversion roll and does not yet
                    // distinguish "saved" from "wide", so it counts as off
                    // target; splitting the two needs a penalty outcome chain.
                    stats.shots_off_target += 1;
                    stats.penalties += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                    }
                }
                EventType::ShotSaved => {
                    stats.shots += 1;
                    stats.shots_on_target += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                        ps.shots_on_target += 1;
                    }
                }
                EventType::ShotOffTarget => {
                    stats.shots += 1;
                    stats.shots_off_target += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                    }
                }
                EventType::ShotBlocked => {
                    stats.shots += 1;
                    stats.shots_blocked += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.shots += 1;
                    }
                }
                EventType::PassCompleted => {
                    stats.passes_completed += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.passes_completed += 1;
                        ps.passes_attempted += 1;
                    }
                }
                EventType::PassIntercepted => {
                    stats.passes_intercepted += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.passes_attempted += 1;
                    }
                }
                EventType::Tackle => {
                    stats.tackles += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.tackles_won += 1;
                    }
                }
                EventType::Interception => {
                    stats.interceptions += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.interceptions += 1;
                    }
                }
                EventType::Foul => {
                    stats.fouls += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.fouls_committed += 1;
                    }
                }
                EventType::YellowCard | EventType::SecondYellow => {
                    stats.yellow_cards += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.yellow_cards += 1;
                    }
                }
                EventType::RedCard => {
                    stats.red_cards += 1;
                    if !pid.is_empty() {
                        let ps = player_stats.entry(pid.to_string()).or_default();
                        ps.red_cards += 1;
                    }
                }
                EventType::Corner => {
                    stats.corners += 1;
                }
                EventType::FreeKick => {
                    stats.free_kicks += 1;
                }
                EventType::PenaltyAwarded => {
                    stats.penalties += 1;
                }
                // Shootout kicks are intentionally excluded from goals,
                // GoalDetails, and player stats — the shootout is scored
                // separately via home_penalties/away_penalties.
                EventType::ShootoutGoal | EventType::ShootoutMiss => {}
                _ => {}
            }
        }

        populate_minutes_played(
            &events,
            total_minutes,
            &tracked_player_ids,
            &mut player_stats,
        );

        let total_poss = home_possession_ticks + away_possession_ticks;
        let home_possession = if total_poss > 0 {
            home_possession_ticks as f64 / total_poss as f64 * 100.0
        } else {
            50.0
        };

        Self {
            home_goals: home_stats.goals,
            away_goals: away_stats.goals,
            home_stats,
            away_stats,
            events,
            goals,
            player_stats,
            home_possession,
            total_minutes,
            home_penalties: None,
            away_penalties: None,
        }
    }
}

fn populate_minutes_played(
    events: &[MatchEvent],
    total_minutes: u8,
    tracked_player_ids: &[String],
    player_stats: &mut HashMap<String, PlayerMatchStats>,
) {
    let mut minutes_by_player: HashMap<String, u8> = tracked_player_ids
        .iter()
        .cloned()
        .map(|player_id| (player_id, total_minutes))
        .collect();

    for event in events {
        match event.event_type {
            EventType::Substitution => {
                if let Some(ref player_off_id) = event.secondary_player_id {
                    minutes_by_player
                        .insert(player_off_id.clone(), event.minute.min(total_minutes));
                }
                if let Some(ref player_on_id) = event.player_id {
                    minutes_by_player.insert(
                        player_on_id.clone(),
                        total_minutes.saturating_sub(event.minute),
                    );
                }
            }
            EventType::RedCard | EventType::SecondYellow => {
                if let Some(ref player_id) = event.player_id {
                    let dismissed_at = event.minute.min(total_minutes);
                    minutes_by_player
                        .entry(player_id.clone())
                        .and_modify(|minutes| *minutes = (*minutes).min(dismissed_at))
                        .or_insert(dismissed_at);
                }
            }
            _ => {}
        }
    }

    for (player_id, minutes_played) in minutes_by_player {
        player_stats.entry(player_id).or_default().minutes_played = minutes_played;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(minute: u8, event_type: EventType, side: Side, player: &str) -> MatchEvent {
        MatchEvent::new(minute, event_type, side, Zone::attacking_box(side)).with_player(player)
    }

    // Regression: shootout kicks used to be counted as match goals, inflating
    // the scoreline (1-1 won 4-3 on pens was reported as 5-4) and the
    // scorers' goal tallies.
    #[test]
    fn shootout_kicks_are_not_goals() {
        let events = vec![
            event(20, EventType::Goal, Side::Home, "h1"),
            event(55, EventType::PenaltyGoal, Side::Away, "a1"),
            // Shootout after extra time
            event(121, EventType::ShootoutGoal, Side::Home, "h1"),
            event(121, EventType::ShootoutGoal, Side::Away, "a2"),
            event(122, EventType::ShootoutGoal, Side::Home, "h2"),
            event(122, EventType::ShootoutMiss, Side::Away, "a3"),
        ];
        let report = MatchReport::from_events(events, 50, 50, 120);

        assert_eq!(report.home_goals, 1);
        assert_eq!(report.away_goals, 1);
        assert_eq!(report.goals.len(), 2, "GoalDetails must exclude shootout kicks");
        assert_eq!(report.player_stats["h1"].goals, 1);
        assert_eq!(report.player_stats["a1"].goals, 1);
        assert!(
            report.player_stats.get("h2").is_none_or(|p| p.goals == 0),
            "shootout-only kicker must not be credited a goal"
        );
        // In-match penalties still count.
        assert_eq!(report.goals[1].goal_source, GoalSource::Penalty);
    }
}

#[cfg(test)]
mod rating_tests {
    use super::*;

    fn stats(minutes: u8) -> PlayerMatchStats {
        PlayerMatchStats {
            minutes_played: minutes,
            ..Default::default()
        }
    }

    #[test]
    fn an_anonymous_full_match_rates_around_the_base() {
        let rating = rate(&stats(90), 0.0);
        assert!(
            (5.9..=6.1).contains(&rating),
            "expected a quiet game to rate near {BASE_RATING}, got {rating}"
        );
    }

    #[test]
    fn a_player_who_did_not_play_has_no_rating() {
        // Zero rather than a made-up mark: the morale rule keys on this, and an
        // unused substitute must not be judged as having played badly.
        assert_eq!(rate(&stats(0), 0.0), 0.0);
    }

    #[test]
    fn scoring_raises_the_mark() {
        let mut scorer = stats(90);
        scorer.goals = 2;
        assert!(rate(&scorer, 0.0) > rate(&stats(90), 0.0) + 1.5);
    }

    #[test]
    fn a_sending_off_ruins_it() {
        let mut sent_off = stats(60);
        sent_off.red_cards = 1;
        sent_off.fouls_committed = 3;
        assert!(rate(&sent_off, 0.0) < 5.0, "{}", rate(&sent_off, 0.0));
    }

    #[test]
    fn accurate_passing_beats_sloppy_passing() {
        let mut tidy = stats(90);
        tidy.passes_attempted = 60;
        tidy.passes_completed = 56;
        let mut wasteful = stats(90);
        wasteful.passes_attempted = 60;
        wasteful.passes_completed = 38;
        assert!(rate(&tidy, 0.0) > rate(&wasteful, 0.0));
    }

    #[test]
    fn a_short_appearance_stays_close_to_the_base() {
        // Ten minutes should not produce a nine or a three.
        let mut cameo = stats(10);
        cameo.passes_attempted = 4;
        cameo.passes_completed = 4;
        let rating = rate(&cameo, 0.3);
        assert!((5.0..=7.5).contains(&rating), "{rating}");
    }

    #[test]
    fn ratings_stay_inside_the_scale() {
        let mut heroic = stats(90);
        heroic.goals = 5;
        heroic.assists = 4;
        heroic.passes_attempted = 90;
        heroic.passes_completed = 90;
        let mut dreadful = stats(90);
        dreadful.red_cards = 1;
        dreadful.fouls_committed = 12;
        dreadful.yellow_cards = 2;
        dreadful.passes_attempted = 40;
        dreadful.passes_completed = 5;
        for rating in [rate(&heroic, 0.3), rate(&dreadful, -0.3)] {
            assert!((1.0..=10.0).contains(&rating), "{rating}");
        }
    }
}
