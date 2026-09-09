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
        // The bench counts, and a booked player who is substituted is *removed*
        // from the eleven and pushed onto it. Asking only whether he is still
        // on the pitch filed his card against the opposition the moment he came
        // off, so the away card count went up when no away player had been
        // booked at all.
        //
        // The home side is still the one tested: an id belonging to neither
        // squad cannot be booked, and treating an unknown id as away keeps this
        // total by construction.
        let is_home = |pid: &String| {
            self.home.players.iter().any(|p| p.id == *pid)
                || self.home_bench.iter().any(|p| p.id == *pid)
        };
        let mut home = HashMap::new();
        let mut away = HashMap::new();
        for (pid, count) in &self.yellows {
            if is_home(pid) {
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

    /// The whole match screen in one value.
    ///
    /// No longer part of the engine contract, and no longer on any production
    /// path — the game composes its own from [`MatchSnapshot::compose`], which
    /// works for any engine. Kept because the engine's own integration tests
    /// read it, and it goes through the same composer so it cannot drift.
    pub fn snapshot(&self) -> MatchSnapshot {
        MatchSnapshot::compose(
            self,
            SnapshotContext {
                allows_extra_time: self.allows_extra_time,
                home_team_name: self.home.name.clone(),
                away_team_name: self.away.name.clone(),
            },
        )
    }
}

/// What the caller knows about a fixture that the engine does not.
///
/// Small on purpose. Everything else in a [`MatchSnapshot`] comes from the
/// contract; this is the short list of things that are properties of the
/// *fixture* rather than of the match being simulated, so the engine has no way
/// to report them and must not invent them.
#[derive(Debug, Clone)]
pub struct SnapshotContext {
    /// Whether a level score at ninety minutes goes to extra time. A property
    /// of the competition, decided before anybody kicked off.
    pub allows_extra_time: bool,
    /// What to call each side when the engine reports no squad, and so no teams
    /// of its own.
    ///
    /// Supplied rather than defaulted because the alternative is the engine
    /// writing "Home" into a field the match screen renders — English prose in
    /// the one crate the game's eleven locales cannot reach.
    pub home_team_name: String,
    pub away_team_name: String,
}

impl MatchSnapshot {
    /// Build the game's match-screen view out of what the contract reports.
    ///
    /// Everything but `context` comes from [`crate::LiveState`], so this
    /// composes a snapshot for **any** engine rather than only for ours — which
    /// is the point of the split. An engine that manages no personnel reports
    /// no squad, and the squad half comes back empty: there genuinely are no
    /// substitutes to show, and empty says so where invented players would not.
    pub fn compose(state: &dyn crate::traits::LiveState, context: SnapshotContext) -> Self {
        let progress = state.progress();
        let share = progress.possession_share;
        let xg = progress.expected_goals;

        // Taken apart rather than borrowed and re-cloned field by field.
        // `squad()` already hands over an owned copy of both squads, both
        // benches and everything else, and this runs on every UI tick.
        let (
            home_team,
            away_team,
            home_bench,
            away_bench,
            home_subs_made,
            away_subs_made,
            max_subs,
            home_set_pieces,
            away_set_pieces,
            substitutions,
            home_yellows,
            away_yellows,
            sent_off,
        ) = match state.squad() {
            Some(squad) => (
                squad.home.team,
                squad.away.team,
                squad.home.bench,
                squad.away.bench,
                squad.home.subs_made,
                squad.away.subs_made,
                squad.max_subs,
                squad.home.set_pieces,
                squad.away.set_pieces,
                squad.substitutions,
                squad.home.yellows,
                squad.away.yellows,
                squad.sent_off,
            ),
            None => (
                empty_team(&context.home_team_name),
                empty_team(&context.away_team_name),
                Vec::new(),
                Vec::new(),
                0,
                0,
                0,
                Default::default(),
                Default::default(),
                Vec::new(),
                HashMap::new(),
                HashMap::new(),
                Default::default(),
            ),
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
            home_team,
            away_team,
            home_bench,
            away_bench,
            home_possession_pct: share.map(|s| s.home).unwrap_or(50.0),
            away_possession_pct: share.map(|s| s.away).unwrap_or(50.0),
            events: state.events().to_vec(),
            home_subs_made,
            away_subs_made,
            max_subs,
            home_set_pieces,
            away_set_pieces,
            substitutions,
            home_xg: xg.map(|x| x.home).unwrap_or(0.0),
            away_xg: xg.map(|x| x.away).unwrap_or(0.0),
            momentum: progress.momentum,
            allows_extra_time: context.allows_extra_time,
            home_yellows,
            away_yellows,
            sent_off,
            penalty_shootout: progress.shootout,
        }
    }
}

/// A side with nobody in it, for an engine that reports no squad.
fn empty_team(name: &str) -> crate::types::TeamData {
    crate::types::TeamData {
        id: String::new(),
        name: name.to_string(),
        formation: String::new(),
        play_style: crate::types::PlayStyle::Balanced,
        tactics: crate::types::TacticsConfig::default(),
        players: Vec::new(),
    }
}

#[cfg(test)]
mod booking_side_tests {
    use super::*;
    use crate::types::{
        MatchConfig, PlayStyle, PlayerData, PlayerRole, Position, Side, TacticsConfig, TeamData,
    };

    fn player(id: &str, position: Position) -> PlayerData {
        PlayerData {
            id: id.to_string(),
            name: id.to_string(),
            position,
            ovr: 70,
            condition: 90,
            fitness: 80,
            pace: 70,
            shooting: 70,
            passing: 70,
            tackling: 70,
            strength: 70,
            stamina: 70,
            agility: 70,
            dribbling: 70,
            defending: 70,
            positioning: 70,
            vision: 70,
            decisions: 70,
            composure: 70,
            aggression: 70,
            teamwork: 70,
            leadership: 70,
            handling: 70,
            reflexes: 70,
            aerial: 70,
            traits: vec![],
            slot: None,
            role: PlayerRole::Standard,
        }
    }

    fn eleven(prefix: &str) -> TeamData {
        let mut players = vec![player(&format!("{prefix}_gk"), Position::Goalkeeper)];
        for i in 0..10 {
            players.push(player(&format!("{prefix}_o{i}"), Position::Midfielder));
        }
        TeamData {
            id: prefix.to_string(),
            name: prefix.to_string(),
            formation: "4-4-2".to_string(),
            play_style: PlayStyle::Balanced,
            players,
            tactics: TacticsConfig::default(),
        }
    }

    /// Bookings are tallied in one map keyed by player id, and split by side by
    /// asking whether the player is in the home eleven. A substitution *removes*
    /// him from that eleven and pushes him to the bench, so from the moment a
    /// booked player came off, his card was reported against the opposition —
    /// the away card count went up when an away player had done nothing.
    #[test]
    fn a_booking_stays_with_the_side_that_earned_it_after_a_substitution() {
        let mut state = LiveMatchState::new(
            eleven("home"),
            eleven("away"),
            MatchConfig::default(),
            vec![player("home_sub", Position::Midfielder)],
            vec![player("away_sub", Position::Midfielder)],
            false,
        );

        state.yellows.insert("home_o1".to_string(), 1);
        let snap = state.squad();
        assert!(
            snap.home.yellows.contains_key("home_o1"),
            "a booked home player is a home booking while he is on the pitch"
        );

        state
            .do_substitution(Side::Home, "home_o1", "home_sub")
            .expect("a first substitution with a player on the bench is legal");

        let snap = state.squad();
        assert!(
            snap.home.yellows.contains_key("home_o1"),
            "the booking followed him off the pitch and was filed against the \
             other team"
        );
        assert!(
            !snap.away.yellows.contains_key("home_o1"),
            "a home player's card is never an away booking"
        );
    }
}
