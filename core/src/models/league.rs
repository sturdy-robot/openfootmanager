use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct League {
    pub id: Uuid,
    pub name: String,
    pub short_name: String,
    pub country: String,
    pub club_ids: Vec<Uuid>,
}
