use std::sync::Arc;

use crate::types::{Side, Zone};
use serde::{Deserialize, Serialize};

/// A single event that occurred during the match.
///
/// # Why the ids are `Arc<str>`
///
/// A match produces on the order of sixteen hundred of these, and each one is
/// built and then cloned — once into the match's own log, once into the minute
/// being handed back. As `String` that was two heap allocations per event and
/// the single largest remaining cost in the simulation. The engine already
/// holds a shared handle on every player's id (see `live_match::SquadCache`),
/// so an event can borrow it rather than copy the text.
///
/// This is invisible outside the engine: an `Arc<str>` serializes as the same
/// JSON string a `String` did, so saves and the match feed are unchanged.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchEvent {
    pub minute: u8,
    pub event_type: EventType,
    pub side: Side,
    pub zone: Zone,
    /// ID of the primary player involved (scorer, passer, fouler, etc.).
    pub player_id: Option<Arc<str>>,
    /// ID of a secondary player (assist provider, fouled player, etc.).
    pub secondary_player_id: Option<Arc<str>>,
    /// Optional engine-derived qualifier for richer commentary. `None` for
    /// events that carry no extra colour.
    #[serde(default)]
    pub detail: Option<EventDetail>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventType {
    // --- Structural events ---
    KickOff,
    HalfTime,
    SecondHalfStart,
    FullTime,

    // --- Possession & passing ---
    PassCompleted,
    PassIntercepted,

    // --- Attacking ---
    Dribble,
    DribbleTackled,
    Cross,

    // --- Shooting ---
    ShotOffTarget,
    ShotBlocked,
    ShotSaved,
    Goal,
    PenaltyAwarded,
    PenaltyGoal,
    PenaltyMiss,
    // Penalty-shootout kicks. Distinct from PenaltyGoal/PenaltyMiss so the
    // shootout never counts toward match goals or player stats.
    ShootoutGoal,
    ShootoutMiss,

    // --- Defending ---
    Tackle,
    Interception,
    Clearance,

    // --- Fouls & discipline ---
    Foul,
    YellowCard,
    RedCard,
    SecondYellow,

    // --- Set pieces ---
    Corner,
    FreeKick,

    // --- Other ---
    Injury,
    GoalKick,
    Substitution,
}

/// Truthful, engine-derived qualifiers used to colour commentary.
/// Every variant carries only values the engine already computes, so prose
/// built from it never claims something that was not simulated.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventDetail {
    Shot { danger: DangerBand },
    Save { quality: SaveQuality },
    Foul { severity: FoulSeverity },
    Goal { context: GoalContext },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DangerBand {
    Speculative,
    Decent,
    BigChance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SaveQuality {
    Routine,
    Strong,
    WorldClass,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FoulSeverity {
    Soft,
    Hard,
    Reckless,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GoalContext {
    Opener,
    Equaliser,
    Extends,
    Consolation,
}

impl MatchEvent {
    pub fn new(minute: u8, event_type: EventType, side: Side, zone: Zone) -> Self {
        Self {
            minute,
            event_type,
            side,
            zone,
            player_id: None,
            secondary_player_id: None,
            detail: None,
        }
    }

    /// Attach the player this event is about.
    ///
    /// Takes anything that can become a shared id: pass an `Arc<str>` from the
    /// squad cache and nothing is allocated, pass a `&str` and it is copied
    /// once. The hot paths pass the former.
    pub fn with_player(mut self, player_id: impl Into<Arc<str>>) -> Self {
        self.player_id = Some(player_id.into());
        self
    }

    pub fn with_secondary(mut self, player_id: impl Into<Arc<str>>) -> Self {
        self.secondary_player_id = Some(player_id.into());
        self
    }

    pub fn with_detail(mut self, detail: EventDetail) -> Self {
        self.detail = Some(detail);
        self
    }

    pub fn is_goal(&self) -> bool {
        matches!(self.event_type, EventType::Goal | EventType::PenaltyGoal)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Side, Zone};

    #[test]
    fn new_event_has_no_detail() {
        let evt = MatchEvent::new(10, EventType::Goal, Side::Home, Zone::AwayBox);
        assert!(evt.detail.is_none());
    }

    #[test]
    fn with_detail_attaches_and_round_trips_through_serde() {
        let evt = MatchEvent::new(10, EventType::Goal, Side::Home, Zone::AwayBox)
            .with_player("p1")
            .with_detail(EventDetail::Goal {
                context: GoalContext::Equaliser,
            });
        let json = serde_json::to_string(&evt).unwrap();
        let back: MatchEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(
            back.detail,
            Some(EventDetail::Goal {
                context: GoalContext::Equaliser
            })
        );
    }
}
