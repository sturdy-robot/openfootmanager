use std::collections::HashSet;

use thiserror::Error;

use crate::defs::{ClubDef, PlayerDef};

#[derive(Debug, Error)]
pub enum DataError {
    #[error("json parse error: {0}")]
    Json(serde_json::Error),
    #[error("yaml parse error: {0}")]
    Yaml(serde_yaml::Error),
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ValidationError {
    #[error("empty id")]
    EmptyId,
    #[error("empty name")]
    EmptyName,
    #[error("duplicate id: {id}")]
    DuplicateId { id: String },
    #[error("unknown club_id: {club_id}")]
    UnknownClubId { club_id: String },
}

pub fn validate_clubs(clubs: &[ClubDef]) -> Result<(), Vec<ValidationError>> {
    let mut ids = HashSet::<&str>::new();
    let mut errors = Vec::new();

    for c in clubs {
        if c.id.trim().is_empty() {
            errors.push(ValidationError::EmptyId);
        }
        if c.name.trim().is_empty() {
            errors.push(ValidationError::EmptyName);
        }
        if !c.id.trim().is_empty() && !ids.insert(c.id.as_str()) {
            errors.push(ValidationError::DuplicateId { id: c.id.clone() });
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

pub fn validate_players(
    players: &[PlayerDef],
    clubs: &[ClubDef],
) -> Result<(), Vec<ValidationError>> {
    let club_ids: HashSet<&str> = clubs.iter().map(|c| c.id.as_str()).collect();
    let mut ids = HashSet::<&str>::new();
    let mut errors = Vec::new();

    for p in players {
        if p.id.trim().is_empty() {
            errors.push(ValidationError::EmptyId);
        }
        if p.name.trim().is_empty() {
            errors.push(ValidationError::EmptyName);
        }
        if !p.id.trim().is_empty() && !ids.insert(p.id.as_str()) {
            errors.push(ValidationError::DuplicateId { id: p.id.clone() });
        }
        if !p.club_id.trim().is_empty() && !club_ids.contains(p.club_id.as_str()) {
            errors.push(ValidationError::UnknownClubId {
                club_id: p.club_id.clone(),
            });
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_players_rejects_unknown_club_id() {
        let clubs = vec![ClubDef {
            id: "club_a".into(),
            name: "Club A".into(),
        }];
        let players = vec![PlayerDef {
            id: "p1".into(),
            name: "Player 1".into(),
            club_id: "missing".into(),
        }];

        let err = validate_players(&players, &clubs).unwrap_err();
        assert_eq!(
            err,
            vec![ValidationError::UnknownClubId {
                club_id: "missing".into()
            }]
        );
    }
}
