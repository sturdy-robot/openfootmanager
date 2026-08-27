//! Asking an engine for some play, without telling it how to cut time up.
//!
//! `step_minute` was the whole live contract: one call, one minute, always. It
//! is a fine shape for an engine that resolves a minute at a time, and it is
//! the wrong shape for the contract, because it makes the built-in engine's
//! internal cadence a rule every other engine has to obey. An engine resolving
//! sixty frames a second has to buffer a whole minute before it may say
//! anything, and an engine that would rather stop at the end of a possession
//! has nowhere to say so.
//!
//! So the caller now asks for an amount of play and the engine answers with
//! what it actually resolved.
//!
//! # The bargain
//!
//! An engine:
//!
//! - resolves **at least one native step** — see
//!   [`crate::descriptor::NativeStep`] — unless a boundary intervenes first, so
//!   a caller that asks for a millisecond still makes progress rather than
//!   spinning;
//! - stops as soon as it has resolved **at least** the budget, so it may
//!   overshoot by at most one native step;
//! - stops at a **phase boundary** regardless of budget, because commands are
//!   legal there and a half-time the caller was never told about is a half-time
//!   the player never sees;
//! - may stop early at a **natural boundary of its own** with budget to spare,
//!   and says so.
//!
//! The reason it stopped is reported rather than inferred, so a caller does not
//! have to reverse-engineer it from the clock.
//!
//! # What this does not change
//!
//! Commands and the dugout AI act *between* advance calls, exactly as they
//! acted between minutes. The granularity at which anyone can intervene is
//! therefore the caller's chosen budget, bounded below by the engine's native
//! step.

use serde::{Deserialize, Serialize};

use crate::clock::MatchClock;
use crate::event::MatchEvent;
use crate::live_match::MatchPhase;
use crate::types::Side;

const MS_PER_MINUTE: u32 = 60_000;

/// How much play the caller wants resolved.
///
/// A struct rather than a bare `u32` so the contract can grow a second
/// condition — stop at the next stoppage, stop on a goal — without every
/// engine's signature changing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AdvanceRequest {
    /// The match time the caller is asking for, in milliseconds.
    pub budget_ms: u32,
}

impl AdvanceRequest {
    pub fn millis(budget_ms: u32) -> Self {
        Self { budget_ms }
    }

    pub fn minutes(minutes: u8) -> Self {
        Self::millis(minutes as u32 * MS_PER_MINUTE)
    }

    /// One minute of play: what the watched match asks for on every tick, and
    /// what `step_minute` used to mean.
    pub fn one_minute() -> Self {
        Self::minutes(1)
    }
}

/// Why an engine stopped resolving.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StopReason {
    /// The budget was met or exceeded.
    BudgetSpent,
    /// The phase changed. Half time, full time, the start of a shootout —
    /// moments the caller has to be given the chance to act on.
    PhaseBoundary,
    /// The match is over.
    Finished,
    /// The engine reached a boundary of its own with budget left: the end of a
    /// possession, of a frame batch, or of a shootout round. Progress was made
    /// even where no time passed, which is why this is not the same as an
    /// engine that has stalled.
    NativeBoundary,
}

/// What one [`crate::LiveState::advance`] call resolved.
///
/// Deliberately carries no running minute. The minute is this engine's way of
/// counting, not the contract's: an engine keeping continuous time would have
/// to invent one, and it cannot be derived back from the clock in a shootout,
/// where the period opens at minute 121 and the engine is still reading 120.
/// A caller that needs it asks [`crate::LiveState::minute`], which is lossless.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveUpdate {
    /// Where the clock stands now.
    pub clock: MatchClock,
    /// How much match time this call actually resolved. Zero is a legitimate
    /// answer: a half-time transition and a penalty kick both move the match on
    /// without the clock running.
    pub resolved_ms: u32,
    pub phase: MatchPhase,
    /// What happened during **this call**, not the match so far.
    pub events: Vec<MatchEvent>,
    pub home_score: u8,
    pub away_score: u8,
    pub possession: Side,
    pub is_finished: bool,
    pub stopped: StopReason,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_minute_budget_is_sixty_thousand_milliseconds() {
        assert_eq!(AdvanceRequest::one_minute().budget_ms, 60_000);
        assert_eq!(AdvanceRequest::minutes(3).budget_ms, 180_000);
    }

    #[test]
    fn a_request_for_a_whole_match_does_not_overflow() {
        // 120 minutes plus stoppage still fits, which is what lets a caller ask
        // for "the rest of it" without reaching for a sentinel value.
        assert_eq!(AdvanceRequest::minutes(u8::MAX).budget_ms, 255 * 60_000);
    }
}
