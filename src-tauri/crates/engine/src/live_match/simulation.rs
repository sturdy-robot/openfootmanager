use rand::{Rng, RngExt};

use crate::event::{EventType, MatchEvent};
use crate::types::{Side, Zone};

use super::{LiveMatchState, MatchPhase, MinuteResult};

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

impl LiveMatchState {
    pub(super) fn start_match<R: Rng + ?Sized>(&mut self, rng: &mut R) -> MinuteResult {
        self.phase = MatchPhase::FirstHalf;
        self.current_minute = 0;
        self.half_started_at = self.current_minute.saturating_add(1);
        self.ball_zone = Zone::Midfield;
        self.possession = Side::Home;
        self.first_half_stoppage = rng.random_range(0..=self.config.stoppage_time_max);

        let evt = MatchEvent::new(0, EventType::KickOff, Side::Home, Zone::Midfield);
        self.events.push(evt.clone());

        MinuteResult {
            minute: 0,

            clock: self.clock(),
            phase: MatchPhase::FirstHalf,
            events: vec![evt],
            home_score: 0,
            away_score: 0,
            possession: Side::Home,
            is_finished: false,
        }
    }

    pub(super) fn start_second_half<R: Rng + ?Sized>(&mut self, rng: &mut R) -> MinuteResult {
        self.phase = MatchPhase::SecondHalf;
        // The kick-off sits on the whistle that ended the half before it, the
        // way the first half's kick-off sits on minute 0 and play starts at 1.
        // At 46 it consumed a minute of football: play resumed at 47 and a
        // match with no stoppage ran to 91.
        let start_min = self.current_minute.max(45);
        self.current_minute = start_min;
        self.half_started_at = start_min.saturating_add(1);
        self.ball_zone = Zone::Midfield;
        self.possession = Side::Away;
        self.second_half_stoppage = rng.random_range(0..=self.config.stoppage_time_max);

        let evt = MatchEvent::new(
            start_min,
            EventType::SecondHalfStart,
            Side::Away,
            Zone::Midfield,
        );
        self.events.push(evt.clone());

        MinuteResult {
            minute: start_min,

            clock: self.clock(),
            phase: MatchPhase::SecondHalf,
            events: vec![evt],
            home_score: self.home_score,
            away_score: self.away_score,
            possession: Side::Away,
            is_finished: false,
        }
    }

    pub(super) fn start_et_second_half<R: Rng + ?Sized>(&mut self, rng: &mut R) -> MinuteResult {
        self.phase = MatchPhase::ExtraTimeSecondHalf;
        // Likewise: the whistle that ended the first period of extra time.
        let start_min = self.current_minute.max(105);
        self.current_minute = start_min;
        self.half_started_at = start_min.saturating_add(1);
        self.ball_zone = Zone::Midfield;
        self.possession = Side::Home;
        self.et_second_half_stoppage = rng.random_range(0..=2); // short stoppage in ET

        let evt = MatchEvent::new(
            start_min,
            EventType::SecondHalfStart,
            Side::Home,
            Zone::Midfield,
        );
        self.events.push(evt.clone());

        MinuteResult {
            minute: start_min,

            clock: self.clock(),
            phase: MatchPhase::ExtraTimeSecondHalf,
            events: vec![evt],
            home_score: self.home_score,
            away_score: self.away_score,
            possession: Side::Home,
            is_finished: false,
        }
    }

    pub(super) fn handle_full_time<R: Rng + ?Sized>(&mut self, rng: &mut R) -> MinuteResult {
        if self.allows_extra_time && self.home_score == self.away_score {
            // Go to extra time.
            //
            // Continues from where regulation actually ended rather than
            // resetting to 91. The second half runs to 90 plus stoppage, so
            // pinning extra time to 91 put its kick-off *before* the full-time
            // whistle in the event log — a log that has to stay in order for
            // replay to feed it back and for the match feed to read sensibly.
            self.phase = MatchPhase::ExtraTimeFirstHalf;
            self.current_minute = self.current_minute.max(90);
            let kick_off_minute = self.current_minute;
            self.half_started_at = kick_off_minute.saturating_add(1);
            self.ball_zone = Zone::Midfield;
            self.possession = Side::Home;
            self.et_first_half_stoppage = rng.random_range(0..=2);

            let evt = MatchEvent::new(
                kick_off_minute,
                EventType::KickOff,
                Side::Home,
                Zone::Midfield,
            );
            self.events.push(evt.clone());

            MinuteResult {
                minute: kick_off_minute,

                clock: self.clock(),
                phase: MatchPhase::ExtraTimeFirstHalf,
                events: vec![evt],
                home_score: self.home_score,
                away_score: self.away_score,
                possession: Side::Home,
                is_finished: false,
            }
        } else {
            // Match decided in normal time
            self.phase = MatchPhase::Finished;
            self.make_result(true)
        }
    }

