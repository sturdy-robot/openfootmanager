//! Where everyone is, for engines that actually know.
//!
//! The built-in engine resolves play over five bands and three lanes. It has no
//! coordinates and does not pretend to: a fabricated position is worse than an
//! absent one, because whatever draws it will trust it.
//!
//! An engine that does model position — one driving a 2D or 3D match — needs
//! somewhere to publish that, and it must not be the event stream. Events are
//! semantic, sparse, persisted, and read by commentary and statistics. Frames
//! are presentational, dense, disposable, and read by a renderer. Twenty-three
//! bodies at 10 Hz over ninety minutes is on the order of a million samples per
//! match, which cannot live in a saved report and cannot cross an IPC boundary
//! once a minute. So they are separate channels at separate rates, and only one
//! of them is compulsory.
//!
//! [`SpatialTelemetry`] is therefore optional and advertised: an engine sets
//! `spatial_telemetry` in its [`crate::EngineDescriptor`] and returns `Some`
//! from [`crate::LiveState::telemetry`]. Those two must agree, and the
//! compliance suite checks that they do, so the capability cannot rot into a
//! stale claim.

use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::clock::MatchClock;

/// A point on the pitch, in pitch fractions rather than metres.
///
/// `x` runs from 0.0 at the home side's goal line to 1.0 at the away side's.
/// `y` runs from 0.0 at one touchline to 1.0 at the other. Dimensionless
/// because grounds are not the same size; a renderer scales by
/// [`PitchGeometry`], and an engine never has to know what a metre is.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PitchPoint {
    pub x: f32,
    pub y: f32,
}

impl PitchPoint {
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    /// Whether this point is inside the field of play.
    ///
    /// A ball that has gone out is legitimately outside it, so this is a
    /// question rather than an invariant. What is never legitimate is a
    /// coordinate that is infinite or not a number.
    pub fn is_on_pitch(self) -> bool {
        (0.0..=1.0).contains(&self.x) && (0.0..=1.0).contains(&self.y)
    }

    /// Whether this point is a real coordinate at all.
    pub fn is_finite(self) -> bool {
        self.x.is_finite() && self.y.is_finite()
    }
}

/// The size of the ground, so a renderer can turn fractions into metres.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PitchGeometry {
    pub length_m: f32,
    pub width_m: f32,
}

impl Default for PitchGeometry {
    /// The dimensions FIFA recommends for international matches.
    fn default() -> Self {
        Self {
            length_m: 105.0,
            width_m: 68.0,
        }
    }
}

/// Where one player is, and optionally which way he is facing.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlayerPosition {
    pub player_id: Arc<str>,
    pub at: PitchPoint,
    /// Degrees clockwise from the direction this side is attacking. `None` from
    /// an engine that tracks position but not orientation.
    #[serde(default)]
    pub facing_degrees: Option<f32>,
}

/// Where the ball is, and what it is doing.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BallPosition {
    pub at: PitchPoint,
    /// Height above the turf in metres. `None` from an engine that models the
    /// pitch as flat, which is the honest answer for a 2D engine rather than
    /// reporting zero and implying the ball never leaves the ground.
    #[serde(default)]
    pub height_m: Option<f32>,
    /// Pitch fractions per second, plus metres per second vertically. `None`
    /// when the engine does not model momentum. A renderer that has this can
    /// interpolate between frames instead of stepping.
    #[serde(default)]
    pub velocity: Option<(f32, f32, f32)>,
}

/// Everyone's position at one instant.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SpatialFrame {
    pub clock: MatchClock,
    pub ball: BallPosition,
    pub home: Vec<PlayerPosition>,
    pub away: Vec<PlayerPosition>,
}

impl SpatialFrame {
    /// Everyone on the pitch, both sides.
    pub fn players(&self) -> impl Iterator<Item = &PlayerPosition> {
        self.home.iter().chain(self.away.iter())
    }
}

/// Implemented only by engines that genuinely model position.
///
/// Read-only and pulled, not pushed: the caller decides how often it wants a
/// frame, so an engine never has to guess a renderer's frame rate.
pub trait SpatialTelemetry {
    fn geometry(&self) -> PitchGeometry;

    /// Where everything is right now.
    fn frame(&self) -> SpatialFrame;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::MatchPeriod;

    #[test]
    fn the_pitch_is_a_unit_square_so_grounds_can_differ() {
        assert!(PitchPoint::new(0.0, 0.0).is_on_pitch());
        assert!(PitchPoint::new(1.0, 1.0).is_on_pitch());
        assert!(PitchPoint::new(0.5, 0.5).is_on_pitch());
    }

    #[test]
    fn a_ball_out_of_play_is_off_the_pitch_but_still_a_real_point() {
        let out = PitchPoint::new(1.04, 0.5);
        assert!(!out.is_on_pitch(), "past the goal line is out");
        assert!(out.is_finite(), "but it is still somewhere");
    }

    #[test]
    fn a_coordinate_that_is_not_a_number_is_never_acceptable() {
        // The failure a renderer cannot defend against, so the contract names it.
        assert!(!PitchPoint::new(f32::NAN, 0.5).is_finite());
        assert!(!PitchPoint::new(0.5, f32::INFINITY).is_finite());
        assert!(!PitchPoint::new(f32::NAN, 0.5).is_on_pitch());
    }

    #[test]
    fn the_default_ground_is_the_one_fifa_recommends() {
        let g = PitchGeometry::default();
        assert_eq!(g.length_m, 105.0);
        assert_eq!(g.width_m, 68.0);
    }

    #[test]
    fn a_two_dimensional_engine_says_none_rather_than_zero() {
        // Reporting height 0.0 would claim the ball never leaves the ground,
        // which is a different statement from "this engine does not model it".
        let ball = BallPosition {
            at: PitchPoint::new(0.5, 0.5),
            height_m: None,
            velocity: None,
        };
        assert!(ball.height_m.is_none());
    }

    #[test]
    fn a_frame_walks_both_sides() {
        let frame = SpatialFrame {
            clock: MatchClock::new(MatchPeriod::FirstHalf, 0),
            ball: BallPosition {
                at: PitchPoint::new(0.5, 0.5),
                height_m: Some(0.0),
                velocity: None,
            },
            home: vec![PlayerPosition {
                player_id: "h1".into(),
                at: PitchPoint::new(0.4, 0.5),
                facing_degrees: Some(90.0),
            }],
            away: vec![PlayerPosition {
                player_id: "a1".into(),
                at: PitchPoint::new(0.6, 0.5),
                facing_degrees: None,
            }],
        };
        assert_eq!(frame.players().count(), 2);
        assert!(frame.players().all(|p| p.at.is_on_pitch()));
    }

    #[test]
    fn a_frame_survives_a_serde_round_trip() {
        let frame = SpatialFrame {
            clock: MatchClock::new(MatchPeriod::SecondHalf, 61_000),
            ball: BallPosition {
                at: PitchPoint::new(0.25, 0.75),
                height_m: Some(1.8),
                velocity: Some((0.1, -0.05, 2.0)),
            },
            home: vec![],
            away: vec![],
        };
        let json = serde_json::to_string(&frame).expect("serialize");
        let back: SpatialFrame = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(frame, back);
    }
}
