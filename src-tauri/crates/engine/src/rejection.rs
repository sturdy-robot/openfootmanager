//! Why an engine turned a command down.
//!
//! This used to be a bare `String` that every caller agreed, by convention, to
//! populate with a translation key. The convention held while there was one
//! engine written by the people who own the locale files. It does not survive a
//! second engine: a third-party implementation would return whatever string it
//! liked, the frontend would look up a key that does not exist, and the player
//! would see the raw key or nothing at all. The project's rule that user-facing
//! text is a translation key would be broken by a caller nobody here reviewed.
//!
//! So the set of reasons is closed and lives here. An engine picks one; it
//! cannot invent one. Every key is checked against `en.json` by a test in this
//! module, and `localeCoverage.test.ts` then requires all eleven locales to
//! carry it.

use serde::{Deserialize, Serialize};

use crate::descriptor::MatchCommandKind;

/// Why a [`crate::MatchCommand`] was refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CommandRejection {
    /// The side has already used all the substitutions the competition allows.
    MaxSubstitutionsReached,
    /// A dismissed player cannot be replaced. The side plays on a man short.
    CannotSubstituteSentOffPlayer,
    /// Football does not let a player return once he has been taken off.
    PlayerAlreadySubstitutedOff,
    PlayerNotOnPitch,
    PlayerNotOnBench,
    PlayerNotInStartingXi,
    /// Swapping the starting eleven is a team-sheet decision, not an in-play one.
    PreMatchSwapTooLate,
    /// This engine does not accept this kind of command at all.
    ///
    /// Carries the kind so the caller can stop offering it rather than
    /// discovering the refusal again on the next click. An engine that declines
    /// a command must also leave it out of
    /// [`crate::EngineDescriptor::commands`].
    Unsupported(MatchCommandKind),
}

impl CommandRejection {
    /// The translation key the frontend resolves. Never English prose.
    pub fn translation_key(self) -> &'static str {
        match self {
            CommandRejection::MaxSubstitutionsReached => {
                "be.error.liveMatch.maxSubstitutionsReached"
            }
            CommandRejection::CannotSubstituteSentOffPlayer => {
                "be.error.liveMatch.cannotSubstituteSentOffPlayer"
            }
            CommandRejection::PlayerAlreadySubstitutedOff => {
                "be.error.liveMatch.playerAlreadySubstitutedOff"
            }
            CommandRejection::PlayerNotOnPitch => "be.error.liveMatch.playerNotOnPitch",
            CommandRejection::PlayerNotOnBench => "be.error.liveMatch.playerNotOnBench",
            CommandRejection::PlayerNotInStartingXi => "be.error.liveMatch.playerNotInStartingXi",
            CommandRejection::PreMatchSwapTooLate => "be.error.liveMatch.preMatchSwapTooLate",
            CommandRejection::Unsupported(_) => "be.error.liveMatch.commandNotSupported",
        }
    }

    /// Every reason the contract defines, one per variant.
    ///
    /// `Unsupported` is represented once; its key does not vary by kind.
    pub fn all() -> Vec<CommandRejection> {
        vec![
            CommandRejection::MaxSubstitutionsReached,
            CommandRejection::CannotSubstituteSentOffPlayer,
            CommandRejection::PlayerAlreadySubstitutedOff,
            CommandRejection::PlayerNotOnPitch,
            CommandRejection::PlayerNotOnBench,
            CommandRejection::PlayerNotInStartingXi,
            CommandRejection::PreMatchSwapTooLate,
            CommandRejection::Unsupported(MatchCommandKind::Substitute),
        ]
    }
}

impl std::fmt::Display for CommandRejection {
    /// Renders as the translation key, so a rejection that reaches a
    /// `String`-shaped boundary still carries something the frontend resolves.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.translation_key())
    }
}

impl std::error::Error for CommandRejection {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_reason_names_a_live_match_error_key() {
        for reason in CommandRejection::all() {
            let key = reason.translation_key();
            assert!(
                key.starts_with("be.error.liveMatch."),
                "{reason:?} returned {key:?}, which is not a live-match error key"
            );
            assert!(
                !key.contains(' '),
                "{reason:?} returned {key:?}, which looks like prose rather than a key"
            );
        }
    }

    #[test]
    fn distinct_reasons_get_distinct_keys() {
        // Otherwise the player is told the wrong thing about why the
        // substitution was refused.
        let mut keys: Vec<&str> = CommandRejection::all()
            .into_iter()
            .map(|r| r.translation_key())
            .collect();
        let total = keys.len();
        keys.sort_unstable();
        keys.dedup();
        assert_eq!(total, keys.len(), "two reasons share a translation key");
    }

    #[test]
    fn an_unsupported_command_reads_the_same_whichever_command_it_was() {
        assert_eq!(
            CommandRejection::Unsupported(MatchCommandKind::Substitute).translation_key(),
            CommandRejection::Unsupported(MatchCommandKind::ChangeFormation).translation_key(),
        );
    }

    #[test]
    fn a_rejection_renders_as_its_key_at_a_string_boundary() {
        assert_eq!(
            CommandRejection::PlayerNotOnBench.to_string(),
            "be.error.liveMatch.playerNotOnBench"
        );
    }

    /// The point of closing the set: every key an engine can produce is one the
    /// game can actually translate.
    ///
    /// `en.json` is the source the other ten are measured against by
    /// `src/i18n/localeCoverage.test.ts`, so a key present here reaches every
    /// locale or that suite goes red.
    #[test]
    fn every_key_exists_in_the_english_locale() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../src/i18n/locales/en.json"
        );
        let raw = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("could not read {path}: {e}. Has the locale tree moved?"));
        let tree: serde_json::Value = serde_json::from_str(&raw).expect("en.json is not valid JSON");

        for reason in CommandRejection::all() {
            let key = reason.translation_key();
            let mut node = &tree;
            for segment in key.split('.') {
                node = node.get(segment).unwrap_or_else(|| {
                    panic!(
                        "{reason:?} returns {key:?}, which en.json does not define. \
                         Add it to all eleven locales."
                    )
                });
            }
            assert!(
                node.as_str().is_some_and(|s| !s.trim().is_empty()),
                "{key:?} is defined in en.json but empty"
            );
        }
    }
}