    pub(super) fn handle_et_end<R: Rng + ?Sized>(&mut self, _rng: &mut R) -> MinuteResult {
        if self.home_score == self.away_score {
            // Go to penalty shootout
            self.phase = MatchPhase::PenaltyShootout;
            self.penalty_state = super::PenaltyShootoutState::default();

            let evt = MatchEvent::new(
                self.current_minute,
                EventType::PenaltyAwarded,
                Side::Home,
                Zone::Midfield,
            );
            self.events.push(evt.clone());

            MinuteResult {
                minute: self.current_minute,

                clock: self.clock(),
                phase: MatchPhase::PenaltyShootout,
                events: vec![evt],
                home_score: self.home_score,
                away_score: self.away_score,
                possession: self.possession,
                is_finished: false,
            }
        } else {
            self.phase = MatchPhase::Finished;
            self.make_result(true)
        }
    }

    // -----------------------------------------------------------------------
    // Core minute simulation
    // -----------------------------------------------------------------------

    pub(super) fn play_minute<R: Rng + ?Sized>(&mut self, rng: &mut R) -> MinuteResult {
        self.current_minute += 1;
        let minute = self.current_minute;

        // Possession is accumulated inside the chain, a second at a time and
        // credited to whoever was actually on the ball — see
        // `play_possession_chain`. Counting it here, once a minute, could only
        // ever say who started the minute with it.

        // Deplete stamina for all on-pitch players
        self.deplete_stamina_tick();

        // Play the minute out as spells of possession rather than a couple of
        // isolated incidents; see `possession.rs`.
        let mut minute_events = self.play_possession_chain(minute, rng);

        // Record ball zone for AI zone-pressure tracking (cap at 10)
        if self.recent_zones.len() >= 10 {
            self.recent_zones.pop_front();
        }
        self.recent_zones.push_back(self.ball_zone);

        // Check for phase transitions
        let transition_events = self.check_phase_end(minute, rng);
        minute_events.extend(transition_events);

        MinuteResult {
            minute,
            clock: self.clock_at(minute),
            phase: self.phase,
            events: minute_events,
            home_score: self.home_score,
            away_score: self.away_score,
            possession: self.possession,
            is_finished: self.phase == MatchPhase::Finished,
        }
    }

    /// The last minute of the current half: a half's length from its own
    /// kick-off, plus whatever is added on.
    fn half_ends_at(&self, length: u8, stoppage: u8) -> u8 {
        self.half_started_at
            .saturating_add(length)
            .saturating_sub(1)
            .saturating_add(stoppage)
    }

    fn check_phase_end<R: Rng + ?Sized>(&mut self, minute: u8, _rng: &mut R) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        match self.phase {
            MatchPhase::FirstHalf if minute >= self.half_ends_at(45, self.first_half_stoppage) => {
                self.phase = MatchPhase::HalfTime;
                let evt = MatchEvent::new(minute, EventType::HalfTime, Side::Home, Zone::Midfield);
                self.events.push(evt.clone());
                events.push(evt);
            }
            MatchPhase::SecondHalf
                if minute >= self.half_ends_at(45, self.second_half_stoppage) =>
            {
                self.phase = MatchPhase::FullTime;
                let evt = MatchEvent::new(minute, EventType::FullTime, Side::Home, Zone::Midfield);
                self.events.push(evt.clone());
                events.push(evt);
            }
            MatchPhase::ExtraTimeFirstHalf
                if minute >= self.half_ends_at(15, self.et_first_half_stoppage) =>
            {
                self.phase = MatchPhase::ExtraTimeHalfTime;
                let evt = MatchEvent::new(minute, EventType::HalfTime, Side::Home, Zone::Midfield);
                self.events.push(evt.clone());
                events.push(evt);
            }
            MatchPhase::ExtraTimeSecondHalf
                if minute >= self.half_ends_at(15, self.et_second_half_stoppage) =>
            {
                self.phase = MatchPhase::ExtraTimeEnd;
                let evt = MatchEvent::new(minute, EventType::FullTime, Side::Home, Zone::Midfield);
                self.events.push(evt.clone());
                events.push(evt);
            }
            _ => {}
        }
        events
    }

    pub(super) fn make_result(&self, _is_finished: bool) -> MinuteResult {
        MinuteResult {
            minute: self.current_minute,
            clock: self.clock(),
            phase: self.phase,
            events: Vec::new(),
            home_score: self.home_score,
            away_score: self.away_score,
            possession: self.possession,
            is_finished: true,
        }
    }
}
