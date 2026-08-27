use std::collections::HashMap;

use super::{LiveMatchState, MatchPhase, MatchSnapshot, PenaltyShootoutSnapshot};
use crate::view::{MatchProgress, SideSquad, SquadState};

// ---------------------------------------------------------------------------
// Snapshot generation — read-only view of match state for the UI
// ---------------------------------------------------------------------------

impl LiveMatchState {
    /// Where the match stands, in the shape the contract asks for.
    ///
    /// Everything here is something any engine has. What used to sit alongside
    /// it in `snapshot()` — squads, benches, bookings — now comes from
    /// [`LiveMatchState::squad`].
    pub fn progress(&self) -> MatchProgress {
        MatchProgress::new(
            self.phase,
            self.clock(),
            self.home_score,
            self.away_score,
            self.possession,
        )
        .with_possession_share(self.home_possession_pct(), 100.0 - self.home_possession_pct())
        .with_expected_goals(
            self.home_metrics.team_xg() as f32,
            self.away_metrics.team_xg() as f32,
        )
        .with_momentum(self.momentum.minutes().to_vec())
        .with_shootout(self.shootout_snapshot())
    }

    /// Who is on the pitch, who is on the bench, and what has happened to them.
    pub fn squad(&self) -> SquadState {
        let (home_team, away_team) = self.teams_with_live_condition();
        let (home_yellows, away_yellows) = self.yellows_by_side();

        SquadState {
            home: SideSquad {
                team: home_team,
                bench: self.home_bench.clone(),
                subs_made: self.home_subs_made,
                set_pieces: self.home_set_pieces.clone(),
                yellows: home_yellows,
            },
            away: SideSquad {
                team: away_team,
                bench: self.away_bench.clone(),
                subs_made: self.away_subs_made,
                set_pieces: self.away_set_pieces.clone(),
                yellows: away_yellows,
            },
            max_subs: self.max_subs,
            sent_off: self.sent_off.clone(),
            substitutions: self.substitutions.clone(),
        }
    }

    /// The home side's share of the ball, as a percentage.
    fn home_possession_pct(&self) -> f64 {
        let total = self.home_possession_ticks + self.away_possession_ticks;
        if total > 0 {
            self.home_possession_ticks as f64 / total as f64 * 100.0
        } else {
            50.0
        }
    }

    /// Bookings split by side. The engine tallies them in one map keyed by
    /// player id, because that is how a booking is looked up during play.
    fn yellows_by_side(&self) -> (HashMap<String, u8>, HashMap<String, u8>) {
        let mut home = HashMap::new();
        let mut away = HashMap::new();
        for (pid, count) in &self.yellows {
            if self.home.players.iter().any(|p| p.id == *pid) {
                home.insert(pid.clone(), *count);
            } else {
                away.insert(pid.clone(), *count);
            }
        }
        (home, away)
    }

    /// Both squads with each player's live stamina patched in, which the squad
    /// cache holds by index rather than on the player itself.
    fn teams_with_live_condition(&self) -> (crate::types::TeamData, crate::types::TeamData) {
        let mut home_team = self.home.clone();
        let mut away_team = self.away.clone();
        for (team, cache) in [
            (&mut home_team, &self.home_cache),
            (&mut away_team, &self.away_cache),
        ] {
            for (index, p) in team.players.iter_mut().enumerate() {
                p.condition = cache.condition(index).round() as u8;
            }
        }
        (home_team, away_team)
    }

    /// Shootout progress, once there is any to report.
    fn shootout_snapshot(&self) -> Option<PenaltyShootoutSnapshot> {
        let has_shootout_data =
            self.penalty_state.home_taken > 0 || self.penalty_state.away_taken > 0;
        if self.phase == MatchPhase::PenaltyShootout
            || (self.phase == MatchPhase::Finished && has_shootout_data)
        {
            Some(PenaltyShootoutSnapshot {
                home_taken: self.penalty_state.home_taken,
                away_taken: self.penalty_state.away_taken,
                home_scored: self.penalty_state.home_scored,
                away_scored: self.penalty_state.away_scored,
                sudden_death: self.penalty_state.sudden_death,
            })
        } else {
            None
        }
    }

    /// The whole match screen in one value, for the game's own use.
    ///
    /// No longer part of the engine contract. Kept because the engine's own
    /// tests read it and because it is still the IPC wire type.
    pub fn snapshot(&self) -> MatchSnapshot {
        MatchSnapshot::compose(self, self.allows_extra_time)
    }
}

impl MatchSnapshot {
    /// Build the game's match-screen view out of what the contract reports.
    ///
    /// Everything here comes from [`crate::LiveState`], so this composes a
    /// snapshot for **any** engine rather than only for ours — which is the
    /// point of the split. An engine that manages no personnel reports no
    /// squad, and the squad half comes back empty: there genuinely are no
    /// substitutes to show, and empty says so where invented names would not.
    pub fn compose(state: &dyn crate::traits::LiveState, allows_extra_time: bool) -> Self {
        let progress = state.progress();
        let squad = state.squad();

        let share = progress.possession_share;
        let xg = progress.expected_goals;

        let empty_team = |name: &str| crate::types::TeamData {
            id: String::new(),
            name: name.to_string(),
            formation: String::new(),
            play_style: crate::types::PlayStyle::Balanced,
            tactics: crate::types::TacticsConfig::default(),
            players: Vec::new(),
        };

        MatchSnapshot {
            phase: progress.phase,
            // From the state, never re-derived from the clock: a shootout's
            // period opens at minute 121 while the engine still reads 120.
            current_minute: state.minute(),
            clock: progress.clock,
            home_score: progress.home_score,
            away_score: progress.away_score,
            possession: progress.possession,
            home_team: squad
                .as_ref()
                .map(|s| s.home.team.clone())
                .unwrap_or_else(|| empty_team("Home")),
            away_team: squad
                .as_ref()
                .map(|s| s.away.team.clone())
                .unwrap_or_else(|| empty_team("Away")),
            home_bench: squad.as_ref().map(|s| s.home.bench.clone()).unwrap_or_default(),
            away_bench: squad.as_ref().map(|s| s.away.bench.clone()).unwrap_or_default(),
            home_possession_pct: share.map(|s| s.home).unwrap_or(50.0),
            away_possession_pct: share.map(|s| s.away).unwrap_or(50.0),
            events: state.events().to_vec(),
            home_subs_made: squad.as_ref().map(|s| s.home.subs_made).unwrap_or(0),
            away_subs_made: squad.as_ref().map(|s| s.away.subs_made).unwrap_or(0),
            max_subs: squad.as_ref().map(|s| s.max_subs).unwrap_or(0),
            home_set_pieces: squad
                .as_ref()
                .map(|s| s.home.set_pieces.clone())
                .unwrap_or_default(),
            away_set_pieces: squad
                .as_ref()
                .map(|s| s.away.set_pieces.clone())
                .unwrap_or_default(),
            substitutions: squad
                .as_ref()
                .map(|s| s.substitutions.clone())
                .unwrap_or_default(),
            home_xg: xg.map(|x| x.home).unwrap_or(0.0),
            away_xg: xg.map(|x| x.away).unwrap_or(0.0),
            momentum: progress.momentum,
            allows_extra_time,
            home_yellows: squad
                .as_ref()
                .map(|s| s.home.yellows.clone())
                .unwrap_or_default(),
            away_yellows: squad
                .as_ref()
                .map(|s| s.away.yellows.clone())
                .unwrap_or_default(),
            sent_off: squad.as_ref().map(|s| s.sent_off.clone()).unwrap_or_default(),
            penalty_shootout: progress.shootout,
        }
    }
}
