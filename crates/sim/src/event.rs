use crate::model::{BallZone, TeamSide};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatchEvent {
    PassCompleted,
    PassIntercepted,
    DribbleWon,
    DribbleLost,
    ShotOnTarget,
    ShotOffTarget,
    TackleWon,
    Foul,
}

impl MatchEvent {
    pub fn to_commentary(self, side: TeamSide, zone: BallZone, minute: u16) -> String {
        let team = match side {
            TeamSide::Home => "Home",
            TeamSide::Away => "Away",
        };

        let zone = match zone {
            BallZone::DefensiveThird => "defensive third",
            BallZone::MiddleThird => "midfield",
            BallZone::AttackingThird => "attacking third",
        };

        let verb = match self {
            MatchEvent::PassCompleted => "keeps possession with a pass",
            MatchEvent::PassIntercepted => "loses it to an interception",
            MatchEvent::DribbleWon => "beats a marker on the dribble",
            MatchEvent::DribbleLost => "is dispossessed",
            MatchEvent::ShotOnTarget => "fires a shot on target",
            MatchEvent::ShotOffTarget => "shoots off target",
            MatchEvent::TackleWon => "wins a tackle",
            MatchEvent::Foul => "commits a foul",
        };

        format!("{minute:02}' {team} {verb} in the {zone}.")
    }
}
