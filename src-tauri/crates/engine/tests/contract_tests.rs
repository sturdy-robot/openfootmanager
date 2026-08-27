//! Tests for the engine contract itself, driven the way a second engine would
//! be driven: through trait objects, without reaching for the built-in engine's
//! concrete types.
//!
//! The fake below is deliberately everything the built-in engine is not: it
//! keeps continuous time in 100 ms steps, it has coordinates, it has never
//! heard of a possession chain, and it manages no personnel at all. It used to
//! be unable to implement `LiveState` honestly — `snapshot()` demanded both
//! squads, both benches, per-side yellow-card maps and a whole-minute
//! `current_minute`, so it left the method `unimplemented!()` and said why.
//! It now implements the whole contract.

use engine::advance::{AdvanceRequest, LiveUpdate, StopReason};
use engine::clock::{MatchClock, MatchPeriod};
use engine::compliance::check_capabilities;
use engine::descriptor::{EngineDescriptor, MatchCommandKind, NativeStep, CONTRACT_VERSION};
use engine::live_match::{MatchCommand, MatchPhase};
use engine::rejection::CommandRejection;
use engine::report::MatchReport;
use engine::spatial::{
    BallPosition, PitchGeometry, PitchPoint, PlayerPosition, SpatialFrame, SpatialTelemetry,
};
use engine::traits::LiveState;
use engine::view::MatchProgress;
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
            // It manages no personnel, so it accepts no command that would
            // change any. Claiming `Substitute` while reporting no squad is a
            // compliance failure, and rightly: the game would offer a
            // substitution nothing could pick.
            commands: &[],
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

/// This fake's native step, and the point of the whole exercise: 100 ms is not
/// a divisor of anything the built-in engine does.
const SPATIAL_FAKE_STEP_MS: u32 = 100;

impl LiveState for SpatialFake {
    fn advance(&mut self, request: AdvanceRequest, _rng: &mut dyn rand::Rng) -> LiveUpdate {
        let mut events = Vec::new();
        let mut resolved_ms = 0;

        // At least one step, then until the budget is met. Nothing here rounds
        // to a minute, which under `step_minute` was not expressible.
        loop {
            self.elapsed_ms += SPATIAL_FAKE_STEP_MS;
            resolved_ms += SPATIAL_FAKE_STEP_MS;
            self.ball_x = (self.ball_x + 0.001).min(1.0);
            let event = MatchEvent {
                minute: MatchClock::new(MatchPeriod::FirstHalf, self.elapsed_ms).display_minute(),
                event_type: EventType::PassCompleted,
                side: Side::Home,
                zone: Zone::Midfield,
                player_id: None,
                secondary_player_id: None,
                detail: None,
            };
            self.events.push(event.clone());
            events.push(event);
            if resolved_ms >= request.budget_ms {
                break;
            }
        }

        LiveUpdate {
            // What the neutral clock buys a continuous engine: it reports its
            // real millisecond time instead of rounding to one of our minutes.
            clock: MatchClock::new(MatchPeriod::FirstHalf, self.elapsed_ms),
            resolved_ms,
            phase: MatchPhase::FirstHalf,
            events,
            home_score: 0,
            away_score: 0,
            possession: Side::Home,
            is_finished: false,
            stopped: StopReason::BudgetSpent,
        }
    }

    fn apply_command(&mut self, cmd: MatchCommand) -> Result<(), CommandRejection> {
        // Everything except a substitution is outside what this engine models,
        // and the descriptor says so too.
        Err(CommandRejection::Unsupported(cmd.kind()))
    }

