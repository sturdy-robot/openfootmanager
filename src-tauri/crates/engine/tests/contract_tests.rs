//! Tests for the engine contract itself, driven the way a second engine would
//! be driven: through trait objects, without reaching for the built-in engine's
//! concrete types.
//!
//! These are not yet the full "a third party can implement `LiveState`" suite
//! the contract work is aiming at. `MatchSnapshot` still demands a
//! `current_minute: u8`, which an engine with a continuous clock should not
//! have to invent, so the fake below leaves `snapshot()` unimplemented and says
//! so. The zone half of that complaint is now gone: neither `MinuteResult` nor
//! `MatchSnapshot` carries a `ball_zone` any more.

use engine::clock::{MatchClock, MatchPeriod};
use engine::compliance::check_capabilities;
use engine::descriptor::{EngineDescriptor, MatchCommandKind, NativeStep, CONTRACT_VERSION};
use engine::live_match::{MatchCommand, MatchPhase, MatchSnapshot, MinuteResult};
use engine::rejection::CommandRejection;
use engine::report::MatchReport;
use engine::spatial::{
    BallPosition, PitchGeometry, PitchPoint, PlayerPosition, SpatialFrame, SpatialTelemetry,
};
use engine::traits::LiveState;
use engine::{EventType, MatchEvent, Side, Zone};

// ---------------------------------------------------------------------------
// A fake engine that knows where everyone is
// ---------------------------------------------------------------------------

/// Deliberately unlike the built-in engine: it keeps continuous time, it has
/// coordinates, and it has never heard of a possession chain.
struct SpatialFake {
    elapsed_ms: u32,
    ball_x: f32,
    events: Vec<MatchEvent>,
    /// Lets a test make the fake misbehave without a second type.
    park_a_player_off_the_pitch: bool,
}

impl SpatialFake {
    fn new() -> Self {
        Self {
            elapsed_ms: 0,
            ball_x: 0.5,
            events: Vec::new(),
            park_a_player_off_the_pitch: false,
        }
    }

    fn descriptor() -> EngineDescriptor {
        EngineDescriptor {
            id: "spatial-fake",
            engine_version: 1,
            contract_version: CONTRACT_VERSION,
            native_step: NativeStep::Millis(100),
            commands: &[MatchCommandKind::Substitute],
            spatial_telemetry: true,
            extra_time: false,
            penalty_shootout: false,
            in_match_ai: false,
        }
    }
}

impl SpatialTelemetry for SpatialFake {
    fn geometry(&self) -> PitchGeometry {
        PitchGeometry::default()
    }

    fn frame(&self) -> SpatialFrame {
        let stray = if self.park_a_player_off_the_pitch {
            PitchPoint::new(1.9, 0.5)
        } else {
            PitchPoint::new(0.3, 0.4)
        };
        SpatialFrame {
            clock: MatchClock::new(MatchPeriod::FirstHalf, self.elapsed_ms),
            ball: BallPosition {
                at: PitchPoint::new(self.ball_x, 0.5),
                height_m: Some(0.2),
                velocity: Some((0.01, 0.0, 0.0)),
            },
            home: vec![PlayerPosition {
                player_id: "home_1".into(),
                at: stray,
                facing_degrees: Some(0.0),
            }],
            away: vec![PlayerPosition {
                player_id: "away_1".into(),
                at: PitchPoint::new(0.7, 0.6),
                facing_degrees: Some(180.0),
            }],
        }
    }
}

impl LiveState for SpatialFake {
    fn step_minute(&mut self, _rng: &mut dyn rand::Rng) -> MinuteResult {
        self.elapsed_ms += 60_000;
        self.ball_x = (self.ball_x + 0.05).min(1.0);
        self.events.push(MatchEvent {
            minute: MatchClock::new(MatchPeriod::FirstHalf, self.elapsed_ms).display_minute(),
            event_type: EventType::PassCompleted,
            side: Side::Home,
            zone: Zone::Midfield,
            player_id: None,
            secondary_player_id: None,
            detail: None,
        });
        MinuteResult {
            minute: MatchClock::new(MatchPeriod::FirstHalf, self.elapsed_ms).display_minute(),
            // What the neutral clock buys a continuous engine: it reports its
            // real millisecond time instead of rounding to one of our minutes.
            clock: MatchClock::new(MatchPeriod::FirstHalf, self.elapsed_ms),
            phase: MatchPhase::FirstHalf,
            events: self.events.clone(),
            home_score: 0,
            away_score: 0,
            possession: Side::Home,
            is_finished: false,
        }
    }

