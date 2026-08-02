//! The engine contract.
//!
//! These traits describe what any match-simulation engine must provide, so that
//! tooling — `sim-bench`, the compliance suite, the Sim Lab — can drive an
//! engine without knowing which one it is. A replacement engine implements
//! these and immediately becomes benchable and checkable.
//!
//! # Why `&mut dyn Rng` rather than a generic parameter
//!
//! The traits must be object-safe so callers can hold a `Box<dyn InstantEngine>`
//! and pick an engine at runtime, which rules out a generic RNG parameter.
//!
//! The concrete entry points therefore take `R: Rng + ?Sized`, so they accept
//! both a concrete generator and a trait object. Production passes a concrete
//! `StdRng` and monomorphises exactly as before — no dynamic dispatch, no cost.
//! Only calls made *through* these traits pay a vtable call per draw.
//!
//! The `?Sized` bound matters for correctness, not just ergonomics: the
//! alternative — reseeding a local generator from the trait object — would make
//! the trait path draw a *different* random stream than the concrete path, so a
//! replay driven through the trait would reconstruct a different match.

use rand::Rng;

use crate::event::MatchEvent;
use crate::live_match::{MatchCommand, MatchPhase, MatchSnapshot, MinuteResult};
use crate::report::MatchReport;
use crate::types::{MatchConfig, PlayerData, TeamData};

/// Everything needed to kick a match off, in one struct so the trait signature
/// stays stable as the engine grows new inputs.
#[derive(Debug, Clone)]
pub struct MatchSetup {
    pub home: TeamData,
    pub away: TeamData,
    pub config: MatchConfig,
    pub home_bench: Vec<PlayerData>,
    pub away_bench: Vec<PlayerData>,
    /// Knockout ties go to extra time and, if still level, a shootout.
    pub allows_extra_time: bool,
}

impl MatchSetup {
    /// A league fixture: benches empty, no extra time.
    pub fn league(home: TeamData, away: TeamData, config: MatchConfig) -> Self {
        Self {
            home,
            away,
            config,
            home_bench: Vec::new(),
            away_bench: Vec::new(),
            allows_extra_time: false,
        }
    }
}

/// An engine that resolves a whole match in one call.
///
/// This is the path the league uses for fixtures the player is not watching,
/// and the path `sim-bench` measures.
pub trait InstantEngine {
    /// Stable identifier, used to select an engine by name.
    fn id(&self) -> &'static str;

    /// Simulate a full match and return the report.
    ///
    /// Must be deterministic: the same `rng` seed and the same inputs must
    /// produce the same report. See [`crate::compliance`].
    fn simulate(&self, setup: &MatchSetup, rng: &mut dyn Rng) -> MatchReport;
}

/// An engine that can be stepped a minute at a time, accepting commands
/// between minutes — what the watched match and (later) replay playback use.
pub trait LiveEngine {
    type State: LiveState;

    fn id(&self) -> &'static str;

    fn kickoff(&self, setup: MatchSetup) -> Self::State;
}

/// A match in progress.
pub trait LiveState {
    /// Advance one minute. Returns what happened.
    fn step_minute(&mut self, rng: &mut dyn Rng) -> MinuteResult;

    /// Apply a command between minutes (substitution, tactical change).
    ///
    /// Returns a translation key on rejection, never English prose.
    fn apply_command(&mut self, cmd: MatchCommand) -> Result<(), String>;

    fn snapshot(&self) -> MatchSnapshot;

    fn phase(&self) -> MatchPhase;

    fn is_finished(&self) -> bool;

    fn events(&self) -> &[MatchEvent];

    fn into_report(self) -> MatchReport;
}

// ---------------------------------------------------------------------------
// The built-in engine's implementation of the contract
// ---------------------------------------------------------------------------

/// The engine shipped with the game.
#[derive(Debug, Clone, Copy, Default)]
pub struct DefaultEngine;

pub const DEFAULT_ENGINE_ID: &str = "default";

impl InstantEngine for DefaultEngine {
    fn id(&self) -> &'static str {
        DEFAULT_ENGINE_ID
    }

    fn simulate(&self, setup: &MatchSetup, rng: &mut dyn Rng) -> MatchReport {
        crate::engine::simulate_with_rng(&setup.home, &setup.away, &setup.config, rng)
    }
}

impl LiveEngine for DefaultEngine {
    type State = crate::live_match::LiveMatchState;

    fn id(&self) -> &'static str {
        DEFAULT_ENGINE_ID
    }

    fn kickoff(&self, setup: MatchSetup) -> Self::State {
        crate::live_match::LiveMatchState::new(
            setup.home,
            setup.away,
            setup.config,
            setup.home_bench,
            setup.away_bench,
            setup.allows_extra_time,
        )
    }
}

impl LiveState for crate::live_match::LiveMatchState {
    fn step_minute(&mut self, rng: &mut dyn Rng) -> MinuteResult {
        crate::live_match::LiveMatchState::step_minute(self, rng)
    }

    fn apply_command(&mut self, cmd: MatchCommand) -> Result<(), String> {
        crate::live_match::LiveMatchState::apply_command(self, cmd)
    }

    fn snapshot(&self) -> MatchSnapshot {
        crate::live_match::LiveMatchState::snapshot(self)
    }

    fn phase(&self) -> MatchPhase {
        crate::live_match::LiveMatchState::phase(self)
    }

    fn is_finished(&self) -> bool {
        crate::live_match::LiveMatchState::is_finished(self)
    }

    fn events(&self) -> &[MatchEvent] {
        crate::live_match::LiveMatchState::events(self)
    }

    fn into_report(self) -> MatchReport {
        crate::live_match::LiveMatchState::into_report(self)
    }
}
