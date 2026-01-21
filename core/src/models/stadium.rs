use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone)]
pub struct Stadium {
    pub id: Uuid,
    pub name: String,
    pub short_name: String,
    pub capacity: u32,
    pub location: String,
}