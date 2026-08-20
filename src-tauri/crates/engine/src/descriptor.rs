//! What an engine is, and what it can be asked to do.
//!
//! The game has one engine today, so everything it supports has been an
//! assumption rather than a statement. A second engine makes every one of those
//! assumptions a question: does it play extra time, can it take a substitution,
//! does it know where the players are, and is it even speaking the same
//! contract as the caller?
//!
//! An [`EngineDescriptor`] answers all of that up front. Two rules keep it
//! honest rather than decorative:
//!
//! 1. It is declared once per engine, through [`EngineInfo`], which both
//!    [`crate::InstantEngine`] and [`crate::LiveEngine`] require. One engine
//!    cannot advertise extra time on the path the league uses and deny it on
//!    the path the player watches, which is exactly the divergence that already
//!    happened once between batch and live simulation.
//! 2. The compliance suite checks the claims against the engine's behaviour, so
//!    an advertised capability that does not work is a failure rather than a
//!    stale comment.

use serde::{Deserialize, Serialize};

use crate::live_match::MatchCommand;

/// The version of the engine contract itself.
///
/// Separate from [`crate::ENGINE_VERSION`], which is the built-in engine's
/// *behaviour* version. A third-party engine has its own behaviour version and
/// still has to say which contract it speaks, and the two answers move for
/// completely different reasons: recalibrating our shot conversion bumps one,
/// adding a method to `LiveState` bumps the other.
pub const CONTRACT_VERSION: u32 = 1;

/// A [`MatchCommand`] with its payload stripped, so an engine can list what it
/// accepts without inventing example commands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum MatchCommandKind {
    Substitute,
    ChangeFormation,
    ChangePlayStyle,
    SetFreeKickTaker,
    SetCornerTaker,
    SetPenaltyTaker,
    SetCaptain,
    PreMatchSwap,
    ChangePlayerRole,
}

impl MatchCommandKind {
    /// Every kind the contract defines.
    ///
    /// Keep in step with the enum. [`MatchCommand::kind`] matches exhaustively,
    /// so a new variant breaks the build there; this list is what stops it
    /// being quietly left out of an engine's advertised set.
    pub const ALL: &'static [MatchCommandKind] = &[
        MatchCommandKind::Substitute,
        MatchCommandKind::ChangeFormation,
        MatchCommandKind::ChangePlayStyle,
        MatchCommandKind::SetFreeKickTaker,
        MatchCommandKind::SetCornerTaker,
        MatchCommandKind::SetPenaltyTaker,
        MatchCommandKind::SetCaptain,
        MatchCommandKind::PreMatchSwap,
        MatchCommandKind::ChangePlayerRole,
    ];
}

impl MatchCommand {
    /// Which kind of command this is.
    pub fn kind(&self) -> MatchCommandKind {
        match self {
            MatchCommand::Substitute { .. } => MatchCommandKind::Substitute,
            MatchCommand::ChangeFormation { .. } => MatchCommandKind::ChangeFormation,
            MatchCommand::ChangePlayStyle { .. } => MatchCommandKind::ChangePlayStyle,
            MatchCommand::SetFreeKickTaker { .. } => MatchCommandKind::SetFreeKickTaker,
            MatchCommand::SetCornerTaker { .. } => MatchCommandKind::SetCornerTaker,
            MatchCommand::SetPenaltyTaker { .. } => MatchCommandKind::SetPenaltyTaker,
            MatchCommand::SetCaptain { .. } => MatchCommandKind::SetCaptain,
            MatchCommand::PreMatchSwap { .. } => MatchCommandKind::PreMatchSwap,
            MatchCommand::ChangePlayerRole { .. } => MatchCommandKind::ChangePlayerRole,
        }
    }
}

/// The finest slice of play an engine resolves in one go.
///
/// The built-in engine resolves a whole minute at a time. An engine driving a
/// visual match resolves far smaller steps. A caller asking for time to pass
/// gets to know which it is dealing with, so it can size its request instead of
/// guessing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NativeStep {
    /// Resolves in whole minutes and cannot report a partial one.
    WholeMinute,
    /// Resolves in slices of roughly this many milliseconds.
    Millis(u32),
}

