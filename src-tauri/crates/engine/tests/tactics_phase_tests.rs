//! Directional behaviour tests for the extended phase dials (tempo, defensive
//! shape, pressing-possession, counter-press, break speed). Each runs two
//! otherwise-identical sides differing in one dial over a band of seeds and
//! asserts the aggregate outcome moves the claimed way: possession share for the
//! "keep/win the ball" dials, shots for the "create/deny a chance" dials.
//!
//! build_up / width / def_line / marking are owned by the original engine config
//! and covered by its own tests; they are intentionally not re-tested here.

use engine::live_match::LiveMatchState;
use engine::{
    BreakSpeed, CounterPressDuration, DefensiveShape, EventType, MatchConfig, PlayStyle,
    PlayerData, PlayerRole, Position, PressingIntensity, Side, TacticsConfig, TeamData, Tempo,
    simulate_with_rng,
};
use rand::SeedableRng;
use rand::rngs::StdRng;

const SEEDS: u64 = 200;
const SHOTS: [EventType; 4] = [
    EventType::Goal,
    EventType::ShotSaved,
    EventType::ShotOffTarget,
    EventType::ShotBlocked,
];

#[derive(Default, Clone, Copy)]
struct Totals {
    home_possession: usize,
    home_shots: usize,
    away_shots: usize,
}

fn mk(id: &str, pos: Position) -> PlayerData {
    PlayerData {
        id: id.to_string(),
        name: id.to_string(),
        position: pos,
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
        role: PlayerRole::Standard,
        slot: None,
    }
}

fn team(id: &str, tactics: TacticsConfig) -> TeamData {
    TeamData {
        id: id.to_string(),
        name: id.to_string(),
        formation: "4-4-2".to_string(),
        play_style: PlayStyle::Balanced,
        tactics,
        players: vec![
            mk(&format!("{id}_gk"), Position::Goalkeeper),
            mk(&format!("{id}_d1"), Position::Defender),
            mk(&format!("{id}_d2"), Position::Defender),
            mk(&format!("{id}_d3"), Position::Defender),
            mk(&format!("{id}_d4"), Position::Defender),
            mk(&format!("{id}_m1"), Position::Midfielder),
            mk(&format!("{id}_m2"), Position::Midfielder),
            mk(&format!("{id}_m3"), Position::Midfielder),
            mk(&format!("{id}_m4"), Position::Midfielder),
            mk(&format!("{id}_f1"), Position::Forward),
            mk(&format!("{id}_f2"), Position::Forward),
        ],
    }
}

fn play(home: TacticsConfig, seed: u64) -> Totals {
    let mut state = LiveMatchState::new(
        team("h", home),
        team("a", TacticsConfig::default()),
        MatchConfig::default(),
        vec![],
        vec![],
        false,
    );
    let mut rng = StdRng::seed_from_u64(seed);
    let mut t = Totals::default();
    loop {
        let r = state.step_minute(&mut rng);
        for e in &r.events {
            if SHOTS.contains(&e.event_type) {
                match e.side {
                    Side::Home => t.home_shots += 1,
                    Side::Away => t.away_shots += 1,
                }
            }
        }
        if r.is_finished {
            break;
        }
    }
    // Use the engine's own possession stat (accumulated each minute) rather than
    // the post-turnover `MinuteResult.possession`, so the metric matches what the
    // dial logic actually feeds.
    t.home_possession = state.snapshot().home_possession_pct.round() as usize;
    t
}

fn band(home: TacticsConfig, metric: impl Fn(&Totals) -> usize) -> usize {
    (0..SEEDS).map(|s| metric(&play(home, s))).sum()
}

fn with(f: impl FnOnce(&mut TacticsConfig)) -> TacticsConfig {
    let mut c = TacticsConfig::default();
    f(&mut c);
    c
}

