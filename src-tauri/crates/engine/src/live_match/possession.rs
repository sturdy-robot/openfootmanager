//! The possession chain.
//!
//! A minute of football is not a couple of isolated incidents; it is a handful
//! of spells of possession, each a run of touches that ends when the ball is
//! lost, goes out, or is put in the net. The engine used to resolve one to three
//! actions per minute and leave it there, which produced roughly 180 actions a
//! match against a real figure in the high hundreds — and meant a stat sheet
//! where midfielders completed six passes in ninety minutes and forwards
//! completed none.
//!
//! This module runs the ball instead. Each action takes time, the clock advances
//! by that time, and play continues until the minute is used up. Every action
//! still resolves through the same code as before; what changes is how many of
//! them there are, and that most of them keep the ball rather than drive it
//! forward.
//!
//! # Why retention matters
//!
//! Multiplying the action count without changing anything else would multiply
//! chance creation with it: five times the actions would carry the ball into the
//! box five times as often. Real football does not work that way, because most
//! touches are sideways or backwards — keeping the ball, not progressing it.
//!
//! So a successful action now either **progresses** the ball or **retains** it.
//! Retention is what lets pass volume rise to a realistic level while shots and
//! goals stay where they were. It is the single knob that ties this stage's
//! event volume to the calibration recorded in `sim-bench/baselines`.

use rand::{Rng, RngExt};

use crate::event::MatchEvent;
use crate::sim::state::Band;

use super::LiveMatchState;

/// How long a single action takes, in seconds.
///
/// The original design drew each event's duration from this range and advanced
/// the clock by it, which is what makes the number of touches in a match fall
/// out of the simulation rather than being asserted up front.
const ACTION_SECONDS: std::ops::RangeInclusive<u32> = 2..=8;

/// Seconds of football in a minute of match time.
///
/// Not 60: the clock runs while the ball is out of play, being retrieved, or
/// waiting for a set piece, and none of that is touches. Real matches contain
/// roughly an hour of stoppages across ninety minutes, so a little under half of
/// each minute is live play.
const LIVE_SECONDS_PER_MINUTE: u32 = 26;

/// Chance that a successful action keeps the ball where it is instead of
/// carrying it forward, by where the ball currently is.
///
/// Highest deep, where sides circulate the ball; lowest in the final third,
/// where the point is to get a shot away. These are what hold shot volume at
/// its calibrated level now that there are far more actions per match — see the
/// module comment.
fn retention_chance(band: Band) -> f64 {
    match band {
        Band::OwnBox => 0.71,
        Band::OwnThird => 0.80,
        Band::Middle => 0.82,
        Band::FinalThird => 0.76,
        // The box resolves to a shot; nothing is retained there.
        Band::OppBox => 0.0,
    }
}

impl LiveMatchState {
    /// Play out one minute as spells of possession.
    ///
    /// Actions run until the minute's live seconds are spent. An action that
    /// starts before the boundary finishes, rather than being cut in half —
    /// which is also what keeps `step_minute` a clean place for a substitution,
    /// since play is never interrupted mid-move.
    pub(super) fn play_possession_chain<R: Rng + ?Sized>(
        &mut self,
        minute: u8,
        rng: &mut R,
    ) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        let mut seconds = 0;

        while seconds < LIVE_SECONDS_PER_MINUTE {
            let before = self.possession;
            let band = Band::from_zone(self.ball_zone, before);

            events.extend(self.resolve_action(minute, rng));
            seconds += rng.random_range(ACTION_SECONDS);

            // The action kept the ball and did not resolve to a set piece or a
            // shot: decide whether the side circulates it or drives forward.
            // `resolve_action` has already moved the ball on its own terms, so
            // this only pulls it back to where it was.
            if self.possession == before
                && band != Band::OppBox
                && rng.random_range(0.0..1.0f64) < retention_chance(band)
            {
                self.ball_zone = band.to_zone(before);
            }
        }

        events
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retention_is_a_probability_everywhere() {
        for band in [
            Band::OwnBox,
            Band::OwnThird,
            Band::Middle,
            Band::FinalThird,
            Band::OppBox,
        ] {
            let chance = retention_chance(band);
            assert!(
                (0.0..=1.0).contains(&chance),
                "{band:?} has retention {chance}"
            );
        }
    }

    #[test]
    fn nothing_is_retained_in_the_box() {
        // A possession that reaches the box resolves to a shot rather than
        // circulating, or chances would never be taken.
        assert_eq!(retention_chance(Band::OppBox), 0.0);
    }

    #[test]
    fn sides_circulate_more_deep_than_in_the_final_third() {
        assert!(retention_chance(Band::Middle) > retention_chance(Band::FinalThird));
    }
}
