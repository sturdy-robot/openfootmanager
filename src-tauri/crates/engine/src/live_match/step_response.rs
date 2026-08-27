use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use serde::{Deserialize, Serialize};

use super::{LiveMatchState, MatchPhase, MatchSnapshot, MinuteResult, SetPieceTakers};
use crate::types::{PlayerData, Side, TeamData, Zone};

// ---------------------------------------------------------------------------
// The step response — what a simulated minute actually has to send
//
// `snapshot()` rebuilds the whole match: both squads and the entire event log.
// Across a 93-minute match that is 3.4 MB of JSON to describe a final state of
// 61 KB — half of it the same immutable attributes re-sent every minute to
// deliver one changed condition value, and half of it an event log re-sent
// whole every tick.
//
// The response below is a pure function of the state now, the baseline taken
// before these minutes ran, and the minutes themselves. Nothing here remembers
// what was last sent; the only memory is state the match already carries.
// ---------------------------------------------------------------------------

/// Where the client stood before these minutes were simulated.
///
/// Taken inside the same call that steps, so the response stays a function of
/// state rather than of a conversation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MatchStepBaseline {
    pub revision: u64,
    /// A fingerprint of everything [`MatchDelta`] does not carry.
    ///
    /// Derived rather than counted on purpose. A counter has to be bumped at
    /// every structural mutation, and the one that is forgotten produces a
    /// client quietly drawing a lineup the match no longer has. This cannot be
    /// forgotten: a new structural field is either in the fingerprint or it is
    /// not, and the whole-match test says which.
    pub structure: u64,
}

/// One player's condition, which is all that changes about them in a minute.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlayerCondition {
    pub player_id: String,
    pub condition: u8,
}

/// Everything that moves every minute, and nothing else.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MatchDelta {
    pub phase: MatchPhase,
    pub current_minute: u8,
    pub home_score: u8,
    pub away_score: u8,
    pub possession: Side,
    pub ball_zone: Zone,
    pub home_possession_pct: f64,
    pub away_possession_pct: f64,
    /// Every player on the pitch, every tick.
    ///
    /// A changed-only set would need a record of what was last sent, which is
    /// the memory this protocol exists without. Thirty pairs is under a
    /// kilobyte against the eighteen this replaces.
    pub conditions: Vec<PlayerCondition>,
}

/// The answer to "step the match", in place of a full snapshot per minute.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchStepResponse {
    pub base_revision: u64,
    pub revision: u64,
    /// Each simulated minute, carrying its own events. The client accumulates
    /// them; the response never re-sends the log.
    pub minutes: Vec<MinuteResult>,
    pub delta: MatchDelta,
    /// Present only when something the delta cannot describe has changed.
    ///
    /// It replaces the client's whole match, event log included — so the
    /// client must not also append this tick's minutes, or every event of the
    /// minute appears twice.
    pub snapshot: Option<MatchSnapshot>,
}

impl LiveMatchState {
    /// The client's standing, to be handed back to [`Self::step_response`].
    pub fn baseline(&self) -> MatchStepBaseline {
        MatchStepBaseline {
            revision: self.revision,
            structure: self.structure_fingerprint(),
        }
    }

    /// Assemble the response for the minutes just simulated.
    pub fn step_response(
        &self,
        base: MatchStepBaseline,
        minutes: Vec<MinuteResult>,
    ) -> MatchStepResponse {
        // An AI substitution is applied between minutes and appears in no
        // `MinuteResult` at all, so the minutes cannot be asked whether the
        // lineup moved. The match itself is asked instead.
        let structure_changed = self.structure_fingerprint() != base.structure;

        MatchStepResponse {
            base_revision: base.revision,
            revision: self.revision,
            minutes,
            delta: self.delta(),
            snapshot: structure_changed.then(|| self.snapshot()),
        }
    }

    fn delta(&self) -> MatchDelta {
        let (home_pct, away_pct) = self.possession_split();

        MatchDelta {
            phase: self.phase,
            current_minute: self.current_minute,
            home_score: self.home_score,
            away_score: self.away_score,
            possession: self.possession,
            ball_zone: self.ball_zone,
            home_possession_pct: home_pct,
            away_possession_pct: away_pct,
            conditions: self
                .home
                .players
                .iter()
                .chain(self.away.players.iter())
                .map(|player| PlayerCondition {
                    player_id: player.id.clone(),
                    condition: self.reported_condition(player),
                })
                .collect(),
        }
    }

    /// A fingerprint of every snapshot field the delta leaves out.
    fn structure_fingerprint(&self) -> u64 {
        let mut hasher = DefaultHasher::new();

        hash_team(&mut hasher, &self.home);
        hash_team(&mut hasher, &self.away);
        hash_bench(&mut hasher, &self.home_bench);
        hash_bench(&mut hasher, &self.away_bench);

        self.home_subs_made.hash(&mut hasher);
        self.away_subs_made.hash(&mut hasher);
        self.max_subs.hash(&mut hasher);
        self.substitutions.len().hash(&mut hasher);
        for record in &self.substitutions {
            record.minute.hash(&mut hasher);
            record.player_off_id.hash(&mut hasher);
            record.player_on_id.hash(&mut hasher);
        }

        // Sorted: a `HashMap` iterates in whatever order it likes, and a
        // fingerprint that changes without the match changing would send the
        // whole snapshot every tick.
        let mut yellows: Vec<(&String, &u8)> = self.yellows.iter().collect();
        yellows.sort_unstable();
        yellows.hash(&mut hasher);
        let mut sent_off: Vec<&String> = self.sent_off.iter().collect();
        sent_off.sort_unstable();
        sent_off.hash(&mut hasher);

        hash_set_pieces(&mut hasher, &self.home_set_pieces);
        hash_set_pieces(&mut hasher, &self.away_set_pieces);

        self.allows_extra_time.hash(&mut hasher);
        self.penalty_state.home_taken.hash(&mut hasher);
        self.penalty_state.away_taken.hash(&mut hasher);
        self.penalty_state.home_scored.hash(&mut hasher);
        self.penalty_state.away_scored.hash(&mut hasher);
        self.penalty_state.sudden_death.hash(&mut hasher);
        // The shootout snapshot appears and disappears with the phase, so the
        // phase is part of the structure even though the delta carries it too.
        self.phase.hash(&mut hasher);

        hasher.finish()
    }
}

fn hash_team(hasher: &mut DefaultHasher, team: &TeamData) {
    team.id.hash(hasher);
    team.formation.hash(hasher);
    // These derive `Hash` so this stays allocation-free: it runs once a minute
    // for both sides, and the whole point of the response is to stop doing
    // per-minute work proportional to the squad.
    team.play_style.hash(hasher);
    team.tactics.hash(hasher);
    for player in &team.players {
        player.id.hash(hasher);
        player.role.hash(hasher);
    }
}

fn hash_bench(hasher: &mut DefaultHasher, bench: &[PlayerData]) {
    for player in bench {
        player.id.hash(hasher);
    }
}

fn hash_set_pieces(hasher: &mut DefaultHasher, takers: &SetPieceTakers) {
    takers.captain.hash(hasher);
    takers.corner_taker.hash(hasher);
    takers.free_kick_taker.hash(hasher);
    takers.penalty_taker.hash(hasher);
}
