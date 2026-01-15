mod manager;
mod meta;
mod paths;

pub use manager::{OpenSaveError, SaveId, SaveInfo, SaveManager};
pub use meta::{SaveMeta, SaveSchemaVersion};
pub use paths::SaveRoot;
