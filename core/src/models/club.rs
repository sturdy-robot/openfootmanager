use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::NaiveDate;

use crate::models::player::Player;
use crate::models::stadium::Stadium;


#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Club {
    pub id: Uuid,
    pub name: String,
    pub short_name: String,
    pub date_of_foundation: Option<NaiveDate>,
    pub nationality: String,
    pub stadium: Option<Stadium>,
    pub manager: Option<Uuid>,
    pub players: Vec<Player>,
}