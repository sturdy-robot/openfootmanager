use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Season {
    pub id: Uuid,
    pub name: String,
    pub league_id: Uuid,
    pub year: i32,
}
