//! Tuning an engine defines for itself.
//!
//! [`crate::MatchConfig`] used to sit on [`crate::MatchSetup`], which meant
//! every engine received it whether or not it meant anything to them. Read its
//! own doc comments and the problem is plain: `shot_accuracy_base` is
//! "calibrated against the effective shooting skill the engine actually
//! produces", and `goal_conversion_base` was "recalibrated when actor selection
//! became weighted". Those are facts about one possession-chain implementation.
//! A 2D engine handed them has nothing to do with them, and the shared setup
//! was telling it otherwise.
//!
//! So the setup now carries config the way a courier carries a parcel: it holds
//! it, it does not open it. The engine that recognises the type reads it, and
//! an engine handed a parcel addressed to somebody else declines the match
//! rather than running under settings nobody chose for it.
//!
//! # Why `Any` rather than a serialized blob
//!
//! Engines are Rust crates compiled into the build — see
//! `docs/ENGINE_CONTRACT.md`. Within one binary a downcast is exact, costs
//! nothing, and keeps each engine's tuning a real type with real defaults
//! rather than a map of strings that fails at kick-off. A serialized form
//! becomes necessary when a config has to be *recorded* — see the rough edge in
//! the contract doc — and that is a different problem with a different answer.

use std::any::Any;
use std::sync::Arc;

use crate::error::EngineError;

/// Settings belonging to one engine.
///
/// Implement it on your own config type and return your engine's id. The id is
/// not how the config is matched — the type is, and a downcast cannot be fooled
/// — it is so that an engine declining somebody else's config can say whose it
/// was.
pub trait EngineConfig: Any + Send + Sync + std::fmt::Debug {
    /// The id of the engine this tuning was written for.
    fn engine_id(&self) -> &'static str;

    /// Hand back `self` so the owning engine can recognise its own type.
    ///
    /// Written out rather than derived because `Any::downcast_ref` needs a
    /// `&dyn Any`, and there is no blanket way up from `&dyn EngineConfig`.
    /// Every implementation is the same one line.
    fn as_any(&self) -> &dyn Any;
}

/// A config a caller is carrying on an engine's behalf.
pub type SharedConfig = Arc<dyn EngineConfig>;

/// Read a carried config as your own type.
///
/// - `Ok(None)` — the caller supplied none. Use your defaults.
/// - `Ok(Some(c))` — yours, already the right type.
/// - `Err(..)` — written for another engine. Decline the match; do not fall
///   back to defaults, or the match runs under settings nobody picked and
///   nobody is told.
pub fn read_config<'a, T: EngineConfig>(
    carried: Option<&'a SharedConfig>,
    mine: &'static str,
) -> Result<Option<&'a T>, EngineError> {
    let Some(config) = carried else {
        return Ok(None);
    };
    config
        .as_any()
        .downcast_ref::<T>()
        .map(Some)
        .ok_or(EngineError::ConfigForAnotherEngine {
            expected: mine,
            found: config.engine_id(),
        })
}

impl EngineConfig for crate::types::MatchConfig {
    fn engine_id(&self) -> &'static str {
        crate::traits::DEFAULT_ENGINE_ID
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::MatchConfig;

    /// Stands in for a second engine's settings.
    #[derive(Debug)]
    struct OtherEngineConfig;

    impl EngineConfig for OtherEngineConfig {
        fn engine_id(&self) -> &'static str {
            "other-engine"
        }
        fn as_any(&self) -> &dyn Any {
            self
        }
    }

    #[test]
    fn no_config_means_use_your_defaults() {
        let read = read_config::<MatchConfig>(None, "default").expect("no config is not an error");
        assert!(read.is_none());
    }

    #[test]
    fn an_engine_reads_its_own_config() {
        let carried: SharedConfig = Arc::new(MatchConfig {
            home_advantage: 1.5,
            ..MatchConfig::default()
        });
        let read = read_config::<MatchConfig>(Some(&carried), "default")
            .expect("this is our own config")
            .expect("and it is present");
        assert_eq!(read.home_advantage, 1.5);
    }

    #[test]
    fn somebody_elses_config_is_declined_and_names_its_owner() {
        // Not ignored. Falling back to defaults would run the match under
        // settings nobody chose and report nothing.
        let carried: SharedConfig = Arc::new(OtherEngineConfig);
        let err = read_config::<MatchConfig>(Some(&carried), "default")
            .expect_err("this config belongs to another engine");
        assert_eq!(
            err,
            EngineError::ConfigForAnotherEngine {
                expected: "default",
                found: "other-engine",
            }
        );
    }

    #[test]
    fn the_type_is_the_gate_not_the_id() {
        // A config lying about its id still cannot be read as another engine's
        // type, because the downcast is what decides.
        #[derive(Debug)]
        struct Liar;
        impl EngineConfig for Liar {
            fn engine_id(&self) -> &'static str {
                crate::traits::DEFAULT_ENGINE_ID
            }
            fn as_any(&self) -> &dyn Any {
                self
            }
        }
        let carried: SharedConfig = Arc::new(Liar);
        assert!(read_config::<MatchConfig>(Some(&carried), "default").is_err());
    }
}
