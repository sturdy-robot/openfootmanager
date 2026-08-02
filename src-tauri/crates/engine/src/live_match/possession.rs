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
use crate::types::{DefensiveShape, PressingIntensity, TacticsBuildUpStyle, TacticsConfig, Tempo};

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
fn base_retention(band: Band) -> f64 {
    match band {
        Band::OwnBox => 0.71,
        Band::OwnThird => 0.80,
        Band::Middle => 0.82,
        Band::FinalThird => 0.76,
        // The box resolves to a shot; nothing is retained there.
        Band::OppBox => 0.0,
    }
}

/// How likely this side is to circulate the ball rather than drive it forward,
/// given how both sides are set up.
///
/// This is where tactics reach the football. They used to be modifiers on
/// outcome rolls — a few percent on whether a pass came off — which is
/// statistically invisible on a stat sheet: measured across all twenty dial
/// settings, completed passes spanned six percent in total, and the dial named
/// for how a team builds play moved them by one and a half.
///
/// Retention is a better place to apply them because it compounds. A side
/// choosing to circulate makes that choice hundreds of times a match, so a
/// modest per-action difference becomes a visible difference in passes,
/// possession and where the ball spends the game.
///
/// Neutral options remain exactly 1.0, so a team that has not been given
/// instructions plays the calibrated baseline. That is a normalisation, not the
/// old problem: the magnitudes below are applied to a choice made every touch,
/// not to a single success roll.
fn retention_chance(band: Band, own: &TacticsConfig, opponent: &TacticsConfig) -> f64 {
    let mut chance = base_retention(band);
    if chance <= 0.0 {
        return 0.0;
    }

    // Patient sides work the ball; direct sides move it on.
    chance *= match own.tempo {
        Tempo::Patient => 1.10,
        Tempo::Direct => 1.0,
    };

    // Build-up style is about getting out of your own half specifically, so it
    // only applies deep — a long-ball side still plays normally once up.
    if matches!(band, Band::OwnBox | Band::OwnThird) {
        chance *= match own.build_up_style {
            TacticsBuildUpStyle::Short => 1.09,
            TacticsBuildUpStyle::Mixed => 1.0,
            TacticsBuildUpStyle::Long => 0.82,
        };
    }

    // A compact block is harder to play through, so the ball goes sideways;
    // a stretched one leaves gaps to run into.
    chance *= match opponent.defensive_shape {
        DefensiveShape::Compact => 1.05,
        DefensiveShape::Normal => 1.0,
        DefensiveShape::Stretched => 0.96,
    };

    // Being pressed forces the ball to be moved rather than held.
    chance *= match opponent.pressing_intensity {
        PressingIntensity::Aggressive => 0.95,
        PressingIntensity::Medium => 1.0,
        PressingIntensity::Passive => 1.04,
    };

    chance.clamp(0.0, 0.97)
}


/// How often a long-ball side skips a band when it does progress.
const LONG_BALL_SKIP_CHANCE: f64 = 0.45;

/// Whether this side plays through the middle or over it.
///
/// Only from deep: hitting it long is about bypassing midfield, not about how a
/// side plays once it is already there.
fn long_ball_skips_a_band(band: Band, own: &TacticsConfig) -> bool {
    matches!(band, Band::OwnBox | Band::OwnThird)
        && matches!(own.build_up_style, TacticsBuildUpStyle::Long)
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
            let own_tactics = self.team_ref(before).tactics.clone();
            let opponent_tactics = self.team_ref(before.opposite()).tactics.clone();

            events.extend(self.resolve_action(minute, rng));
            seconds += rng.random_range(ACTION_SECONDS);

            // The action kept the ball and did not resolve to a set piece or a
            // shot: decide whether the side circulates it or drives forward.
            // `resolve_action` has already moved the ball on its own terms, so
            // this only pulls it back to where it was.
            if self.possession == before && band != Band::OppBox {
                if rng.random_range(0.0..1.0f64)
                    < retention_chance(band, &own_tactics, &opponent_tactics)
                {
                    self.ball_zone = band.to_zone(before);
                } else if long_ball_skips_a_band(band, &own_tactics)
                    && rng.random_range(0.0..1.0f64) < LONG_BALL_SKIP_CHANCE
                {
                    // Hitting it long: the ball bypasses the middle rather than
                    // being worked through it. This is the difference a
                    // build-up instruction is supposed to make, and it only
                    // shows up if the dial changes where the ball goes rather
                    // than how likely a pass is to come off.
                    let landed = Band::from_zone(self.ball_zone, before);
                    if let Some(further) = landed.advanced() {
                        self.ball_zone = further.to_zone(before);
                    }
                }
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
            let chance = base_retention(band);
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
        assert_eq!(base_retention(Band::OppBox), 0.0);
    }

    #[test]
    fn sides_circulate_more_deep_than_in_the_final_third() {
        assert!(base_retention(Band::Middle) > base_retention(Band::FinalThird));
    }
}
