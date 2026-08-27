//! Why an engine could not start a match.
//!
//! Separate from [`crate::rejection::CommandRejection`], which is about a
//! decision refused *during* a match. This is about a match that never began.
//!
//! Closed for the same reason the rejection set is closed: the game renders
//! these, and a third-party engine returning a string of its own would put text
//! on screen that no locale file contains. Every variant owns a
//! repository-static translation key, checked against `en.json` by a test in
//! this module.
//!
//! One variant per thing that can actually go wrong, and no more. There is no
//! speculative `InvalidSetup`: nothing validates a squad at kick-off today, and
//! a variant no path can produce is a promise to a caller that it will never be
//! kept.

use serde::{Deserialize, Serialize};

/// Why a match could not be started.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EngineError {
    /// Nothing is registered under the requested engine id.
    ///
    /// Carries the id so a log can name it. The player-facing message does not
    /// interpolate it: an engine id is a developer's string, not something to
    /// show somebody who asked to watch a football match.
    UnknownEngine { requested: String },
    /// The setup carries tuning written for a different engine.
    ///
    /// Declined rather than ignored. Silently falling back to defaults would
    /// run a match under settings nobody chose and report nothing, which is the
    /// failure the whole per-engine config split exists to prevent.
    ConfigForAnotherEngine {
        /// The engine that was asked to start the match.
        expected: &'static str,
        /// The engine the config says it was written for.
        found: &'static str,
    },
}

impl EngineError {
    /// The translation key the frontend resolves. Never English prose.
    pub fn translation_key(&self) -> &'static str {
        match self {
            EngineError::UnknownEngine { .. } => "be.error.liveMatch.unknownEngine",
            EngineError::ConfigForAnotherEngine { .. } => {
                "be.error.liveMatch.configForAnotherEngine"
            }
        }
    }

    /// Every error the contract defines, one per variant.
    pub fn all() -> Vec<EngineError> {
        vec![
            EngineError::UnknownEngine {
                requested: "example".to_string(),
            },
            EngineError::ConfigForAnotherEngine {
                expected: "default",
                found: "example",
            },
        ]
    }
}

impl std::fmt::Display for EngineError {
    /// Renders as the translation key, so an error that reaches a
    /// `String`-shaped boundary still carries something the frontend resolves.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.translation_key())
    }
}

impl std::error::Error for EngineError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_error_names_a_live_match_error_key() {
        for error in EngineError::all() {
            let key = error.translation_key();
            assert!(
                key.starts_with("be.error.liveMatch."),
                "{error:?} returned {key:?}, which is not a live-match error key"
            );
            assert!(
                !key.contains(' '),
                "{error:?} returned {key:?}, which looks like prose rather than a key"
            );
        }
    }

    #[test]
    fn distinct_errors_get_distinct_keys() {
        let mut keys: Vec<&str> = EngineError::all()
            .iter()
            .map(|e| e.translation_key())
            .collect();
        let total = keys.len();
        keys.sort_unstable();
        keys.dedup();
        assert_eq!(total, keys.len(), "two errors share a translation key");
    }

    #[test]
    fn an_error_renders_as_its_key_at_a_string_boundary() {
        assert_eq!(
            EngineError::UnknownEngine {
                requested: "no-such-engine".to_string()
            }
            .to_string(),
            "be.error.liveMatch.unknownEngine"
        );
    }

    /// The point of closing the set: every key an engine can produce is one the
    /// game can actually translate.
    ///
    /// This exact test is why the set is closed. `be.error.liveMatch.unknownEngine`
    /// was invented as a bare `format!` string in `ofm_core` and shipped in
    /// **zero** of the eleven locales, because nothing was checking.
    #[test]
    fn every_key_exists_in_the_english_locale() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../src/i18n/locales/en.json"
        );
        let raw = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("could not read {path}: {e}. Has the locale tree moved?"));
        let tree: serde_json::Value =
            serde_json::from_str(&raw).expect("en.json is not valid JSON");

        for error in EngineError::all() {
            let key = error.translation_key();
            let mut node = &tree;
            for segment in key.split('.') {
                node = node.get(segment).unwrap_or_else(|| {
                    panic!(
                        "{error:?} returns {key:?}, which en.json does not define. \
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
