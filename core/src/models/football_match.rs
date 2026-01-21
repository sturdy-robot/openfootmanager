use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::NaiveDateTime;

use crate::models::club::Club;


#[derive(Debug, Serialize, Copy, Clone, Deserialize, PartialEq, Eq)]
pub enum MatchStatus {
    Scheduled,
    InProgress,
    Finished,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct MatchState {
    pub home_team: Club,
    pub away_team: Club,
    pub home_score: u8,
    pub away_score: u8,
}


#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct FootballMatch {
    pub id: Uuid,
    pub date: NaiveDateTime,
    pub status: MatchStatus,
    pub home_club: Club,
    pub away_club: Club,
    pub home_score: u8,
    pub away_score: u8,
    pub winner: Option<Uuid>,
}