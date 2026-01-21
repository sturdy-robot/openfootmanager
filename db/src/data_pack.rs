use std::collections::HashSet;
use std::fs::File;
use std::io::Read;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use openfootmanager_core::models::club::Club;
use openfootmanager_core::models::league::League;
use openfootmanager_core::models::season::Season;
use openfootmanager_core::models::stadium::Stadium;

#[derive(Debug, Error)]
pub enum DataPackError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("yaml error: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("unsupported data pack extension: {0}")]
    UnsupportedExtension(String),
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("data pack validation failed: {issues:?}")]
pub struct DataPackValidationError {
    pub issues: Vec<String>,
}

impl DataPackValidationError {
    fn new() -> Self {
        Self { issues: Vec::new() }
    }

    fn push(&mut self, issue: impl Into<String>) {
        self.issues.push(issue.into());
    }

    fn into_result(self) -> Result<(), Self> {
        if self.issues.is_empty() {
            Ok(())
        } else {
            Err(self)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataPack {
    pub name: String,
    #[serde(default = "default_pack_version")]
    pub version: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub clubs: Vec<Club>,
    #[serde(default)]
    pub stadiums: Vec<Stadium>,
    #[serde(default)]
    pub leagues: Vec<League>,
    #[serde(default)]
    pub seasons: Vec<Season>,
}

impl DataPack {
    pub fn from_path(path: impl AsRef<Path>) -> Result<Self, DataPackError> {
        let path = path.as_ref();
        let mut file = File::open(path)?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)?;

        match path.extension().and_then(|ext| ext.to_str()).map(|ext| ext.to_ascii_lowercase()) {
            Some(ext) if ext == "json" => Ok(serde_json::from_str(&contents)?),
            Some(ext) if ext == "yaml" || ext == "yml" => Ok(serde_yaml::from_str(&contents)?),
            Some(ext) => Err(DataPackError::UnsupportedExtension(ext)),
            None => Err(DataPackError::UnsupportedExtension("".to_string())),
        }
    }

    pub fn from_json_str(value: &str) -> Result<Self, DataPackError> {
        Ok(serde_json::from_str(value)?)
    }

    pub fn from_yaml_str(value: &str) -> Result<Self, DataPackError> {
        Ok(serde_yaml::from_str(value)?)
    }

    pub fn validate(&self) -> Result<(), DataPackValidationError> {
        let mut error = DataPackValidationError::new();

        let club_ids = collect_unique_ids("club", &self.clubs, |club| club.id, &mut error);
        let league_ids = collect_unique_ids("league", &self.leagues, |league| league.id, &mut error);
        let season_ids = collect_unique_ids("season", &self.seasons, |season| season.id, &mut error);
        let _stadium_ids =
            collect_unique_ids("stadium", &self.stadiums, |stadium| stadium.id, &mut error);

        for league in &self.leagues {
            for club_id in &league.club_ids {
                if !club_ids.contains(club_id) {
                    error.push(format!(
                        "league {} references missing club {}",
                        league.id, club_id
                    ));
                }
            }
        }

        for season in &self.seasons {
            if !league_ids.contains(&season.league_id) {
                error.push(format!(
                    "season {} references missing league {}",
                    season.id, season.league_id
                ));
            }
        }

        let _ = season_ids;
        error.into_result()
    }
}

fn default_pack_version() -> String {
    "0.1.0".to_string()
}

fn collect_unique_ids<T>(
    label: &str,
    items: &[T],
    id_fn: impl Fn(&T) -> uuid::Uuid,
    error: &mut DataPackValidationError,
) -> HashSet<uuid::Uuid> {
    let mut ids = HashSet::new();
    for item in items {
        let id = id_fn(item);
        if !ids.insert(id) {
            error.push(format!("duplicate {label} id {id}"));
        }
    }
    ids
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn validation_catches_duplicate_ids() {
        let duplicate_id = Uuid::new_v4();
        let pack = DataPack {
            name: "Test".to_string(),
            version: "0.1.0".to_string(),
            description: None,
            clubs: vec![
                Club {
                    id: duplicate_id,
                    name: "Club A".to_string(),
                    short_name: "A".to_string(),
                    date_of_foundation: None,
                    nationality: "Testland".to_string(),
                    stadium: None,
                    manager: None,
                    players: Vec::new(),
                },
                Club {
                    id: duplicate_id,
                    name: "Club B".to_string(),
                    short_name: "B".to_string(),
                    date_of_foundation: None,
                    nationality: "Testland".to_string(),
                    stadium: None,
                    manager: None,
                    players: Vec::new(),
                },
            ],
            stadiums: Vec::new(),
            leagues: Vec::new(),
            seasons: Vec::new(),
        };

        let error = pack.validate().expect_err("should fail validation");
        assert!(error
            .issues
            .iter()
            .any(|issue| issue.contains("duplicate club id")));
    }

    #[test]
    fn validation_catches_missing_references() {
        let missing_club = Uuid::new_v4();
        let league_id = Uuid::new_v4();
        let pack = DataPack {
            name: "Test".to_string(),
            version: "0.1.0".to_string(),
            description: None,
            clubs: Vec::new(),
            stadiums: Vec::new(),
            leagues: vec![League {
                id: league_id,
                name: "League".to_string(),
                short_name: "L".to_string(),
                country: "Testland".to_string(),
                club_ids: vec![missing_club],
            }],
            seasons: vec![Season {
                id: Uuid::new_v4(),
                name: "Season".to_string(),
                league_id,
                year: 2026,
            }],
        };

        let error = pack.validate().expect_err("should fail validation");
        assert!(error
            .issues
            .iter()
            .any(|issue| issue.contains("missing club")));
    }
}
