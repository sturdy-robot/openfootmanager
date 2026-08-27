//! What a caller can see of a match in progress.
//!
//! There used to be one answer to that: `MatchSnapshot`, twenty-seven fields
//! wide, everything the match screen happens to render. It is a fine thing for
//! the game to receive and the wrong thing to demand from an engine. Two
//! squads, two benches, per-side yellow-card maps, set-piece takers, a
//! substitution log, shootout state and a whole-minute clock is not a contract;
//! it is our user interface, written down as a trait method. An engine that
//! models none of it still had to construct all of it.
//!
//! So the view splits along the only line that matters — **who owns the truth
//! after a command has been applied**:
//!
//! - [`MatchProgress`] is the match itself: the phase, the clock, the score,
//!   who has the ball. Every engine has these, so every engine reports them.
//! - [`SquadState`] is who is on the pitch, who is on the bench, who has been
//!   booked and how many changes are left. Only an engine that accepts
//!   substitutions has to answer, because only that engine changes it. It is
//!   optional and advertised, exactly like [`crate::spatial::SpatialTelemetry`].
//!
//! The pairing is checked: an engine that lists `Substitute` among the commands
//! it accepts must report a squad, and an engine reporting a squad it never
//! changes is claiming something nobody asked for. The reason it has to be an
//! engine question at all is that a substitution rewrites the incoming player's
//! position and slot, and a formation change redistributes the rest — so the
//! caller cannot mirror the squad without reimplementing the engine.
//!
//! `MatchSnapshot` still exists, and the game still receives it. It is no longer
//! handed over whole by the engine: [`crate::MatchSnapshot::compose`] builds it
//! from these two, from the rest of the contract, and from the short list of
//! fixture facts the caller supplies in [`crate::SnapshotContext`] — whether
//! the tie goes to extra time, and what the two clubs are called. It therefore
//! composes for any engine rather than only for ours.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::clock::MatchClock;
use crate::live_match::{
    MatchPhase, MinuteMomentum, PenaltyShootoutSnapshot, SetPieceTakers, SubstitutionRecord,
};
use crate::types::{PlayerData, Side, TeamData};

/// One of a thing per side.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PerSide<T> {
    pub home: T,
    pub away: T,
}

impl<T> PerSide<T> {
    pub fn new(home: T, away: T) -> Self {
        Self { home, away }
    }

    pub fn get(&self, side: Side) -> &T {
        match side {
            Side::Home => &self.home,
            Side::Away => &self.away,
        }
    }
}

/// Where the match stands. Every engine reports this.
///
/// Build it with [`MatchProgress::new`], which takes exactly the part every
/// engine must supply, and add the rest only if you model it. An engine that
/// does not track expected goals leaves it `None` rather than reporting zero,
/// because zero means "no chances", which is a different statement.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchProgress {
    pub phase: MatchPhase,
    pub clock: MatchClock,
    pub home_score: u8,
    pub away_score: u8,
    /// Who has the ball. At an interval, whoever had it last.
    pub possession: Side,
    /// Share of the ball so far, as percentages summing to 100.
    #[serde(default)]
    pub possession_share: Option<PerSide<f64>>,
    #[serde(default)]
    pub expected_goals: Option<PerSide<f32>>,
    /// Who was on top, period by period. Empty from an engine with no such
    /// notion, which is unambiguous — there is no "nobody was on top" reading.
    #[serde(default)]
    pub momentum: Vec<MinuteMomentum>,
    /// Present once a shootout is under way, and afterwards.
    #[serde(default)]
    pub shootout: Option<PenaltyShootoutSnapshot>,
}

impl MatchProgress {
    pub fn new(
        phase: MatchPhase,
        clock: MatchClock,
        home_score: u8,
        away_score: u8,
        possession: Side,
    ) -> Self {
        Self {
            phase,
            clock,
            home_score,
            away_score,
            possession,
            possession_share: None,
            expected_goals: None,
            momentum: Vec::new(),
            shootout: None,
        }
    }

    pub fn with_possession_share(mut self, home: f64, away: f64) -> Self {
        self.possession_share = Some(PerSide::new(home, away));
        self
    }

    pub fn with_expected_goals(mut self, home: f32, away: f32) -> Self {
        self.expected_goals = Some(PerSide::new(home, away));
        self
    }

    pub fn with_momentum(mut self, momentum: Vec<MinuteMomentum>) -> Self {
        self.momentum = momentum;
        self
    }

    pub fn with_shootout(mut self, shootout: Option<PenaltyShootoutSnapshot>) -> Self {
        self.shootout = shootout;
        self
    }
}

/// One side's personnel, as the engine currently has them.
///
/// `team.players` is the eleven on the pitch with their live condition, not the
/// eleven that started: a substitution replaces the entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SideSquad {
    pub team: TeamData,
    pub bench: Vec<PlayerData>,
    pub subs_made: u8,
    pub set_pieces: SetPieceTakers,
    /// Bookings by player id. Two entries means a dismissal is one foul away.
    pub yellows: HashMap<String, u8>,
}

/// Who is available to both sides, and what has happened to them.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SquadState {
    pub home: SideSquad,
    pub away: SideSquad,
    /// The most substitutions either side may make.
    pub max_subs: u8,
    /// Everyone dismissed, both sides. One set, because a player id is unique
    /// across the match and the caller usually wants "is this player off?".
    pub sent_off: HashSet<String>,
    /// Every change made so far, in the order they were made.
    pub substitutions: Vec<SubstitutionRecord>,
}

impl SquadState {
    pub fn side(&self, side: Side) -> &SideSquad {
        match side {
            Side::Home => &self.home,
            Side::Away => &self.away,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::MatchPeriod;

    fn progress() -> MatchProgress {
        MatchProgress::new(
            MatchPhase::FirstHalf,
            MatchClock::new(MatchPeriod::FirstHalf, 60_000),
            1,
            0,
            Side::Home,
        )
    }

    #[test]
    fn the_required_half_is_the_part_every_engine_has() {
        let p = progress();
        assert_eq!(p.home_score, 1);
        assert!(p.possession_share.is_none());
        assert!(p.expected_goals.is_none());
        assert!(p.momentum.is_empty());
        assert!(p.shootout.is_none());
    }

    #[test]
    fn an_engine_that_does_not_model_expected_goals_says_none_rather_than_zero() {
        // Zero xg means nobody has had a chance. "We do not measure that" is a
        // different statement, and a chart that cannot tell them apart draws a
        // flat line and calls it a match.
        assert!(progress().expected_goals.is_none());
        let measured = progress().with_expected_goals(0.0, 0.0);
        assert_eq!(measured.expected_goals.map(|xg| xg.home), Some(0.0));
    }

    #[test]
    fn a_per_side_value_is_readable_by_side() {
        let p = progress().with_possession_share(61.0, 39.0);
        let share = p.possession_share.expect("set above");
        assert_eq!(*share.get(Side::Home), 61.0);
        assert_eq!(*share.get(Side::Away), 39.0);
    }
}