/// Everything a caller needs to know about an engine before driving it.
///
/// Serialize-only: an engine constructs its own descriptor, so nothing ever
/// reads one back into Rust, and `&'static [MatchCommandKind]` cannot implement
/// `Deserialize` anyway.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct EngineDescriptor {
    /// Stable identifier. Stored on a fixture so a replay knows which engine
    /// produced it; two engines sharing an id would reconstruct each other's
    /// matches and present the result as history.
    pub id: &'static str,
    /// This engine's own behaviour version, bumped whenever it simulates
    /// something differently for the same seed.
    pub engine_version: u32,
    /// Which revision of the contract this engine implements.
    pub contract_version: u32,
    pub native_step: NativeStep,
    /// The commands this engine accepts. Anything absent is rejected as
    /// unsupported rather than silently ignored.
    pub commands: &'static [MatchCommandKind],
    /// Whether the engine can report where the players are. Off for engines
    /// that do not model position: a fabricated coordinate is worse than an
    /// absent one, because a consumer will trust it.
    pub spatial_telemetry: bool,
    pub extra_time: bool,
    pub penalty_shootout: bool,
    /// Whether the engine manages the dugout itself, or expects the caller to.
    pub in_match_ai: bool,
}

/// Declared once per engine, so the instant and live paths cannot disagree.
pub trait EngineInfo {
    fn descriptor(&self) -> EngineDescriptor;

    /// Convenience for the common case of wanting only the name.
    fn id(&self) -> &'static str {
        self.descriptor().id
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{PlayStyle, PlayerRole, Side};

    fn one_of_every_command() -> Vec<MatchCommand> {
        vec![
            MatchCommand::Substitute {
                side: Side::Home,
                player_off_id: "a".into(),
                player_on_id: "b".into(),
            },
            MatchCommand::ChangeFormation {
                side: Side::Home,
                formation: "4-4-2".into(),
            },
            MatchCommand::ChangePlayStyle {
                side: Side::Home,
                play_style: PlayStyle::Balanced,
            },
            MatchCommand::SetFreeKickTaker {
                side: Side::Home,
                player_id: "a".into(),
            },
            MatchCommand::SetCornerTaker {
                side: Side::Home,
                player_id: "a".into(),
            },
            MatchCommand::SetPenaltyTaker {
                side: Side::Home,
                player_id: "a".into(),
            },
            MatchCommand::SetCaptain {
                side: Side::Home,
                player_id: "a".into(),
            },
            MatchCommand::PreMatchSwap {
                side: Side::Home,
                player_off_id: "a".into(),
                player_on_id: "b".into(),
            },
            MatchCommand::ChangePlayerRole {
                side: Side::Home,
                player_id: "a".into(),
                role: PlayerRole::Poacher,
            },
        ]
    }

    #[test]
    fn every_command_reports_a_distinct_kind() {
        let kinds: Vec<MatchCommandKind> = one_of_every_command().iter().map(|c| c.kind()).collect();
        let mut unique = kinds.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(
            unique.len(),
            kinds.len(),
            "two commands report the same kind, so an engine cannot decline one without the other"
        );
    }

    #[test]
    fn the_kind_list_covers_every_command_the_contract_defines() {
        // The match in `kind()` is exhaustive, so a new variant breaks the
        // build there. This is what stops it being left out of ALL, and
        // therefore out of every engine's advertised set.
        let mut from_commands: Vec<MatchCommandKind> =
            one_of_every_command().iter().map(|c| c.kind()).collect();
        from_commands.sort();
        let mut all = MatchCommandKind::ALL.to_vec();
        all.sort();
        assert_eq!(from_commands, all);
    }

    #[test]
    fn a_descriptor_serializes_for_the_ui() {
        let d = EngineDescriptor {
            id: "test",
            engine_version: 3,
            contract_version: CONTRACT_VERSION,
            native_step: NativeStep::Millis(16),
            commands: &[MatchCommandKind::Substitute],
            spatial_telemetry: true,
            extra_time: true,
            penalty_shootout: false,
            in_match_ai: false,
        };
        let json = serde_json::to_value(&d).expect("serialize");
        assert_eq!(json["id"], "test");
        assert_eq!(json["engine_version"], 3);
        assert_eq!(json["spatial_telemetry"], true);
        assert_eq!(json["commands"][0], "Substitute");
    }

    #[test]
    fn the_built_in_engine_declares_one_descriptor_for_both_paths() {
        // InstantEngine and LiveEngine both require EngineInfo, so a single
        // impl serves both and they cannot drift apart. This asserts the shape
        // that structure is protecting.
        use crate::traits::DefaultEngine;
        let d = EngineInfo::descriptor(&DefaultEngine);
        assert_eq!(d.id, crate::traits::DEFAULT_ENGINE_ID);
        assert_eq!(d.engine_version, crate::ENGINE_VERSION);
        assert_eq!(d.contract_version, CONTRACT_VERSION);
        assert_eq!(d.native_step, NativeStep::WholeMinute);
        assert!(d.extra_time && d.penalty_shootout && d.in_match_ai);
        assert!(
            !d.spatial_telemetry,
            "the built-in engine resolves bands and lanes, not coordinates, so it must not claim to know where anyone is"
        );
        assert_eq!(
            d.commands,
            MatchCommandKind::ALL,
            "the built-in engine accepts every command the contract defines"
        );
    }
}
