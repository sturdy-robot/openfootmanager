//! Where the ball is, from the point of view of whoever has it.
//!
//! [`crate::types::Zone`] names regions of the pitch in absolute terms
//! (`HomeBox` … `AwayBox`) and stays the serialized form, so saved matches keep
//! loading. It is awkward to reason with while play is running, though: every
//! question about the ball has to be asked relative to a `Side`, which is why
//! the resolution code is littered with `Zone::attacking_third(side)`.
//!
//! [`Band`] is the same five regions seen from the attacking side. A turnover
//! is then just a mirror, which is how the original design handled it: the
//! Python engine stored the pitch attacker-relative and flipped the index when
//! possession changed.

use crate::types::{Side, Zone};

/// How far up the pitch the ball is, from the perspective of the side holding
/// it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Band {
    /// Their own penalty area — goalkeeper in possession, defenders under
    /// pressure.
    OwnBox,
    /// Their own third.
    OwnThird,
    /// The middle of the pitch.
    Middle,
    /// The opponent's third: crossing and dribbling territory.
    FinalThird,
    /// The opponent's penalty area, where shots come from.
    OppBox,
}

impl Band {
    /// The band as seen by the other side, for when possession changes.
    ///
    /// A side pinned in its own box has, from the opponent's view, the ball in
    /// the opponent's box.
    pub fn mirror(self) -> Band {
        match self {
            Band::OwnBox => Band::OppBox,
            Band::OwnThird => Band::FinalThird,
            Band::Middle => Band::Middle,
            Band::FinalThird => Band::OwnThird,
            Band::OppBox => Band::OwnBox,
        }
    }

    /// One band closer to the opponent's goal, or `None` in the box already.
    pub fn advanced(self) -> Option<Band> {
        match self {
            Band::OwnBox => Some(Band::OwnThird),
            Band::OwnThird => Some(Band::Middle),
            Band::Middle => Some(Band::FinalThird),
            Band::FinalThird => Some(Band::OppBox),
            Band::OppBox => None,
        }
    }

    /// One band back towards their own goal, or `None` when already there.
    pub fn retreated(self) -> Option<Band> {
        match self {
            Band::OwnBox => None,
            Band::OwnThird => Some(Band::OwnBox),
            Band::Middle => Some(Band::OwnThird),
            Band::FinalThird => Some(Band::Middle),
            Band::OppBox => Some(Band::FinalThird),
        }
    }

    /// Read an absolute zone from `attacker`'s point of view.
    pub fn from_zone(zone: Zone, attacker: Side) -> Band {
        let band = match zone {
            Zone::HomeBox => Band::OwnBox,
            Zone::HomeDefense => Band::OwnThird,
            Zone::Midfield => Band::Middle,
            Zone::AwayDefense => Band::FinalThird,
            Zone::AwayBox => Band::OppBox,
        };
        // The mapping above reads the pitch as the home side sees it.
        match attacker {
            Side::Home => band,
            Side::Away => band.mirror(),
        }
    }

    /// Back to the absolute zone that gets stored on an event.
    pub fn to_zone(self, attacker: Side) -> Zone {
        let home_view = match attacker {
            Side::Home => self,
            Side::Away => self.mirror(),
        };
        match home_view {
            Band::OwnBox => Zone::HomeBox,
            Band::OwnThird => Zone::HomeDefense,
            Band::Middle => Zone::Midfield,
            Band::FinalThird => Zone::AwayDefense,
            Band::OppBox => Zone::AwayBox,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ALL: [Band; 5] = [
        Band::OwnBox,
        Band::OwnThird,
        Band::Middle,
        Band::FinalThird,
        Band::OppBox,
    ];

    #[test]
    fn mirroring_twice_returns_the_original() {
        for band in ALL {
            assert_eq!(band.mirror().mirror(), band);
        }
    }

    #[test]
    fn the_middle_is_the_same_for_both_sides() {
        assert_eq!(Band::Middle.mirror(), Band::Middle);
    }

    #[test]
    fn a_zone_round_trips_through_either_side() {
        for zone in [
            Zone::HomeBox,
            Zone::HomeDefense,
            Zone::Midfield,
            Zone::AwayDefense,
            Zone::AwayBox,
        ] {
            for side in [Side::Home, Side::Away] {
                assert_eq!(
                    Band::from_zone(zone, side).to_zone(side),
                    zone,
                    "{zone:?} did not round trip for {side:?}"
                );
            }
        }
    }

    #[test]
    fn the_two_sides_read_the_same_zone_oppositely() {
        // The home box is home's own box and away's shooting position.
        assert_eq!(Band::from_zone(Zone::HomeBox, Side::Home), Band::OwnBox);
        assert_eq!(Band::from_zone(Zone::HomeBox, Side::Away), Band::OppBox);
    }

    #[test]
    fn advancing_and_retreating_are_inverses() {
        for band in ALL {
            if let Some(forward) = band.advanced() {
                assert_eq!(forward.retreated(), Some(band));
            }
        }
    }

    #[test]
    fn the_pitch_ends_where_you_would_expect() {
        assert_eq!(Band::OppBox.advanced(), None);
        assert_eq!(Band::OwnBox.retreated(), None);
    }
}
