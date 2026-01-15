use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SaveSchemaVersion {
    V0,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SaveMeta {
    pub id: String,
    pub schema_version: SaveSchemaVersion,
    pub created_unix_seconds: u64,
    pub display_name: Option<String>,
}