    fn apply_command(&mut self, cmd: MatchCommand) -> Result<(), CommandRejection> {
        // Everything except a substitution is outside what this engine models,
        // and the descriptor says so too.
        match cmd.kind() {
            MatchCommandKind::Substitute => Ok(()),
            other => Err(CommandRejection::Unsupported(other)),
        }
    }

    fn snapshot(&self) -> MatchSnapshot {
        // Left unimplemented on purpose. MatchSnapshot still requires a
        // whole-minute `current_minute`, which an engine keeping continuous
        // time does not have. That is a finding about the contract rather than
        // about this fake, and it is what the next step has to fix.
        unimplemented!("MatchSnapshot still demands a whole-minute current_minute")
    }

    fn phase(&self) -> MatchPhase {
        MatchPhase::FirstHalf
    }

    fn is_finished(&self) -> bool {
        false
    }

    fn events(&self) -> &[MatchEvent] {
        &self.events
    }

    fn engine_id(&self) -> &'static str {
        "spatial-fake"
    }

    fn minute(&self) -> u8 {
        MatchClock::new(MatchPeriod::FirstHalf, self.elapsed_ms).display_minute()
    }

    fn report(&self) -> MatchReport {
        unimplemented!("reporting is not what this fake exists to test")
    }

    fn into_report(self: Box<Self>) -> MatchReport {
        unimplemented!("reporting is not what this fake exists to test")
    }

    fn telemetry(&self) -> Option<&dyn SpatialTelemetry> {
        Some(self)
    }
}

/// A fake with no coordinates, matching the built-in engine's shape.
struct ZoneFake;

impl LiveState for ZoneFake {
    fn step_minute(&mut self, _rng: &mut dyn rand::Rng) -> MinuteResult {
        unimplemented!()
    }
    fn apply_command(&mut self, _cmd: MatchCommand) -> Result<(), CommandRejection> {
        Ok(())
    }
    fn snapshot(&self) -> MatchSnapshot {
        unimplemented!()
    }
    fn phase(&self) -> MatchPhase {
        MatchPhase::FirstHalf
    }
    fn is_finished(&self) -> bool {
        false
    }
    fn events(&self) -> &[MatchEvent] {
        &[]
    }
    fn engine_id(&self) -> &'static str {
        "zone-fake"
    }
    fn minute(&self) -> u8 {
        0
    }
    fn report(&self) -> MatchReport {
        unimplemented!()
    }
    fn into_report(self: Box<Self>) -> MatchReport {
        unimplemented!()
    }
}

// ---------------------------------------------------------------------------
// Reachability: the whole point of putting telemetry on LiveState
// ---------------------------------------------------------------------------

#[test]
fn telemetry_survives_type_erasure() {
    // A registry hands out erased states. If the spatial channel were a
    // `PositionalState: LiveState` subtrait, this is exactly where it would
    // become unreachable: there is no way back from `dyn LiveState` to a
    // subtrait object.
    let boxed: Box<dyn LiveState + Send> = Box::new(SpatialFake::new());

    let telemetry = boxed
        .telemetry()
        .expect("an engine advertising positions must hand them over through the erased state");

    let frame = telemetry.frame();
    assert_eq!(frame.players().count(), 2);
    assert!(frame.players().all(|p| p.at.is_on_pitch()));
    assert_eq!(telemetry.geometry().length_m, 105.0);
}

#[test]
fn an_engine_without_coordinates_says_so_rather_than_inventing_them() {
    let boxed: Box<dyn LiveState + Send> = Box::new(ZoneFake);
    assert!(
        boxed.telemetry().is_none(),
        "a fabricated position is worse than an absent one, because a renderer will trust it"
    );
}

