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

use crate::ai::AiProfile;
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
    /// The dugouts. `None` means nobody is managing that side during the
    /// match — no substitutions, no tactical changes — which is what a bare
    /// engine benchmark wants and what an unattended fixture used to get.
    pub home_manager: Option<AiProfile>,
    pub away_manager: Option<AiProfile>,
    /// The fixture seed, when the caller has one. See [`MatchSetup::with_seed`].
    pub seed: Option<u64>,
}

impl MatchSetup {
    /// A bare fixture: no benches, no dugouts, no extra time.
    ///
    /// Useful for measuring the engine in isolation. A real fixture should
    /// carry benches and managers, or nobody ever makes a substitution.
    pub fn league(home: TeamData, away: TeamData, config: MatchConfig) -> Self {
        Self {
            home,
            away,
            config,
            home_bench: Vec::new(),
            away_bench: Vec::new(),
            allows_extra_time: false,
            home_manager: None,
            away_manager: None,
            seed: None,
        }
    }

    /// The fixture seed this match is being simulated from.
    ///
    /// Only needed so the dugout's stream can be derived the same way the live
    /// session derives it — see [`crate::AI_STREAM_SALT`]. A caller with no
    /// seed (a benchmark, the compliance suite) leaves it unset and the manager
    /// stream is taken off the simulation stream as before; nothing that has no
    /// seed can be replayed anyway.
    pub fn with_seed(mut self, seed: u64) -> Self {
        self.seed = Some(seed);
        self
    }

    /// Whether a level score at ninety minutes goes to extra time.
    ///
    /// A knockout tie does; a league fixture does not. Without this a cup tie
    /// resolved in the batch path went from the ninetieth minute straight to
    /// the shootout, while the same tie watched live played the extra half
    /// hour — so how a tie was settled depended on whether anyone was looking.
    pub fn with_extra_time(mut self, allows: bool) -> Self {
        self.allows_extra_time = allows;
        self
    }

    /// Put a manager in each dugout.
    pub fn with_managers(mut self, home: AiProfile, away: AiProfile) -> Self {
        self.home_manager = Some(home);
        self.away_manager = Some(away);
        self
    }

    /// Give each side a bench to pick substitutes from.
    pub fn with_benches(mut self, home: Vec<PlayerData>, away: Vec<PlayerData>) -> Self {
        self.home_bench = home;
        self.away_bench = away;
        self
    }
}

/// An engine that resolves a whole match in one call.
///
/// This is the path the league uses for fixtures the player is not watching,
/// and the path `sim-bench` measures.
pub trait InstantEngine: crate::descriptor::EngineInfo {
    /// Simulate a full match and return the report.
    ///
    /// Must be deterministic: the same `rng` seed and the same inputs must
    /// produce the same report. See [`crate::compliance`].
    fn simulate(&self, setup: &MatchSetup, rng: &mut dyn Rng) -> MatchReport;
}

/// An engine that can be stepped a minute at a time, accepting commands
/// between minutes — what the watched match and (later) replay playback use.
pub trait LiveEngine: crate::descriptor::EngineInfo {
    type State: LiveState;

    fn kickoff(&self, setup: MatchSetup) -> Self::State;
}

/// A match in progress.
pub trait LiveState {
    /// Advance one minute. Returns what happened.
    fn step_minute(&mut self, rng: &mut dyn Rng) -> MinuteResult;

    /// Apply a command between minutes (substitution, tactical change).
    ///
    /// The reason set is closed, so an engine picks a rejection rather than
    /// inventing a message the game cannot translate. See
    /// [`crate::rejection::CommandRejection`].
    fn apply_command(
        &mut self,
        cmd: MatchCommand,
    ) -> Result<(), crate::rejection::CommandRejection>;

    fn snapshot(&self) -> MatchSnapshot;

    fn phase(&self) -> MatchPhase;

    fn is_finished(&self) -> bool;

    fn events(&self) -> &[MatchEvent];

    /// Where everyone is, for engines that model position.
    ///
    /// Returns `None` by default, which is the honest answer for an engine that
    /// resolves zones rather than coordinates. An engine that returns `Some`
    /// must also set `spatial_telemetry` in its descriptor; the two disagreeing
    /// is a compliance failure, because a capability nobody checks becomes a
    /// stale claim.
    ///
    /// Declared here rather than on a subtrait so it survives type erasure: a
    /// caller holding a `dyn LiveState` from an engine registry can still ask.
    /// A `PositionalState: LiveState` subtrait would be unreachable through
    /// exactly the abstraction that makes a second engine possible.
    fn telemetry(&self) -> Option<&dyn crate::spatial::SpatialTelemetry> {
        None
    }

