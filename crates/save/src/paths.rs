use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct SaveRoot {
    root_dir: PathBuf,
}

impl SaveRoot {
    pub fn new(root_dir: impl Into<PathBuf>) -> Self {
        Self {
            root_dir: root_dir.into(),
        }
    }

    pub fn path(&self) -> &Path {
        &self.root_dir
    }
}