#[test]
fn frames_advance_with_the_match() {
    let mut fake = SpatialFake::new();
    let before = fake.telemetry().unwrap().frame();
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(1);
    fake.step_minute(&mut rng);
    let after = fake.telemetry().unwrap().frame();

    assert!(after.clock > before.clock, "the frame clock has to move");
    assert!(
        after.ball.at.x > before.ball.at.x,
        "and so does the ball, or nothing is being reported"
    );
}

// ---------------------------------------------------------------------------
// Capability honesty
// ---------------------------------------------------------------------------

#[test]
fn an_engine_that_advertises_positions_and_supplies_them_is_compliant() {
    let state = SpatialFake::new();
    let report = check_capabilities(&state, &SpatialFake::descriptor());
    assert!(
        report.violations.is_empty(),
        "expected a clean report, got {:?}",
        report.violations
    );
}

#[test]
fn advertising_a_capability_the_engine_does_not_have_is_a_violation() {
    // The failure mode the check exists for: a descriptor claiming coordinates
    // that nothing can produce, discovered by a renderer at runtime.
    let report = check_capabilities(&ZoneFake, &SpatialFake::descriptor());
    assert_eq!(report.violations.len(), 1);
    assert!(
        report.violations[0].detail.contains("advertises spatial telemetry"),
        "got {:?}",
        report.violations[0]
    );
}

#[test]
fn supplying_positions_nobody_was_told_about_is_also_a_violation() {
    // The quieter failure: the work is done and no consumer will ever ask.
    let mut descriptor = SpatialFake::descriptor();
    descriptor.spatial_telemetry = false;
    let report = check_capabilities(&SpatialFake::new(), &descriptor);
    assert_eq!(report.violations.len(), 1);
    assert!(
        report.violations[0].detail.contains("does not advertise"),
        "got {:?}",
        report.violations[0]
    );
}

#[test]
fn a_player_parked_off_the_pitch_is_caught() {
    let mut state = SpatialFake::new();
    state.park_a_player_off_the_pitch = true;
    let report = check_capabilities(&state, &SpatialFake::descriptor());
    assert_eq!(report.violations.len(), 1);
    assert!(
        report.violations[0].detail.contains("off the field of play"),
        "got {:?}",
        report.violations[0]
    );
}

// ---------------------------------------------------------------------------
// The built-in engine
// ---------------------------------------------------------------------------

#[test]
fn the_built_in_engine_is_capability_compliant() {
    use engine::traits::{DefaultEngine, LiveEngine, MatchSetup};
    use engine::{MatchConfig, PlayStyle, PlayerData, Position, TacticsConfig, TeamData};

    fn player(id: &str, position: Position) -> PlayerData {
        PlayerData {
            id: id.to_string(),
            name: id.to_string(),
            position,
            ovr: 70,
            condition: 90,
            fitness: 75,
            pace: 70,
            stamina: 70,
            strength: 70,
            agility: 70,
            passing: 70,
            shooting: 70,
            tackling: 70,
            dribbling: 70,
            defending: 70,
            positioning: 70,
            vision: 70,
            decisions: 70,
            composure: 70,
            aggression: 70,
            teamwork: 70,
            leadership: 70,
            handling: 70,
            reflexes: 70,
            aerial: 70,
            traits: vec![],
            slot: None,
            role: engine::PlayerRole::Standard,
        }
    }

    fn team(id: &str) -> TeamData {
        let mut players = vec![player(&format!("{id}_gk"), Position::Goalkeeper)];
        for i in 0..4 {
            players.push(player(&format!("{id}_d{i}"), Position::Defender));
        }
        for i in 0..4 {
            players.push(player(&format!("{id}_m{i}"), Position::Midfielder));
        }
        for i in 0..2 {
            players.push(player(&format!("{id}_f{i}"), Position::Forward));
        }
        TeamData {
            id: id.to_string(),
            name: id.to_string(),
            formation: "4-4-2".to_string(),
            play_style: PlayStyle::Balanced,
            tactics: TacticsConfig::default(),
            players,
        }
    }

    let setup = MatchSetup::league(team("home"), team("away"), MatchConfig::default());
    let state = DefaultEngine.kickoff(setup);
    let descriptor = engine::EngineInfo::descriptor(&DefaultEngine);

    let report = check_capabilities(&state, &descriptor);
    assert!(
        report.violations.is_empty(),
        "the built-in engine advertises no telemetry and supplies none: {:?}",
        report.violations
    );
    assert!(state.telemetry().is_none());
}