#[test]
fn neutral_is_reproducible() {
    let n = TacticsConfig::default();
    for seed in 0..15 {
        let a = play(n, seed);
        let b = play(n, seed);
        assert_eq!(
            (a.home_possession, a.home_shots, a.away_shots),
            (b.home_possession, b.home_shots, b.away_shots),
            "seed {seed}: neutral not reproducible"
        );
    }
}

// --- keep / win the ball → possession ---

#[test]
fn patient_tempo_keeps_more_possession_than_direct() {
    let patient = band(with(|c| c.tempo = Tempo::Patient), |t| t.home_possession);
    let direct = band(with(|c| c.tempo = Tempo::Direct), |t| t.home_possession);
    assert!(
        patient > direct,
        "Patient should hold the ball more than Direct: {patient} vs {direct}"
    );
}

#[test]
fn aggressive_pressing_wins_more_possession_than_passive() {
    let agg = band(
        with(|c| c.pressing_intensity = PressingIntensity::Aggressive),
        |t| t.home_possession,
    );
    let pas = band(
        with(|c| c.pressing_intensity = PressingIntensity::Passive),
        |t| t.home_possession,
    );
    assert!(
        agg > pas,
        "Aggressive pressing should win the ball back more than passive: {agg} vs {pas}"
    );
}

#[test]
fn long_counter_press_keeps_more_possession_than_none() {
    let long = band(
        with(|c| c.counter_press_duration = CounterPressDuration::Long),
        |t| t.home_possession,
    );
    let none = band(
        with(|c| c.counter_press_duration = CounterPressDuration::None),
        |t| t.home_possession,
    );
    assert!(
        long > none,
        "Long counter-press should regain possession more than none: {long} vs {none}"
    );
}

// --- create / deny a chance → shots ---

#[test]
fn direct_tempo_shoots_more_than_patient() {
    let direct = band(with(|c| c.tempo = Tempo::Direct), |t| t.home_shots);
    let patient = band(with(|c| c.tempo = Tempo::Patient), |t| t.home_shots);
    assert!(
        direct > patient,
        "Direct tempo should produce more shots than Patient: {direct} vs {patient}"
    );
}

#[test]
fn compact_shape_concedes_fewer_chances_than_stretched() {
    let compact = band(with(|c| c.defensive_shape = DefensiveShape::Compact), |t| {
        t.away_shots
    });
    let stretched = band(
        with(|c| c.defensive_shape = DefensiveShape::Stretched),
        |t| t.away_shots,
    );
    assert!(
        compact < stretched,
        "Compact should concede fewer chances than Stretched: {compact} vs {stretched}"
    );
}

#[test]
fn fast_break_creates_more_chances_than_slow() {
    let fast = band(with(|c| c.break_speed = BreakSpeed::Fast), |t| t.home_shots);
    let slow = band(with(|c| c.break_speed = BreakSpeed::Slow), |t| t.home_shots);
    assert!(
        fast > slow,
        "Fast breaks should create more chances than slow: {fast} vs {slow}"
    );
}

// ---------------------------------------------------------------------------
// Batch (instant) engine — the same dials must move the same way through
// simulate_with_rng, which drives AI matchdays. The hook sites are separate
// from the live engine's, so they get their own coverage.
// ---------------------------------------------------------------------------

fn play_batch(home: TacticsConfig, seed: u64) -> Totals {
    let h = team("h", home);
    let a = team("a", TacticsConfig::default());
    let mut rng = StdRng::seed_from_u64(seed);
    let r = simulate_with_rng(&h, &a, &MatchConfig::default(), &mut rng);
    Totals {
        home_possession: r.home_stats.possession_ticks as usize,
        home_shots: r.home_stats.shots as usize,
        away_shots: r.away_stats.shots as usize,
    }
}

fn band_batch(home: TacticsConfig, metric: impl Fn(&Totals) -> usize) -> usize {
    (0..SEEDS).map(|s| metric(&play_batch(home, s))).sum()
}

