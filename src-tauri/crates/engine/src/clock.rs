//! Match time, precise enough for any engine to report and any consumer to order.
//!
//! The engine has always kept time as a single running `u8` minute, which is
//! enough for a stat sheet and not enough for anything else. A replay needs to
//! reissue a command at the moment it was given, not at the top of the minute
//! it fell in. Two events in the same minute need a defined order. And an
//! engine that resolves play continuously has no minute to report until the
//! minute is over.
//!
//! So the clock a match reports is period-relative and measured in
//! milliseconds, with the football-convention minute derived from it for
//! display. `period_elapsed_ms` is the authoritative value; `display_minute`
//! and `added_minute` exist so the UI can write "45+2" without every consumer
//! re-deriving the convention.
//!
//! This module is pure arithmetic. It reads no match state and changes no
//! behaviour.

use serde::{Deserialize, Serialize};

/// A period of play. Distinct from `MatchPhase`, which also covers the
/// intervals between periods and the state after the match.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum MatchPeriod {
    FirstHalf,
    SecondHalf,
    ExtraTimeFirstHalf,
    ExtraTimeSecondHalf,
    /// Kicks are numbered, not timed. The clock stops meaning anything here and
    /// reports the end of extra time.
    PenaltyShootout,
}

const MS_PER_MINUTE: u32 = 60_000;

impl MatchPeriod {
    /// The match minute this period opens on, in football's 1-based numbering.
    pub fn first_minute(self) -> u8 {
        match self {
            MatchPeriod::FirstHalf => 1,
            MatchPeriod::SecondHalf => 46,
            MatchPeriod::ExtraTimeFirstHalf => 91,
            MatchPeriod::ExtraTimeSecondHalf => 106,
            MatchPeriod::PenaltyShootout => 121,
        }
    }

    /// Regulation length in whole minutes, before any added time.
    pub fn regulation_minutes(self) -> u8 {
        match self {
            MatchPeriod::FirstHalf | MatchPeriod::SecondHalf => 45,
            MatchPeriod::ExtraTimeFirstHalf | MatchPeriod::ExtraTimeSecondHalf => 15,
            MatchPeriod::PenaltyShootout => 0,
        }
    }

    /// The last minute shown before the clock starts adding time.
    pub fn last_regulation_minute(self) -> u8 {
        match self {
            MatchPeriod::PenaltyShootout => 120,
            other => other.first_minute() + other.regulation_minutes() - 1,
        }
    }
}

/// Where a match is in time.
///
/// Ordering is by period then elapsed time within it, which is the order play
/// actually happened in. Two events sharing a clock are separated by their
/// sequence number, not by this.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct MatchClock {
    pub period: MatchPeriod,
    /// Milliseconds since this period kicked off. Authoritative.
    pub period_elapsed_ms: u32,
}

impl MatchClock {
    pub fn new(period: MatchPeriod, period_elapsed_ms: u32) -> Self {
        Self {
            period,
            period_elapsed_ms,
        }
    }

    /// Build a clock from a whole-minute match clock.
    ///
    /// This is how the built-in engine reports time without changing what it
    /// simulates: it still resolves a minute at a time, and a minute-resolution
    /// engine is entitled to report minute-resolution timestamps. `minute` is
    /// the running match minute in football numbering, so 47 is two minutes
    /// into the second half.
    pub fn from_match_minute(period: MatchPeriod, minute: u8) -> Self {
        let elapsed = minute.saturating_sub(period.first_minute()) as u32;
        Self::new(period, elapsed * MS_PER_MINUTE)
    }

    /// Whole minutes elapsed in this period.
    pub fn elapsed_minutes(self) -> u32 {
        self.period_elapsed_ms / MS_PER_MINUTE
    }

    /// The minute a broadcast would show. Capped at the period's regulation
    /// end, because football shows "45+2", never "47".
    pub fn display_minute(self) -> u8 {
        let raw = self.period.first_minute() as u32 + self.elapsed_minutes();
        raw.min(self.period.last_regulation_minute() as u32) as u8
    }

