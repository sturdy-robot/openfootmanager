use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct MediaAssetRef {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct EntityMedia {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub portrait: Option<MediaAssetRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<MediaAssetRef>,
}
