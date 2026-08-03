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
        self.ball_zone = Zone::Midfield;
        self.possession = Side::Home;
        self.first_half_stoppage = rng.random_range(0..=self.config.stoppage_time_max);

        let evt = MatchEvent::new(0, EventType::KickOff, Side::Home, Zone::Midfield);
        self.events.push(evt.clone());

        MinuteResult {
            minute: 0,
            phase: MatchPhase::FirstHalf,
            events: vec![evt],
            home_score: 0,
            away_score: 0,
            possession: Side::Home,
            ball_zone: Zone::Midfield,
            is_finished: false,
        }
    }

    pub(super) fn start_second_half<R: Rng + ?Sized>(&mut self, rng: &mut R) -> MinuteResult {
        self.phase = MatchPhase::SecondHalf;
        // Second half starts after halftime; use at least minute 46 but never before current_minute
        let start_min = self.current_minute.max(46);
        self.current_minute = start_min;
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
            phase: MatchPhase::SecondHalf,
            events: vec![evt],
            home_score: self.home_score,
            away_score: self.away_score,
            possession: Side::Away,
            ball_zone: Zone::Midfield,
            is_finished: false,
        }
    }

    pub(super) fn start_et_second_half<R: Rng + ?Sized>(&mut self, rng: &mut R) -> MinuteResult {
        self.phase = MatchPhase::ExtraTimeSecondHalf;
        let start_min = self.current_minute.max(106);
        self.current_minute = start_min;
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
            phase: MatchPhase::ExtraTimeSecondHalf,
            events: vec![evt],
            home_score: self.home_score,
            away_score: self.away_score,
            possession: Side::Home,
            ball_zone: Zone::Midfield,
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
            self.current_minute = self.current_minute.max(90).saturating_add(1);
            let kick_off_minute = self.current_minute;
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
                phase: MatchPhase::ExtraTimeFirstHalf,
                events: vec![evt],
                home_score: self.home_score,
                away_score: self.away_score,
                possession: Side::Home,
                ball_zone: Zone::Midfield,
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
                phase: MatchPhase::PenaltyShootout,
                events: vec![evt],
                home_score: self.home_score,
                away_score: self.away_score,
                possession: self.possession,
                ball_zone: Zone::Midfield,
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

        // Track possession
        match self.possession {
            Side::Home => self.home_possession_ticks += 1,
            Side::Away => self.away_possession_ticks += 1,
        }

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
            phase: self.phase,
            events: minute_events,
            home_score: self.home_score,
            away_score: self.away_score,
            possession: self.possession,
            ball_zone: self.ball_zone,
            is_finished: self.phase == MatchPhase::Finished,
        }
    }

    fn check_phase_end<R: Rng + ?Sized>(&mut self, minute: u8, _rng: &mut R) -> Vec<MatchEvent> {
        let mut events = Vec::new();
        match self.phase {
            MatchPhase::FirstHalf if minute >= 45 + self.first_half_stoppage => {
                self.phase = MatchPhase::HalfTime;
                let evt = MatchEvent::new(minute, EventType::HalfTime, Side::Home, Zone::Midfield);
                self.events.push(evt.clone());
                events.push(evt);
            }
            MatchPhase::SecondHalf if minute >= 90 + self.second_half_stoppage => {
                self.phase = MatchPhase::FullTime;
                let evt = MatchEvent::new(minute, EventType::FullTime, Side::Home, Zone::Midfield);
                self.events.push(evt.clone());
                events.push(evt);
            }
            MatchPhase::ExtraTimeFirstHalf if minute >= 105 + self.et_first_half_stoppage => {
                self.phase = MatchPhase::ExtraTimeHalfTime;
                let evt = MatchEvent::new(minute, EventType::HalfTime, Side::Home, Zone::Midfield);
                self.events.push(evt.clone());
                events.push(evt);
            }
            MatchPhase::ExtraTimeSecondHalf if minute >= 120 + self.et_second_half_stoppage => {
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
            phase: self.phase,
            events: Vec::new(),
            home_score: self.home_score,
            away_score: self.away_score,
            possession: self.possession,
            ball_zone: self.ball_zone,
            is_finished: true,
        }
    }
}