    /// The N in "45+N", or `None` during regulation time.
    pub fn added_minute(self) -> Option<u8> {
        let elapsed = self.elapsed_minutes();
        let regulation = self.period.regulation_minutes() as u32;
        (elapsed >= regulation && regulation > 0).then(|| (elapsed - regulation + 1) as u8)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ms(minutes: u32) -> u32 {
        minutes * MS_PER_MINUTE
    }

    #[test]
    fn a_period_knows_where_it_starts_and_ends() {
        assert_eq!(MatchPeriod::FirstHalf.first_minute(), 1);
        assert_eq!(MatchPeriod::FirstHalf.last_regulation_minute(), 45);
        assert_eq!(MatchPeriod::SecondHalf.first_minute(), 46);
        assert_eq!(MatchPeriod::SecondHalf.last_regulation_minute(), 90);
        assert_eq!(MatchPeriod::ExtraTimeFirstHalf.first_minute(), 91);
        assert_eq!(MatchPeriod::ExtraTimeFirstHalf.last_regulation_minute(), 105);
        assert_eq!(MatchPeriod::ExtraTimeSecondHalf.first_minute(), 106);
        assert_eq!(
            MatchPeriod::ExtraTimeSecondHalf.last_regulation_minute(),
            120
        );
    }

    #[test]
    fn the_first_whistle_is_the_first_minute() {
        // Football counts the opening minute as 1, not 0.
        let kickoff = MatchClock::new(MatchPeriod::FirstHalf, 0);
        assert_eq!(kickoff.display_minute(), 1);
        assert_eq!(kickoff.added_minute(), None);
    }

    #[test]
    fn each_half_opens_on_its_own_number() {
        assert_eq!(
            MatchClock::new(MatchPeriod::SecondHalf, 0).display_minute(),
            46
        );
        assert_eq!(
            MatchClock::new(MatchPeriod::ExtraTimeFirstHalf, 0).display_minute(),
            91
        );
        assert_eq!(
            MatchClock::new(MatchPeriod::ExtraTimeSecondHalf, 0).display_minute(),
            106
        );
    }

    #[test]
    fn a_half_runs_out_at_its_regulation_end() {
        let last = MatchClock::new(MatchPeriod::FirstHalf, ms(44));
        assert_eq!(last.display_minute(), 45);
        assert_eq!(last.added_minute(), None);

        let last_second = MatchClock::new(MatchPeriod::SecondHalf, ms(44));
        assert_eq!(last_second.display_minute(), 90);
        assert_eq!(last_second.added_minute(), None);
    }

    #[test]
    fn stoppage_reads_as_forty_five_plus_n_not_forty_seven() {
        // The whole reason display_minute is capped.
        let first = MatchClock::new(MatchPeriod::FirstHalf, ms(45));
        assert_eq!(first.display_minute(), 45);
        assert_eq!(first.added_minute(), Some(1));

        let second = MatchClock::new(MatchPeriod::FirstHalf, ms(46));
        assert_eq!(second.display_minute(), 45);
        assert_eq!(second.added_minute(), Some(2));

        let late = MatchClock::new(MatchPeriod::SecondHalf, ms(48));
        assert_eq!(late.display_minute(), 90);
        assert_eq!(late.added_minute(), Some(4));
    }

    #[test]
    fn extra_time_adds_time_too() {
        let et = MatchClock::new(MatchPeriod::ExtraTimeFirstHalf, ms(15));
        assert_eq!(et.display_minute(), 105);
        assert_eq!(et.added_minute(), Some(1));
    }

    #[test]
    fn sub_minute_time_does_not_advance_the_displayed_minute() {
        // A continuous engine reports millisecond time; the broadcast minute
        // only ticks on the minute.
        let early = MatchClock::new(MatchPeriod::FirstHalf, 59_999);
        assert_eq!(early.display_minute(), 1);
        let just_after = MatchClock::new(MatchPeriod::FirstHalf, 60_000);
        assert_eq!(just_after.display_minute(), 2);
    }

    #[test]
    fn a_whole_minute_clock_round_trips_through_the_period() {
        // How the built-in engine reports time without changing behaviour.
        for minute in [1u8, 23, 45] {
            let clock = MatchClock::from_match_minute(MatchPeriod::FirstHalf, minute);
            assert_eq!(clock.display_minute(), minute, "first half minute {minute}");
        }
        for minute in [46u8, 70, 90] {
            let clock = MatchClock::from_match_minute(MatchPeriod::SecondHalf, minute);
            assert_eq!(clock.display_minute(), minute, "second half minute {minute}");
        }
        // Minute 46 is the first added minute, so 47 reads "45+2".
        let stoppage = MatchClock::from_match_minute(MatchPeriod::FirstHalf, 47);
        assert_eq!(stoppage.display_minute(), 45);
        assert_eq!(stoppage.added_minute(), Some(2));
    }

    #[test]
    fn a_minute_before_the_period_started_clamps_rather_than_wrapping() {
        // saturating_sub, because a u8 underflow here would report minute 251.
        let clock = MatchClock::from_match_minute(MatchPeriod::SecondHalf, 10);
        assert_eq!(clock.period_elapsed_ms, 0);
        assert_eq!(clock.display_minute(), 46);
    }

    #[test]
    fn the_shootout_has_no_running_clock() {
        let clock = MatchClock::new(MatchPeriod::PenaltyShootout, 0);
        assert_eq!(clock.display_minute(), 120);
        assert_eq!(clock.added_minute(), None, "kicks are numbered, not timed");
    }

    #[test]
    fn clocks_order_by_period_then_by_time() {
        let first_late = MatchClock::new(MatchPeriod::FirstHalf, ms(50));
        let second_early = MatchClock::new(MatchPeriod::SecondHalf, 0);
        assert!(
            first_late < second_early,
            "stoppage in the first half still precedes the second half kick-off"
        );

        let early = MatchClock::new(MatchPeriod::SecondHalf, ms(3));
        let later = MatchClock::new(MatchPeriod::SecondHalf, ms(4));
        assert!(early < later);
    }

    #[test]
    fn a_clock_survives_a_serde_round_trip() {
        let clock = MatchClock::new(MatchPeriod::ExtraTimeSecondHalf, 123_456);
        let json = serde_json::to_string(&clock).expect("serialize");
        let back: MatchClock = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(clock, back);
    }
}
