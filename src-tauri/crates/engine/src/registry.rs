//! Every engine the build knows about, in one place.
//!
//! Two tools had their own answer to "which engines exist": `sim-bench` kept a
//! private match on the id, and the game had no answer at all because it named
//! `LiveMatchState` directly. Adding a second engine would have meant finding
//! both and hoping there was not a third.
//!
//! Registration is by source: an engine is compiled in, listed here, and is
//! then benchable, compliance-checkable and playable by name. That is the whole
//! mechanism. Loading an engine from a shared library at runtime would need a
//! stable ABI and a security model, and is deliberately not what this is.

use crate::descriptor::{EngineDescriptor, EngineInfo};
use crate::error::EngineError;
use crate::traits::{DefaultEngine, InstantEngine, LiveEngineObject, LiveState, MatchSetup};

/// The engine the game uses unless told otherwise.
pub const DEFAULT_ENGINE_ID: &str = crate::traits::DEFAULT_ENGINE_ID;

/// Resolve an engine that resolves a whole match in one call.
pub fn instant(id: &str) -> Option<Box<dyn InstantEngine>> {
    match id {
        DEFAULT_ENGINE_ID => Some(Box::new(DefaultEngine)),
        _ => None,
    }
}

/// Resolve an engine that can be stepped and commanded.
pub fn live(id: &str) -> Option<Box<dyn LiveEngineObject>> {
    match id {
        DEFAULT_ENGINE_ID => Some(Box::new(DefaultEngine)),
        _ => None,
    }
}

/// Start a match on a named engine.
///
/// Declines an unknown id rather than falling back to the built-in engine. A
/// silent fallback would stamp the wrong engine id on the fixture and make the
/// replay guard confidently wrong about what produced the result.
///
/// The unknown id is a typed [`EngineError`] rather than a bare `None` so it
/// carries a translation key. `ofm_core` used to build that key by hand with a
/// `format!`, and the key it built existed in none of the eleven locale files.
pub fn kickoff(id: &str, setup: MatchSetup) -> Result<Box<dyn LiveState + Send>, EngineError> {
    let engine = live(id).ok_or_else(|| EngineError::UnknownEngine {
        requested: id.to_string(),
    })?;
    engine.kickoff_boxed(setup)
}

/// What every registered engine says about itself.
pub fn descriptors() -> Vec<EngineDescriptor> {
    ids().iter().filter_map(|id| describe(id)).collect()
}

/// One engine's descriptor, or `None` if the id is unknown.
pub fn describe(id: &str) -> Option<EngineDescriptor> {
    instant(id).map(|engine| EngineInfo::descriptor(engine.as_ref()))
}

/// Every registered id, for error messages and for tools that enumerate.
pub fn ids() -> &'static [&'static str] {
    &[DEFAULT_ENGINE_ID]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_built_in_engine_is_registered_on_both_paths() {
        assert!(instant(DEFAULT_ENGINE_ID).is_some());
        assert!(live(DEFAULT_ENGINE_ID).is_some());
    }

    #[test]
    fn an_unknown_engine_is_declined_rather_than_substituted() {
        // A silent fallback would stamp the wrong engine id on the fixture, and
        // the replay guard would then be confidently wrong about what produced
        // the result.
        assert!(instant("no-such-engine").is_none());
        assert!(live("no-such-engine").is_none());
        assert!(describe("no-such-engine").is_none());
    }

    #[test]
    fn every_listed_id_actually_resolves() {
        for id in ids() {
            assert!(instant(id).is_some(), "{id} is listed but has no instant engine");
            assert!(live(id).is_some(), "{id} is listed but has no live engine");
            assert!(describe(id).is_some(), "{id} is listed but has no descriptor");
        }
    }

    #[test]
    fn a_descriptor_names_the_engine_it_came_from() {
        let d = describe(DEFAULT_ENGINE_ID).expect("registered");
        assert_eq!(d.id, DEFAULT_ENGINE_ID);
        assert_eq!(d.engine_version, crate::ENGINE_VERSION);
    }

    #[test]
    fn descriptors_covers_every_registered_engine() {
        assert_eq!(descriptors().len(), ids().len());
    }
}