#[test]
fn batch_neutral_is_reproducible() {
    let n = TacticsConfig::default();
    for seed in 0..15 {
        let a = play_batch(n, seed);
        let b = play_batch(n, seed);
        assert_eq!(
            (a.home_possession, a.home_shots, a.away_shots),
            (b.home_possession, b.home_shots, b.away_shots),
            "batch seed {seed}: neutral not reproducible"
        );
    }
}

#[test]
fn batch_aggressive_pressing_wins_more_possession_than_passive() {
    let agg = band_batch(
        with(|c| c.pressing_intensity = PressingIntensity::Aggressive),
        |t| t.home_possession,
    );
    let pas = band_batch(
        with(|c| c.pressing_intensity = PressingIntensity::Passive),
        |t| t.home_possession,
    );
    assert!(
        agg > pas,
        "batch: aggressive pressing should win more possession: {agg} vs {pas}"
    );
}

#[test]
fn batch_long_counter_press_keeps_more_possession_than_none() {
    let long = band_batch(
        with(|c| c.counter_press_duration = CounterPressDuration::Long),
        |t| t.home_possession,
    );
    let none = band_batch(
        with(|c| c.counter_press_duration = CounterPressDuration::None),
        |t| t.home_possession,
    );
    assert!(
        long > none,
        "batch: long counter-press should regain more possession: {long} vs {none}"
    );
}

#[test]
fn batch_direct_tempo_shoots_more_than_patient() {
    let direct = band_batch(with(|c| c.tempo = Tempo::Direct), |t| t.home_shots);
    let patient = band_batch(with(|c| c.tempo = Tempo::Patient), |t| t.home_shots);
    assert!(
        direct > patient,
        "batch: Direct should shoot more than Patient: {direct} vs {patient}"
    );
}

#[test]
fn batch_compact_shape_concedes_fewer_chances_than_stretched() {
    let compact = band_batch(with(|c| c.defensive_shape = DefensiveShape::Compact), |t| {
        t.away_shots
    });
    let stretched = band_batch(
        with(|c| c.defensive_shape = DefensiveShape::Stretched),
        |t| t.away_shots,
    );
    assert!(
        compact < stretched,
        "batch: Compact should concede fewer chances: {compact} vs {stretched}"
    );
}

#[test]
fn batch_fast_break_creates_more_chances_than_slow() {
    let fast = band_batch(with(|c| c.break_speed = BreakSpeed::Fast), |t| t.home_shots);
    let slow = band_batch(with(|c| c.break_speed = BreakSpeed::Slow), |t| t.home_shots);
    assert!(
        fast > slow,
        "batch: Fast breaks should create more chances: {fast} vs {slow}"
    );
}

// ---------------------------------------------------------------------------
// Pressing stamina cost (live engine only — it tracks in-match condition).
// ---------------------------------------------------------------------------

/// Total end-of-match condition for (home, away) given each side's tactics.
fn final_conditions(home: TacticsConfig, away: TacticsConfig, seed: u64) -> (i64, i64) {
    let mut s = LiveMatchState::new(
        team("h", home),
        team("a", away),
        MatchConfig::default(),
        vec![],
        vec![],
        false,
    );
    let mut rng = StdRng::seed_from_u64(seed);
    loop {
        if s.step_minute(&mut rng).is_finished {
            break;
        }
    }
    let snap = s.snapshot();
    let sum = |players: &[PlayerData]| players.iter().map(|p| p.condition as i64).sum::<i64>();
    (sum(&snap.home_team.players), sum(&snap.away_team.players))
}

#[test]
fn aggressive_pressing_tires_the_team_more_than_passive() {
    // Accumulate by tactic, not by side: each seed is played in both
    // orientations so the home-advantage bias cancels and only pressing remains.
    let aggressive = with(|c| c.pressing_intensity = PressingIntensity::Aggressive);
    let passive = with(|c| c.pressing_intensity = PressingIntensity::Passive);
    let (mut aggressive_cond, mut passive_cond) = (0i64, 0i64);
    for seed in 0..40u64 {
        let (h, a) = final_conditions(aggressive, passive, seed);
        aggressive_cond += h;
        passive_cond += a;
        let (h, a) = final_conditions(passive, aggressive, seed);
        passive_cond += h;
        aggressive_cond += a;
    }
    assert!(
        aggressive_cond < passive_cond,
        "aggressive pressing should leave the team more tired: aggressive {aggressive_cond} vs passive {passive_cond}"
    );
}

