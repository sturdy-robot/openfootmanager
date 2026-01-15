use crate::defs::{ClubDef, PlayerDef};
use crate::validate::DataError;

pub fn load_clubs_from_json_str(input: &str) -> Result<Vec<ClubDef>, DataError> {
    let clubs: Vec<ClubDef> = serde_json::from_str(input).map_err(DataError::Json)?;
    Ok(clubs)
}

pub fn load_clubs_from_yaml_str(input: &str) -> Result<Vec<ClubDef>, DataError> {
    let clubs: Vec<ClubDef> = serde_yaml::from_str(input).map_err(DataError::Yaml)?;
    Ok(clubs)
}

pub fn load_players_from_json_str(input: &str) -> Result<Vec<PlayerDef>, DataError> {
    let players: Vec<PlayerDef> = serde_json::from_str(input).map_err(DataError::Json)?;
    Ok(players)
}

pub fn load_players_from_yaml_str(input: &str) -> Result<Vec<PlayerDef>, DataError> {
    let players: Vec<PlayerDef> = serde_yaml::from_str(input).map_err(DataError::Yaml)?;
    Ok(players)
}