    /// Consume the match and produce its report.
    ///
    /// Takes `Box<Self>` rather than `self` so it can be called on an erased
    /// state. With a bare `self` receiver the method is excluded from the
    /// vtable, and `Box<dyn LiveState>` compiles right up until you try to
    /// finish the match, at which point it is `error[E0161]: cannot move a
    /// value of type dyn LiveState`. A match that can be played and never
    /// finished is no use to an engine registry.
    fn into_report(self: Box<Self>) -> MatchReport;
}

// ---------------------------------------------------------------------------
// The built-in engine's implementation of the contract
// ---------------------------------------------------------------------------

/// The engine shipped with the game.
#[derive(Debug, Clone, Copy, Default)]
pub struct DefaultEngine;

pub const DEFAULT_ENGINE_ID: &str = "default";

impl crate::descriptor::EngineInfo for DefaultEngine {
    fn descriptor(&self) -> crate::descriptor::EngineDescriptor {
        use crate::descriptor::{EngineDescriptor, MatchCommandKind, NativeStep, CONTRACT_VERSION};
        EngineDescriptor {
            id: DEFAULT_ENGINE_ID,
            engine_version: crate::ENGINE_VERSION,
            contract_version: CONTRACT_VERSION,
            // The possession chain measures actions in seconds internally, but
            // it only surfaces a resolved minute, so a caller cannot ask it for
            // less than one.
            native_step: NativeStep::WholeMinute,
            // Every command the contract defines is accepted.
            commands: MatchCommandKind::ALL,
            // Play is resolved over five bands and three lanes, not on a pitch
            // with coordinates. There is nothing honest to report here.
            spatial_telemetry: false,
            extra_time: true,
            penalty_shootout: true,
            in_match_ai: true,
        }
    }
}

impl InstantEngine for DefaultEngine {
    fn simulate(&self, setup: &MatchSetup, rng: &mut dyn Rng) -> MatchReport {
        // Straight through, not via `simulate_with_rng`: that takes the two
        // teams and a config, so routing through it silently discarded the
        // benches, the extra-time flag and the dugouts this setup carries — and
        // cloned both squads a second time on the way.
        crate::engine::simulate_setup(setup, rng)
    }
}

impl LiveEngine for DefaultEngine {
    type State = crate::live_match::LiveMatchState;

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

    fn apply_command(
        &mut self,
        cmd: MatchCommand,
    ) -> Result<(), crate::rejection::CommandRejection> {
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

    fn into_report(self: Box<Self>) -> MatchReport {
        crate::live_match::LiveMatchState::into_report(*self)
    }
}

// ---------------------------------------------------------------------------
// Holding an engine without naming its type
// ---------------------------------------------------------------------------

/// Object-safe companion to [`LiveEngine`].
///
/// `LiveEngine` carries an associated `State`, so a registry entry would have
/// to name a concrete state type and every engine would need its own entry.
/// That defeats the point: the whole reason for an engine contract is a
/// collection of engines nobody had to enumerate in advance.
///
/// The blanket implementation means an engine gets this for free by
/// implementing `LiveEngine`, and the generic path stays exactly as it was, so
/// production pays nothing for the erased one existing.
///
/// `Send` is not decoration. `StateManager` keeps the live session behind a
/// mutex shared with the Tauri command pool and, under the `mcp` feature, the
/// MCP server's runtime, and `LiveMatchState` carries a compile-time assertion
/// to that effect. An erased state that is not `Send` would compile here and
/// fail in the crate that stores it, behind a feature flag that is off by
/// default.
pub trait LiveEngineObject: crate::descriptor::EngineInfo {
    fn kickoff_boxed(&self, setup: MatchSetup) -> Box<dyn LiveState + Send>;
}

impl<T> LiveEngineObject for T
where
    T: LiveEngine + crate::descriptor::EngineInfo,
    T::State: Send + 'static,
{
    fn kickoff_boxed(&self, setup: MatchSetup) -> Box<dyn LiveState + Send> {
        Box::new(self.kickoff(setup))
    }
}