// ---------------------------------------------------------------------------
// Play style
// ---------------------------------------------------------------------------
//
// `play_style_modifier` carries an attacking and a defensive figure for every
// style, but the only call in the simulation asked for `PlayStylePhase::Press`,
// where all but `HighPress` return 1.0. Every one of those numbers was
// unreachable, so Balanced, Attacking, Defensive, Possession and Counter were
// the same tactic: a manager could switch between them and change nothing but
// the label on the screen.
//
// These run the same band of seeds the dial tests use and assert the styles
// separate. Against the unfixed engine the totals are not merely close, they
// are identical.

fn styled(id: &str, style: PlayStyle) -> TeamData {
    TeamData {
        play_style: style,
        ..team(id, TacticsConfig::default())
    }
}

/// Shots for both sides plus what the opposition actually scored. Goals
/// conceded rather than shots conceded: a side told to sit in keeps the ball
/// less, so the opposition takes *more* shots at it — that is football, not a
/// defect. What defending better has to show up in is how many of them go in.
#[derive(Default, Clone, Copy)]
struct StyleTotals {
    home_shots: usize,
    away_shots: usize,
    away_goals: usize,
}

fn play_styled(home: PlayStyle, seed: u64) -> StyleTotals {
    let mut state = LiveMatchState::new(
        styled("h", home),
        styled("a", PlayStyle::Balanced),
        MatchConfig::default(),
        vec![],
        vec![],
        false,
    );
    let mut rng = StdRng::seed_from_u64(seed);
    let mut t = StyleTotals::default();
    loop {
        let r = state.step_minute(&mut rng);
        for e in &r.events {
            if SHOTS.contains(&e.event_type) {
                match e.side {
                    Side::Home => t.home_shots += 1,
                    Side::Away => t.away_shots += 1,
                }
            }
            if e.side == Side::Away
                && matches!(e.event_type, EventType::Goal | EventType::PenaltyGoal)
            {
                t.away_goals += 1;
            }
        }
        if r.is_finished {
            break;
        }
    }
    t
}

fn style_band(home: PlayStyle, metric: impl Fn(&StyleTotals) -> usize) -> usize {
    (0..SEEDS).map(|s| metric(&play_styled(home, s))).sum()
}

#[test]
fn an_attacking_side_creates_more_than_a_defensive_one() {
    let attacking = style_band(PlayStyle::Attacking, |t| t.home_shots);
    let defensive = style_band(PlayStyle::Defensive, |t| t.home_shots);
    assert!(
        attacking > defensive,
        "Attacking produced {attacking} shots and Defensive {defensive}; \
         the two styles are not reaching the simulation"
    );
}

#[test]
fn a_defensive_side_concedes_fewer_goals_than_an_attacking_one() {
    let against_attacking = style_band(PlayStyle::Attacking, |t| t.away_goals);
    let against_defensive = style_band(PlayStyle::Defensive, |t| t.away_goals);
    assert!(
        against_defensive < against_attacking,
        "the opposition scored {against_defensive} against Defensive and \
         {against_attacking} against Attacking; committing forward is costing \
         nothing at the back"
    );
}

#[test]
fn balanced_is_not_the_same_tactic_as_every_other_style() {
    // The blunt version of the above, and the one that says what was actually
    // wrong: four styles were indistinguishable from Balanced.
    let balanced = style_band(PlayStyle::Balanced, |t| t.home_shots);
    for style in [
        PlayStyle::Attacking,
        PlayStyle::Defensive,
        PlayStyle::Counter,
    ] {
        assert_ne!(
            style_band(style, |t| t.home_shots),
            balanced,
            "{style:?} produces exactly the balanced total, so it is not being applied"
        );
    }
}
