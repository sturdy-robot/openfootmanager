use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MatchResult {
    pub fixture_id: Uuid,
    pub home_club_id: Uuid,
    pub away_club_id: Uuid,
    pub home_score: u8,
    pub away_score: u8,
}

impl MatchResult {
    pub fn winner(&self) -> Option<Uuid> {
        if self.home_score > self.away_score {
            Some(self.home_club_id)
        } else if self.away_score > self.home_score {
            Some(self.away_club_id)
        } else {
            None
        }
    }

    pub fn is_draw(&self) -> bool {
        self.home_score == self.away_score
    }
}