    fn progress(&self) -> MatchProgress {
        // The whole required surface, and nothing this engine does not model.
        // No squads, no benches, no bookings, no whole-minute clock.
        MatchProgress::new(
            MatchPhase::FirstHalf,
            MatchClock::new(MatchPeriod::FirstHalf, self.elapsed_ms),
            0,
            0,
            Side::Home,
        )
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
    fn advance(&mut self, _request: AdvanceRequest, _rng: &mut dyn rand::Rng) -> LiveUpdate {
        unimplemented!()
    }
    fn apply_command(&mut self, _cmd: MatchCommand) -> Result<(), CommandRejection> {
        Ok(())
    }
    fn progress(&self) -> MatchProgress {
        MatchProgress::new(
            MatchPhase::FirstHalf,
            MatchClock::new(MatchPeriod::FirstHalf, 0),
            0,
            0,
            Side::Home,
        )
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
    fake.advance(AdvanceRequest::millis(SPATIAL_FAKE_STEP_MS), &mut rng);
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
    use engine::{PlayStyle, PlayerData, Position, TacticsConfig, TeamData};

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

    let setup = MatchSetup::league(team("home"), team("away"));
    let state = DefaultEngine.kickoff(setup).expect("no config, so nothing to decline");
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
    kickoff_by_id_with(id, false)
}

/// As above, but for a tie that has to be settled: extra time, and a shootout
/// if it is still level.
/// The synthetic squads every test in this file plays with.
use engine::{PlayStyle, PlayerData, Position, TacticsConfig, TeamData};

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

/// A fixture with nothing attached: no benches, no dugouts, no engine config.
fn plain_setup() -> engine::MatchSetup {
    engine::MatchSetup::league(team("home"), team("away"))
}

fn kickoff_by_id_with(id: &str, allows_extra_time: bool) -> Option<Box<dyn engine::LiveState + Send>> {
    use engine::traits::{DefaultEngine, LiveEngineObject};

    if id != engine::DEFAULT_ENGINE_ID {
        return None;
    }
    let setup = plain_setup().with_extra_time(allows_extra_time);
    Some(
        DefaultEngine
            .kickoff_boxed(setup)
            .expect("no config, so nothing to decline"),
    )
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
        state.advance(AdvanceRequest::one_minute(), &mut rng);
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
        let update = state.advance(AdvanceRequest::one_minute(), &mut rng);
        // Two readings of one instant. The broadcast minute never runs ahead
        // of the engine's running minute, except at kick-off, where football
        // counts the opening minute as 1 and the engine counts elapsed as 0.
        assert!(
            update.clock.display_minute() <= state.minute().max(1),
            "clock read {} while the running minute was {}",
            update.clock.display_minute(),
            state.minute()
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
        state.advance(AdvanceRequest::one_minute(), &mut rng);
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
        state.advance(AdvanceRequest::one_minute(), &mut rng);
    }
    for side in [Side::Home, Side::Away] {
        assert!(
            state.minutes_under_pressure(side) <= 10,
            "the window holds ten minutes, got {}",
            state.minutes_under_pressure(side)
        );
    }
}

// ---------------------------------------------------------------------------
// The advance bargain
//
// `step_minute` made one of our minutes the unit every engine had to resolve
// in. These pin what replaced it, from both sides: an engine asked for less
// than it can do still makes progress, and an engine asked for more does not
// run past a moment the caller has to be given.
// ---------------------------------------------------------------------------

/// Get past kick-off, which is a phase transition and resolves no time.
fn kicked_off(seed: u64) -> (Box<dyn engine::LiveState + Send>, rand::rngs::StdRng) {
    let mut state = kickoff_by_id(engine::DEFAULT_ENGINE_ID).expect("known engine");
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(seed);
    let opening = state.advance(AdvanceRequest::one_minute(), &mut rng);
    assert_eq!(opening.phase, MatchPhase::FirstHalf);
    assert_eq!(
        opening.stopped,
        StopReason::PhaseBoundary,
        "kick-off is a transition, not a minute of football"
    );
    assert_eq!(opening.resolved_ms, 0, "no time passes at kick-off");
    (state, rng)
}

#[test]
fn a_budget_below_the_native_step_still_resolves_one_step() {
    // The alternative — resolving nothing because a millisecond is less than a
    // minute — leaves the caller spinning on a match that never moves.
    let (mut state, mut rng) = kicked_off(20260827);
    let update = state.advance(AdvanceRequest::millis(1), &mut rng);
    assert_eq!(
        update.resolved_ms, 60_000,
        "the built-in engine's native step is one minute, so that is the floor"
    );

    // Zero is the floor's real test: a budget check made before the first step
    // rather than after it looks correct at one millisecond and stalls here.
    let update = state.advance(AdvanceRequest::millis(0), &mut rng);
    assert_eq!(
        update.resolved_ms, 60_000,
        "asking for no time must still move the match on, or the caller spins"
    );
}

#[test]
fn an_engine_overshoots_a_budget_by_at_most_one_native_step() {
    // 1050 ms is deliberately not a multiple of the fake's 100 ms step, so the
    // only two answers that satisfy the contract are 1100 (round up) and a
    // violation.
    let mut fake = SpatialFake::new();
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(5);
    let update = fake.advance(AdvanceRequest::millis(1050), &mut rng);

    assert!(
        update.resolved_ms >= 1050,
        "an engine that stops short of the budget has not met the request, got {}",
        update.resolved_ms
    );
    assert!(
        update.resolved_ms < 1050 + SPATIAL_FAKE_STEP_MS,
        "overshoot is capped at one native step, got {}",
        update.resolved_ms
    );
}

#[test]
fn a_continuous_engine_reports_a_time_our_minutes_cannot_express() {
    // The whole reason `step_minute` had to go. Driven through an erased state,
    // because that is how a registry hands an engine out.
    let mut boxed: Box<dyn engine::LiveState + Send> = Box::new(SpatialFake::new());
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(9);

    let update = boxed.advance(AdvanceRequest::millis(250), &mut rng);

    assert_eq!(update.clock.period_elapsed_ms, 300);
    assert_eq!(
        update.clock.elapsed_minutes(),
        0,
        "three hundred milliseconds is not a minute, and the engine no longer has to pretend it is"
    );
}

#[test]
fn a_bigger_budget_resolves_more_than_one_minute_in_one_call() {
    let (mut state, mut rng) = kicked_off(20260827);
    let update = state.advance(AdvanceRequest::minutes(5), &mut rng);

    assert_eq!(update.resolved_ms, 5 * 60_000);
    assert_eq!(update.stopped, StopReason::BudgetSpent);
    assert_eq!(
        state.minute(),
        5,
        "five minutes of budget is five minutes of football"
    );
}

#[test]
fn half_time_stops_an_advance_that_still_has_budget_left() {
    // A caller that asked for the whole match must still be handed half time:
    // it is when substitutions are made, and the player has to see it.
    let (mut state, mut rng) = kicked_off(20260827);
    let budget = AdvanceRequest::minutes(90);

    let mut guard = 0;
    let update = loop {
        let update = state.advance(budget, &mut rng);
        if update.phase == MatchPhase::HalfTime {
            break update;
        }
        guard += 1;
        assert!(guard < 10, "half time should arrive in the first such call");
    };

    assert_eq!(update.stopped, StopReason::PhaseBoundary);
    assert!(
        update.resolved_ms < budget.budget_ms,
        "the call stopped early: it resolved {} of a {} ms budget",
        update.resolved_ms,
        budget.budget_ms
    );
    assert!(
        update.resolved_ms >= 45 * 60_000,
        "and it stopped at half time, not before it"
    );
}

#[test]
fn advancing_a_finished_match_changes_nothing() {
    // There is no error to return here — the state is intact and the answer is
    // simply that there is nothing left. Calling again has to be safe, because
    // a fast-forward loop will.
    let mut state = kickoff_by_id(engine::DEFAULT_ENGINE_ID).expect("known engine");
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(20260802);

    let mut guard = 0;
    while !state.is_finished() && guard < 200 {
        state.advance(AdvanceRequest::one_minute(), &mut rng);
        guard += 1;
    }
    assert!(state.is_finished());

    let before = state.advance(AdvanceRequest::minutes(10), &mut rng);
    let after = state.advance(AdvanceRequest::minutes(10), &mut rng);

    for update in [&before, &after] {
        assert_eq!(update.stopped, StopReason::Finished);
        assert_eq!(update.resolved_ms, 0);
        assert!(update.events.is_empty());
        assert!(update.is_finished);
    }
    assert_eq!(before.clock, after.clock, "the clock has stopped for good");
}

#[test]
fn a_shootout_hands_back_one_round_at_a_time() {
    // The kick moves the tie on without moving the clock, so neither the budget
    // nor a phase change can end the call. Without a stop for an engine's own
    // boundary, one advance would swallow the entire shootout and the player
    // would watch none of it.
    let mut found = None;
    for seed in 0..40u64 {
        let mut state =
            kickoff_by_id_with(engine::DEFAULT_ENGINE_ID, true).expect("known engine");
        let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(seed);
        let mut guard = 0;
        while !state.is_finished() && guard < 300 {
            let update = state.advance(AdvanceRequest::minutes(120), &mut rng);
            if update.phase == MatchPhase::PenaltyShootout {
                found = Some((state, rng));
                break;
            }
            guard += 1;
        }
        if found.is_some() {
            break;
        }
    }

    let (mut state, mut rng) = found.expect("forty seeds should produce one shootout");

    let first = state.advance(AdvanceRequest::minutes(120), &mut rng);
    assert_eq!(first.resolved_ms, 0, "a penalty kick takes no match time");
    assert!(
        !first.events.is_empty(),
        "a round with no events is a stalled engine, not a boundary"
    );
    assert_eq!(
        first.stopped,
        StopReason::NativeBoundary,
        "the engine stopped at a boundary of its own, with the whole budget to spare"
    );

    let mut calls = 1;
    while !state.is_finished() && calls < 60 {
        state.advance(AdvanceRequest::minutes(120), &mut rng);
        calls += 1;
    }
    assert!(state.is_finished(), "the shootout has to produce a winner");
    assert!(
        calls > 1,
        "one call swallowed the whole shootout; the player would watch none of it"
    );
}

// ---------------------------------------------------------------------------
// The squad is a question, not a requirement
//
// `snapshot()` demanded both squads, both benches, per-side yellow-card maps,
// set-piece takers, a substitution log and a whole-minute minute — the match
// screen, written down as a trait method. An engine that models none of it
// still had to construct all of it, which is why the continuous fake in this
// file could not implement the contract at all.
// ---------------------------------------------------------------------------

#[test]
fn a_continuous_engine_can_report_its_whole_state_now() {
    // The test that could not be written before. Driven through an erased box,
    // because that is how a registry hands an engine out.
    let mut boxed: Box<dyn engine::LiveState + Send> = Box::new(SpatialFake::new());
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(4);
    boxed.advance(AdvanceRequest::millis(250), &mut rng);

    let progress = boxed.progress();
    assert_eq!(progress.clock.period_elapsed_ms, 300);
    assert_eq!(progress.phase, MatchPhase::FirstHalf);
    assert!(
        progress.expected_goals.is_none(),
        "an engine that does not measure xg says so rather than reporting zero"
    );
    assert!(progress.momentum.is_empty());
    assert!(
        boxed.squad().is_none(),
        "and it manages no personnel, which is now an answer rather than a panic"
    );
}

#[test]
fn the_game_can_render_a_match_from_an_engine_that_manages_no_squad() {
    // `MatchSnapshot` is still what the match screen receives, but it is now
    // composed from the contract rather than handed over by the engine. So an
    // engine with no squad produces a snapshot with no squad, instead of being
    // unable to produce one at all.
    let fake = SpatialFake::new();
    let snapshot = engine::MatchSnapshot::compose(
        &fake,
        engine::SnapshotContext {
            allows_extra_time: false,
            home_team_name: "Ipswich Town".to_string(),
            away_team_name: "Norwich City".to_string(),
        },
    );

    assert_eq!(snapshot.phase, MatchPhase::FirstHalf);
    assert!(snapshot.home_team.players.is_empty());
    assert_eq!(
        snapshot.home_team.name, "Ipswich Town",
        "the club's real name, supplied by the caller. An engine writing its \
         own placeholder here would be putting English on the match screen \
         from the one crate the locale files cannot reach"
    );
    assert!(snapshot.home_bench.is_empty());
    assert_eq!(snapshot.max_subs, 0, "no substitutions are on offer");
    assert!(snapshot.sent_off.is_empty());
    assert_eq!(
        snapshot.home_possession_pct, 50.0,
        "an unmeasured share reads as even rather than as nothing"
    );
}

#[test]
fn a_composed_snapshot_carries_the_engine_running_minute() {
    // Never re-derived from the clock. `display_minute` caps at the period's
    // regulation end, so a first half running to 47 would read back as 45.
    let mut state = kickoff_by_id(engine::DEFAULT_ENGINE_ID).expect("known engine");
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(21);
    for _ in 0..50 {
        state.advance(AdvanceRequest::one_minute(), &mut rng);
    }

    let snapshot = engine::MatchSnapshot::compose(
        state.as_ref(),
        engine::SnapshotContext {
            allows_extra_time: false,
            home_team_name: String::new(),
            away_team_name: String::new(),
        },
    );
    assert_eq!(snapshot.current_minute, state.minute());
}

#[test]
fn accepting_substitutions_without_reporting_a_squad_is_a_violation() {
    // The game would offer a change nothing could pick from.
    let mut lying = SpatialFake::descriptor();
    lying.commands = &[MatchCommandKind::Substitute];

    let report = check_capabilities(&SpatialFake::new(), &lying);
    assert!(
        report
            .violations
            .iter()
            .any(|v| v.detail.contains("reports no squad")),
        "got {:?}",
        report.violations
    );
}

#[test]
fn reporting_a_squad_nothing_can_change_is_also_a_violation() {
    // The mirror image, and the same reasoning as the spatial check: a
    // capability nobody can act on rots into a stale claim.
    let state = kickoff_by_id(engine::DEFAULT_ENGINE_ID).expect("known engine");
    let mut silent = engine::EngineInfo::descriptor(&engine::DefaultEngine);
    silent.commands = &[];

    let report = check_capabilities(state.as_ref(), &silent);
    assert!(
        report
            .violations
            .iter()
            .any(|v| v.detail.contains("no way to change")),
        "got {:?}",
        report.violations
    );
}

#[test]
fn the_dugout_ai_stands_down_when_it_cannot_see_the_squad() {
    // Every branch of the manager AI reads the team: who is tiring, who is on
    // the bench, what the side is set up to do. Given none of it, it issues
    // nothing rather than guessing.
    use engine::ai::{ai_decide, AiPersonality, AiProfile};

    let fake = SpatialFake::new();
    let profile = AiProfile {
        reputation: 600,
        experience: 90,
        personality: AiPersonality::Reactive,
    };
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(13);

    let commands = ai_decide(&fake, Side::Home, &profile, &mut rng);
    assert!(
        commands.is_empty(),
        "the AI cannot manage a team it cannot see, got {commands:?}"
    );
}

#[test]
fn an_interval_resolves_no_football() {
    // The contract says zero is a legitimate answer and names an interval as
    // the case. The reference engine has to mean it.
    //
    // Only bites when the first half runs to exactly 45: the second half opens
    // at `max(current, 46)`, so with any stoppage the minute does not move and
    // a resolved time read off the minute alone looks right by accident. So
    // find the seed where it does move, which is the whole point.
    let mut found = None;
    for seed in 0..80u64 {
        let (mut state, mut rng) = kicked_off(seed);
        let mut guard = 0;
        while state.phase() != MatchPhase::HalfTime && guard < 60 {
            state.advance(AdvanceRequest::one_minute(), &mut rng);
            guard += 1;
        }
        if state.minute() == 45 {
            found = Some((state, rng));
            break;
        }
    }

    let (mut state, mut rng) =
        found.expect("eighty seeds should include one first half with no stoppage");

    let second_half = state.advance(AdvanceRequest::one_minute(), &mut rng);
    assert_eq!(second_half.phase, MatchPhase::SecondHalf);
    assert_eq!(
        state.minute(),
        46,
        "the running minute moved, which is exactly what makes this the hard case"
    );
    assert_eq!(
        second_half.resolved_ms, 0,
        "coming out for the second half is not a minute of football"
    );
    assert_eq!(second_half.stopped, StopReason::PhaseBoundary);
}

#[test]
fn entering_extra_time_resolves_no_football_either() {
    // The harder of the two: extra time restarts the running minute at 91
    // whatever the second half ran to, so this transition always moves it.
    let mut found = None;
    for seed in 0..40u64 {
        let mut state =
            kickoff_by_id_with(engine::DEFAULT_ENGINE_ID, true).expect("known engine");
        let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(seed);
        let mut guard = 0;
        while !state.is_finished() && guard < 300 {
            if state.phase() == MatchPhase::FullTime {
                found = Some((state, rng));
                break;
            }
            state.advance(AdvanceRequest::one_minute(), &mut rng);
            guard += 1;
        }
        if found.is_some() {
            break;
        }
    }

    let (mut state, mut rng) = found.expect("forty knockout ties should reach full time level");
    let extra_time = state.advance(AdvanceRequest::one_minute(), &mut rng);
    if extra_time.phase == MatchPhase::ExtraTimeFirstHalf {
        assert_eq!(
            extra_time.resolved_ms, 0,
            "kicking off extra time is not a minute of football"
        );
    }
}

#[test]
fn a_shootout_names_the_side_on_the_spot() {
    // `possession` comes from the step, not from the engine's own reading,
    // which during a shootout still holds whoever last had the ball in extra
    // time. Both sides take kicks, so a stale value cannot alternate.
    let mut found = None;
    for seed in 0..40u64 {
        let mut state =
            kickoff_by_id_with(engine::DEFAULT_ENGINE_ID, true).expect("known engine");
        let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(seed);
        let mut guard = 0;
        while !state.is_finished() && guard < 300 {
            let update = state.advance(AdvanceRequest::minutes(120), &mut rng);
            if update.phase == MatchPhase::PenaltyShootout {
                found = Some((state, rng));
                break;
            }
            guard += 1;
        }
        if found.is_some() {
            break;
        }
    }

    let (mut state, mut rng) = found.expect("forty seeds should produce one shootout");

    let mut takers = Vec::new();
    let mut guard = 0;
    while !state.is_finished() && guard < 60 {
        let round = state.advance(AdvanceRequest::minutes(120), &mut rng);
        takers.push(round.possession);
        guard += 1;
    }

    assert!(
        takers.contains(&Side::Home) && takers.contains(&Side::Away),
        "both sides take kicks, so the reported side has to change: {takers:?}"
    );
}

// ---------------------------------------------------------------------------
// Per-engine config
//
// `MatchConfig` used to sit on `MatchSetup`, so every engine was handed this
// engine's tuning constants whether they meant anything to it or not. Read
// their own doc comments — "calibrated against the effective shooting skill the
// engine actually produces" — and it is plain whose they are.
// ---------------------------------------------------------------------------

/// A second engine's settings, for testing that ours declines them.
#[derive(Debug)]
struct OtherEngineConfig;

impl engine::EngineConfig for OtherEngineConfig {
    fn engine_id(&self) -> &'static str {
        "spatial-fake"
    }
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[test]
fn supplying_the_engines_own_defaults_changes_nothing() {
    // The pin that keeps this plumbing honest. Moving config off the shared
    // setup must not move a single draw: an explicit default config and no
    // config at all have to produce the same match, seed for seed.
    use engine::InstantEngine;

    let bare = plain_setup();
    let with_defaults = plain_setup().with_config(std::sync::Arc::new(
        engine::MatchConfig::default(),
    ));

    let mut a = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(20260802);
    let mut b = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(20260802);

    let from_bare = engine::DefaultEngine.simulate(&bare, &mut a).expect("ours");
    let from_defaults = engine::DefaultEngine
        .simulate(&with_defaults, &mut b)
        .expect("ours");

    assert_eq!(
        engine::compliance::fingerprint(&from_bare),
        engine::compliance::fingerprint(&from_defaults),
        "an explicit default config has to be the same match as no config"
    );
}

#[test]
fn tuning_actually_reaches_the_engine() {
    // The other half: if the config were quietly dropped rather than read, the
    // test above would pass while nothing worked. Something absurd has to show.
    use engine::InstantEngine;

    let goalless = plain_setup().with_config(std::sync::Arc::new(engine::MatchConfig {
        shot_accuracy_base: 0.0,
        goal_conversion_base: 0.0,
        ..engine::MatchConfig::default()
    }));

    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(20260802);
    let report = engine::DefaultEngine
        .simulate(&goalless, &mut rng)
        .expect("ours");

    assert_eq!(
        report.home_goals + report.away_goals,
        report.home_penalties.unwrap_or(0) + report.away_penalties.unwrap_or(0),
        "with no shot accuracy and no conversion, only a penalty can score"
    );
}

#[test]
fn an_engine_declines_another_engines_tuning() {
    // Declined, not ignored. Falling back to defaults would run the match under
    // settings nobody chose and tell nobody.
    use engine::InstantEngine;

    let foreign = plain_setup().with_config(std::sync::Arc::new(OtherEngineConfig));
    let mut rng = <rand::rngs::StdRng as rand::SeedableRng>::seed_from_u64(1);

    let err = engine::DefaultEngine
        .simulate(&foreign, &mut rng)
        .expect_err("this config belongs to another engine");
    assert_eq!(
        err,
        engine::EngineError::ConfigForAnotherEngine {
            expected: engine::DEFAULT_ENGINE_ID,
            found: "spatial-fake",
        }
    );

    // And the watched path refuses it the same way, rather than the two
    // disagreeing about whether a fixture can be played at all.
    let foreign = plain_setup().with_config(std::sync::Arc::new(OtherEngineConfig));
    assert!(engine::registry::kickoff(engine::DEFAULT_ENGINE_ID, foreign).is_err());
}

#[test]
fn an_unknown_engine_id_is_a_typed_error_with_a_key() {
    // It used to be a bare `format!("be.error.liveMatch.unknownEngine:{id}")`
    // built in `ofm_core`, and that key existed in none of the eleven locale
    // files. A closed error set is what makes that impossible.
    let err = match engine::registry::kickoff("no-such-engine", plain_setup()) {
        Err(err) => err,
        Ok(_) => panic!("nothing is registered under that id"),
    };
    assert_eq!(
        err,
        engine::EngineError::UnknownEngine {
            requested: "no-such-engine".to_string()
        }
    );
    assert_eq!(err.to_string(), "be.error.liveMatch.unknownEngine");
}
