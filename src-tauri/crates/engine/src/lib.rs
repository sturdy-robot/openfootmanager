pub mod ai;
pub mod compliance;
pub mod engine;
pub mod event;
pub mod live_match;
pub mod report;
pub(crate) mod shared;
pub mod traits;
pub mod types;

/// The engine's behaviour version.
///
/// Bump this whenever a change alters what the engine simulates for a given
/// seed and inputs — new or reweighted probabilities, a different draw order, a
/// changed event stream. Stored alongside each fixture so a replay knows
/// whether the running engine can still reproduce it: on a mismatch the match
/// stays readable from its stored result, it just cannot be watched back.
///
/// Do **not** bump it for changes that cannot affect a simulated match, such as
/// documentation, renames, or new APIs no simulation path calls.
pub const ENGINE_VERSION: u32 = 2;

// Re-export key types for convenience
pub use engine::simulate;
pub use engine::simulate_setup;
pub use engine::simulate_with_rng;
pub use event::{EventType, MatchEvent};
pub use live_match::{
    LiveMatchState, MatchCommand, MatchPhase, MatchSnapshot, MinuteResult,
    PenaltyShootoutSnapshot, SetPieceTakers, SubstitutionRecord,
};
pub use report::{GoalDetail, GoalSource, MatchReport, PlayerMatchStats, TeamStats};
pub use traits::{
    DEFAULT_ENGINE_ID, DefaultEngine, InstantEngine, LiveEngine, LiveState, MatchSetup,
};
pub use types::{
    BreakSpeed, CounterPressDuration, DefensiveLine, DefensiveShape, MarkingStyle, MatchConfig,
    PlayStyle, PlayerData, PlayerRole, Position, PressingIntensity, Side, TacticsBuildUpStyle,
    TacticsConfig, TacticsPitchWidth, Tempo, TeamData, Zone,
};
