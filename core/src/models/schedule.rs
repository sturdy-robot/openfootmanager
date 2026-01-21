use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Fixture {
    pub id: Uuid,
    pub home_club_id: Uuid,
    pub away_club_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Round {
    pub number: u8,
    pub leg: u8,
    pub fixtures: Vec<Fixture>,
    pub bye: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Schedule {
    pub rounds: Vec<Round>,
}