// ---------------------------------------------------------------------------
// Driving an engine without naming its type
// ---------------------------------------------------------------------------

/// Stand-in for the engine registry: hands back a live match without the caller
/// knowing which engine produced it.
fn kickoff_by_id(id: &str) -> Option<Box<dyn engine::LiveState + Send>> {
    use engine::traits::{DefaultEngine, LiveEngineObject, MatchSetup};
    use engine::{MatchConfig, PlayStyle, PlayerData, Position, TacticsConfig, TeamData};

    fn player(id: &str, position: Position) -> PlayerData {
        PlayerData {
            id: id.to_string(),
            name: id.to_string(),
            position,
            ovr: 70,
            condition: 90,
            fitness: 75,
            pace: 70,
            stamina: 70,
            strength: 70,
            agility: 70,
            passing: 70,
            shooting: 70,
            tackling: 70,
            dribbling: 70,
            defending: 70,
            positioning: 70,
            vision: 70,
            decisions: 70,
            composure: 70,
            aggression: 70,
            teamwork: 70,
            leadership: 70,
            handling: 70,
            reflexes: 70,
            aerial: 70,
            traits: vec![],
            slot: None,
            role: engine::PlayerRole::Standard,
        }
    }
    fn team(id: &str) -> TeamData {
        let mut players = vec![player(&format!("{id}_gk"), Position::Goalkeeper)];
        for i in 0..4 {
            players.push(player(&format!("{id}_d{i}"), Position::Defender));
        }
        for i in 0..4 {
            players.push(player(&format!("{id}_m{i}"), Position::Midfielder));
        }
        for i in 0..2 {
            players.push(player(&format!("{id}_f{i}"), Position::Forward));
        }
        TeamData {
            id: id.to_string(),
            name: id.to_string(),
            formation: "4-4-2".to_string(),
            play_style: PlayStyle::Balanced,
            tactics: TacticsConfig::default(),
            players,
        }
    }

    if id != engine::DEFAULT_ENGINE_ID {
        return None;
    }
    let setup = MatchSetup::league(team("home"), team("away"), MatchConfig::default());
    Some(DefaultEngine.kickoff_boxed(setup))
}

#[test]
fn a_match_can_be_played_to_a_report_without_naming_the_engine() {
    // This is the whole contract in one test. Before `into_report` took
    // `Box<Self>` the last line was E0161: a dynamically dispatched match could
    // be played and never finished.
    let mut state = kickoff_by_id(engine::DEFAULT_ENGINE_ID).expect("known engine");
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(20260802);

    let mut guard = 0;
    while !state.is_finished() && guard < 200 {
        state.step_minute(&mut rng);
        guard += 1;
    }
    assert!(state.is_finished(), "the match should reach full time");

    let report = state.into_report();
    assert!(
        report.total_minutes >= 90,
        "a finished match runs at least ninety minutes, got {}",
        report.total_minutes
    );
}

#[test]
fn an_unknown_engine_id_is_declined_rather_than_guessed() {
    assert!(kickoff_by_id("no-such-engine").is_none());
}

// ---------------------------------------------------------------------------
// The clock the engine reports
// ---------------------------------------------------------------------------

#[test]
fn every_phase_maps_to_the_period_whose_clock_is_showing() {
    use engine::clock::MatchPeriod as P;
    use engine::MatchPhase as Ph;

    // An interval reports the period that just ended, because that is what the
    // clock on the wall still reads.
    assert_eq!(Ph::PreKickOff.period(0), P::FirstHalf);
    assert_eq!(Ph::FirstHalf.period(20), P::FirstHalf);
    assert_eq!(Ph::HalfTime.period(47), P::FirstHalf);
    assert_eq!(Ph::SecondHalf.period(60), P::SecondHalf);
    assert_eq!(Ph::FullTime.period(93), P::SecondHalf);
    assert_eq!(Ph::ExtraTimeFirstHalf.period(100), P::ExtraTimeFirstHalf);
    assert_eq!(Ph::ExtraTimeHalfTime.period(106), P::ExtraTimeFirstHalf);
    assert_eq!(Ph::ExtraTimeSecondHalf.period(115), P::ExtraTimeSecondHalf);
    assert_eq!(Ph::ExtraTimeEnd.period(122), P::ExtraTimeSecondHalf);
    assert_eq!(Ph::PenaltyShootout.period(120), P::PenaltyShootout);
}

