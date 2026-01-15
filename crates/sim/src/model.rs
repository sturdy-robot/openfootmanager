#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TeamSide {
    Home,
    Away,
}

impl TeamSide {
    pub fn other(self) -> Self {
        match self {
            TeamSide::Home => TeamSide::Away,
            TeamSide::Away => TeamSide::Home,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BallZone {
    DefensiveThird,
    MiddleThird,
    AttackingThird,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MatchState {
    pub minute: u16,
    pub possession: TeamSide,
    pub ball_zone: BallZone,
}

impl MatchState {
    pub fn new() -> Self {
        Self {
            minute: 0,
            possession: TeamSide::Home,
            ball_zone: BallZone::MiddleThird,
        }
    }
}

impl Default for MatchState {
    fn default() -> Self {
        Self::new()
    }
}
