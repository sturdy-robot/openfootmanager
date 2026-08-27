pub mod advance;
pub mod ai;
pub mod clock;
pub mod compliance;
pub mod descriptor;
pub mod engine;
pub mod event;
pub mod live_match;
pub mod registry;
pub mod rejection;
pub mod report;
pub(crate) mod shared;
pub mod sim;
pub mod spatial;
pub mod traits;
pub mod types;
pub mod view;

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
pub const ENGINE_VERSION: u32 = 19;

/// Offset that derives the dugout's random stream from the fixture seed.
///
/// Lives here rather than beside either caller because both of them need it and
/// they must agree: a fixture resolved unwatched and the same fixture watched
/// live have to make the same substitutions at the same minutes, or a replay
/// reconstructs a different match from the one that was played. They did not
/// agree — the batch driver took the manager seed off the top of the simulation
/// stream while the live session derived it from the fixture seed, so the two
/// diverged from the first minute.
///
/// Changing it changes every AI decision for a given seed, so it is engine
/// behaviour: treat it as pinned, and bump [`ENGINE_VERSION`] if it has to move.
pub const AI_STREAM_SALT: u64 = 0xA15E_EDA1_5EED;

pub mod replay;

// Re-export key types for convenience
pub use engine::simulate;
pub use engine::simulate_setup;
pub use engine::simulate_with_rng;
pub use advance::{AdvanceRequest, LiveUpdate, StopReason};
pub use clock::{MatchClock, MatchPeriod};
pub use descriptor::{
    CONTRACT_VERSION, EngineDescriptor, EngineInfo, MatchCommandKind, NativeStep,
};
pub use event::{EventDetail, EventType, MatchEvent, ShotTechnique};
pub use live_match::{
    LiveMatchState, MatchCommand, MatchPhase, MatchSnapshot, MinuteResult, PenaltyShootoutSnapshot,
    SetPieceTakers, SnapshotContext, SubstitutionRecord,
};
pub use rejection::CommandRejection;
pub use spatial::{
    BallPosition, PitchGeometry, PitchPoint, PlayerPosition, SpatialFrame, SpatialTelemetry,
};
pub use report::{GoalDetail, GoalSource, MatchReport, PlayerMatchStats, TeamStats};
pub use traits::{
    DEFAULT_ENGINE_ID, DefaultEngine, InstantEngine, LiveEngine, LiveEngineObject, LiveState,
    MatchSetup,
};
pub use view::{MatchProgress, PerSide, SideSquad, SquadState};
pub use types::{
    BreakSpeed, CounterPressDuration, DefensiveLine, DefensiveShape, MarkingStyle, MatchConfig,
    PlayStyle, PlayerData, PlayerRole, Position, PressingIntensity, Side, Slot,
    TacticsBuildUpStyle, TacticsConfig, TacticsPitchWidth, TeamData, Tempo, Zone,
};