#[test]
fn a_finished_match_is_placed_by_its_minute() {
    use engine::clock::MatchPeriod as P;
    use engine::MatchPhase as Ph;

    // Finished is the one phase that cannot place itself: a match ends at full
    // time, at the end of extra time, or after a shootout.
    assert_eq!(Ph::Finished.period(93), P::SecondHalf, "ended in stoppage");
    assert_eq!(Ph::Finished.period(123), P::ExtraTimeSecondHalf);
}

#[test]
fn the_reported_clock_reads_stoppage_as_forty_five_plus_n() {
    // The engine keeps one running minute on an absolute scale, so a first
    // half that runs to 47 is 45+2 and a second half that runs to 93 is 90+3.
    // Nothing downstream had a way to say that before.
    let clock = engine::clock::MatchClock::from_match_minute(
        engine::MatchPhase::FirstHalf.period(47),
        47,
    );
    assert_eq!(clock.display_minute(), 45);
    assert_eq!(clock.added_minute(), Some(2));

    let second = engine::clock::MatchClock::from_match_minute(
        engine::MatchPhase::SecondHalf.period(93),
        93,
    );
    assert_eq!(second.display_minute(), 90);
    assert_eq!(second.added_minute(), Some(3));
}

#[test]
fn a_live_match_reports_a_clock_that_tracks_its_minute() {
    let mut state = kickoff_by_id(engine::DEFAULT_ENGINE_ID).expect("known engine");
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(7);

    let mut guard = 0;
    while !state.is_finished() && guard < 200 {
        let result = state.step_minute(&mut rng);
        // Two readings of one instant. The broadcast minute never runs ahead
        // of the engine's running minute, except at kick-off, where football
        // counts the opening minute as 1 and the engine counts elapsed as 0.
        assert!(
            result.clock.display_minute() <= result.minute.max(1),
            "clock read {} while the running minute was {}",
            result.clock.display_minute(),
            result.minute
        );
        guard += 1;
    }
    assert!(state.is_finished());
}

// ---------------------------------------------------------------------------
// The in-match AI runs on the contract, not on our engine
// ---------------------------------------------------------------------------

#[test]
fn the_dugout_ai_drives_an_erased_state() {
    // ai_decide used to take &LiveMatchState and reach into its rolling window
    // of Zone values, which no other engine has. It now takes &dyn LiveState,
    // so an engine that implements the contract gets the manager AI for free.
    use engine::ai::{ai_decide, AiPersonality, AiProfile};

    let mut state = kickoff_by_id(engine::DEFAULT_ENGINE_ID).expect("known engine");
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(11);

    for _ in 0..60 {
        state.step_minute(&mut rng);
    }

    let profile = AiProfile {
        reputation: 600,
        experience: 60,
        personality: AiPersonality::Pragmatist,
    };
    // The call itself is the assertion: this only compiles because the AI reads
    // the contract. Commands may or may not be issued on a given seed.
    let _commands = ai_decide(state.as_ref(), Side::Home, &profile, &mut rng);
}

#[test]
fn an_engine_that_does_not_track_territory_reports_no_pressure() {
    // The default keeps the AI's territorial branch inert rather than making a
    // number up, so an engine without the concept simply never sits deeper.
    let fake = SpatialFake::new();
    assert_eq!(fake.minutes_under_pressure(Side::Home), 0);
    assert_eq!(fake.minutes_under_pressure(Side::Away), 0);
}

#[test]
fn our_engine_counts_pressure_within_the_ten_minute_window() {
    let mut state = kickoff_by_id(engine::DEFAULT_ENGINE_ID).expect("known engine");
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(3);
    for _ in 0..40 {
        state.step_minute(&mut rng);
    }
    for side in [Side::Home, Side::Away] {
        assert!(
            state.minutes_under_pressure(side) <= 10,
            "the window holds ten minutes, got {}",
            state.minutes_under_pressure(side)
        );
    }
}
