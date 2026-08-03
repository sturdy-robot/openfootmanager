//! The possession chain.
//!
//! A minute of football is not a couple of isolated incidents; it is a handful
//! of spells of possession, each a run of touches that ends when the ball is
//! lost, goes out, or is put in the net.
//!
//! This module runs the clock. Each action takes a couple of seconds, the clock
//! advances by that, and play continues until the minute's live football is
//! used up — a little over a third of it, since the rest is the ball being out
//! of play, retrieved, or waiting on a set piece. What the player on the ball
//! actually *does* is chosen in `sim::action`.
//!
//! An action that starts before the minute boundary finishes rather than being
//! cut short, which is what keeps `step_minute` a clean place to make a
//! substitution: play is never interrupted mid-move.

use rand::{Rng, RngExt};

use crate::event::MatchEvent;
use crate::sim::state::Band;
use crate::shared::{tactics_break_speed_counter, tactics_counter_press_rewin};
use crate::types::{Side, TacticsConfig};

use super::LiveMatchState;

/// How long a single action takes, in seconds.
///
/// The original design drew each event's duration from this range and advanced
/// the clock by it, which is what makes the number of touches in a match fall
/// out of the simulation rather than being asserted up front.
const ACTION_SECONDS: std::ops::RangeInclusive<u32> = 1..=4;

/// Seconds of football in a minute of match time.
///
/// Not 60: the clock runs while the ball is out of play, being retrieved, or
/// waiting for a set piece, and none of that is touches. Real matches contain
/// roughly an hour of stoppages across ninety minutes, so a little under half of
/// each minute is live play.
const LIVE_SECONDS_PER_MINUTE: u32 = 37;

/// Chance that a successful action keeps the ball where it is instead of
/// carrying it forward, by where the ball currently is.
impl LiveMatchState {
    /// What happens in the moments after the ball changes hands.
    ///
    /// The side that lost it may counter-press and win it straight back; if it
    /// does not, the side that won it may break at speed. Both used to be rolled
    /// once a minute by a separate contest that ran *after* the chain had
    /// played the minute out, and which could flip possession and move the ball
    /// to midfield regardless of what had actually just happened. Here they
    /// attach to the turnover they are about.
    fn resolve_transition<R: Rng + ?Sized>(
        &mut self,
        lost_by: Side,
        lost_by_tactics: &TacticsConfig,
        won_by_tactics: &TacticsConfig,
        rng: &mut R,
    ) {
        let rewin = tactics_counter_press_rewin(lost_by_tactics);
        if rewin > 0.0 && rng.random_range(0.0..1.0f64) < rewin {
            // Won straight back. The ball stays where it was lost.
            self.possession = lost_by;
            return;
        }

        let breakaway = tactics_break_speed_counter(won_by_tactics);
        if breakaway > 0.0 && rng.random_range(0.0..1.0f64) < breakaway {
            self.ball_zone = Band::FinalThird.to_zone(self.possession);
        }
    }

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
            let own_tactics = self.team_ref(before).tactics;
            let opponent_tactics = self.team_ref(before.opposite()).tactics;

            events.extend(self.resolve_action(minute, rng));
            seconds += rng.random_range(ACTION_SECONDS);

            // The ball changed hands: counter-press and break speed belong to
            // this moment, not to a roll made once a minute.
            if self.possession != before {
                self.resolve_transition(before, &own_tactics, &opponent_tactics, rng);
            }

        }

        events
    }
}

