use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use thiserror::Error;
use uuid::Uuid;

use crate::meta::{SaveMeta, SaveSchemaVersion};
use crate::paths::SaveRoot;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SaveId(String);

impl SaveId {
    pub fn parse(input: &str) -> Result<Self, OpenSaveError> {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            return Err(OpenSaveError::InvalidSaveId);
        }

        if Uuid::parse_str(trimmed).is_err() {
            return Err(OpenSaveError::InvalidSaveId);
        }

        Ok(Self(trimmed.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SaveInfo {
    pub id: SaveId,
    pub dir: PathBuf,
    pub meta: SaveMeta,
}

#[derive(Debug, Error)]
pub enum OpenSaveError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("save not found: {id}")]
    NotFound { id: String },

    #[error("invalid save id")]
    InvalidSaveId,
}

#[derive(Debug, Clone)]
pub struct SaveManager {
    root: SaveRoot,
}

impl SaveManager {
    pub fn new(root: SaveRoot) -> Self {
        Self { root }
    }

    pub fn default_root() -> SaveRoot {
        SaveRoot::new("./saves")
    }

    pub fn ensure_root_dir(&self) -> Result<(), std::io::Error> {
        fs::create_dir_all(self.root.path())
    }

    pub fn create_new_save(&self, display_name: Option<String>) -> Result<SaveInfo, OpenSaveError> {
        self.ensure_root_dir()?;

        let id = SaveId(Uuid::new_v4().to_string());
        let dir = self.save_dir(&id);
        fs::create_dir_all(&dir)?;

        let meta = SaveMeta {
            id: id.0.clone(),
            schema_version: SaveSchemaVersion::V0,
            created_unix_seconds: now_unix_seconds(),
            display_name,
        };

        let meta_path = dir.join("meta.json");
        let json = serde_json::to_string_pretty(&meta)?;
        fs::write(meta_path, json)?;

        Ok(SaveInfo { id, dir, meta })
    }

    pub fn list_saves(&self) -> Result<Vec<SaveInfo>, OpenSaveError> {
        let mut out = Vec::new();

        if !self.root.path().exists() {
            return Ok(out);
        }

        for entry in fs::read_dir(self.root.path())? {
            let entry = entry?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let meta_path = path.join("meta.json");
            if !meta_path.is_file() {
                continue;
            }

            let meta_str = fs::read_to_string(&meta_path)?;
            let meta: SaveMeta = serde_json::from_str(&meta_str)?;
            let id = SaveId(meta.id.clone());

            out.push(SaveInfo {
                id,
                dir: path,
                meta,
            });
        }

        out.sort_by(|a, b| {
            a.meta
                .created_unix_seconds
                .cmp(&b.meta.created_unix_seconds)
        });
        Ok(out)
    }

    pub fn open_save(&self, id: &SaveId) -> Result<SaveInfo, OpenSaveError> {
        let dir = self.save_dir(id);
        if !dir.is_dir() {
            return Err(OpenSaveError::NotFound { id: id.0.clone() });
        }

        let meta_path = dir.join("meta.json");
        if !meta_path.is_file() {
            return Err(OpenSaveError::NotFound { id: id.0.clone() });
        }

        let meta_str = fs::read_to_string(&meta_path)?;
        let meta: SaveMeta = serde_json::from_str(&meta_str)?;
        if meta.id != id.0 {
            return Err(OpenSaveError::InvalidSaveId);
        }

        Ok(SaveInfo {
            id: SaveId(meta.id.clone()),
            dir,
            meta,
        })
    }

    fn save_dir(&self, id: &SaveId) -> PathBuf {
        self.root.path().join(id.as_str())
    }
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_list_open_flow() {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = SaveManager::new(SaveRoot::new(tmp.path()));

        let created = mgr
            .create_new_save(Some("My Save".to_string()))
            .expect("create save");

        let listed = mgr.list_saves().expect("list saves");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id.as_str(), created.id.as_str());

        let opened = mgr.open_save(&created.id).expect("open save");
        assert_eq!(opened.meta.id, created.id.as_str());
        assert_eq!(opened.meta.display_name.as_deref(), Some("My Save"));
    }
}
