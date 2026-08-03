//! Runs the engine compliance suite against the built-in engine.
//!
//! These are the invariants any engine must satisfy to be usable by the game.
//! They are the regression net for the match-engine overhaul: determinism (which
//! match replay depends on), report/event agreement, discipline, substitution
//! legality and shootout resolution.

use engine::compliance;
use engine::traits::{DefaultEngine, MatchSetup};
use engine::types::{MatchConfig, PlayStyle, PlayerData, PlayerRole, Position, Slot, TeamData};

const SEED: u64 = 0xDEC0_DE01;

fn player(id: &str, position: Position, rating: u8) -> PlayerData {
    player_in(id, position, None, rating)
}

/// Spread a player's attributes around his rating, deterministically from his
/// id.
///
/// Uniform squads are a trap for the golden reports. Every player having the
/// same number in every attribute makes any composite exact, so a change to how
/// composites are computed — integer truncation, say — leaves the fingerprint
/// untouched. It also makes weighted selection degenerate, since every
/// candidate scores identically. Varying them gives the goldens something to
/// actually discriminate.
fn spread(id: &str, rating: u8, salt: u8) -> u8 {
    let mut hash: u32 = 2166136261;
    for byte in id.as_bytes().iter().chain(std::iter::once(&salt)) {
        hash ^= *byte as u32;
        hash = hash.wrapping_mul(16777619);
    }
    let offset = (hash % 21) as i16 - 10;
    (rating as i16 + offset).clamp(20, 95) as u8
}

fn player_in(id: &str, position: Position, slot: Option<Slot>, rating: u8) -> PlayerData {
    PlayerData {
        id: id.to_string(),
        name: format!("Player {id}"),
        position,
        ovr: rating,
        condition: 100,
        fitness: 90,
        pace: spread(id, rating, 0),
        stamina: spread(id, rating, 1),
        strength: spread(id, rating, 2),
        agility: spread(id, rating, 3),
        passing: spread(id, rating, 4),
        shooting: spread(id, rating, 5),
        tackling: spread(id, rating, 6),
        dribbling: spread(id, rating, 7),
        defending: spread(id, rating, 8),
        positioning: spread(id, rating, 9),
        vision: spread(id, rating, 10),
        decisions: spread(id, rating, 11),
        composure: spread(id, rating, 12),
        aggression: spread(id, rating, 13),
        teamwork: spread(id, rating, 14),
        leadership: spread(id, rating, 15),
        handling: spread(id, rating, 16),
        reflexes: spread(id, rating, 17),
        aerial: spread(id, rating, 18),
        traits: Vec::new(),
        slot,
        role: PlayerRole::Standard,
    }
}

/// A 4-4-2 with a given base rating, plus a seven-player bench.
fn team(id: &str, rating: u8) -> (TeamData, Vec<PlayerData>) {
    // A real 4-4-2, deployed slots and all, so the golden reports cover the
    // slot-aware selection path rather than only the coarse-position fallback.
    const BACK_FOUR: [Slot; 4] = [
        Slot::LeftBack,
        Slot::CenterBack,
        Slot::CenterBack,
        Slot::RightBack,
    ];
    const MIDFIELD_FOUR: [Slot; 4] = [
        Slot::LeftMidfielder,
        Slot::CentralMidfielder,
        Slot::DefensiveMidfielder,
        Slot::RightMidfielder,
    ];
    let mut players = vec![player_in(
        &format!("{id}-gk"),
        Position::Goalkeeper,
        Some(Slot::Goalkeeper),
        rating,
    )];
    for (index, slot) in BACK_FOUR.iter().enumerate() {
        players.push(player_in(
            &format!("{id}-d{index}"),
            Position::Defender,
            Some(*slot),
            rating,
        ));
    }
    for (index, slot) in MIDFIELD_FOUR.iter().enumerate() {
        players.push(player_in(
            &format!("{id}-m{index}"),
            Position::Midfielder,
            Some(*slot),
            rating,
        ));
    }
    for index in 0..2 {
        players.push(player_in(
            &format!("{id}-f{index}"),
            Position::Forward,
            Some(Slot::Striker),
            rating,
        ));
    }

    let mut bench = vec![player(&format!("{id}-bgk"), Position::Goalkeeper, rating - 5)];
    for index in 0..2 {
        bench.push(player(
            &format!("{id}-bd{index}"),
            Position::Defender,
            rating - 5,
        ));
    }
    for index in 0..2 {
        bench.push(player(
            &format!("{id}-bm{index}"),
            Position::Midfielder,
            rating - 5,
        ));
    }
    for index in 0..2 {
        bench.push(player(
            &format!("{id}-bf{index}"),
            Position::Forward,
            rating - 5,
        ));
    }

    let team = TeamData {
        id: id.to_string(),
        name: format!("Team {id}"),
        formation: "4-4-2".to_string(),
        play_style: PlayStyle::Balanced,
        players,
        tactics: Default::default(),
    };
    (team, bench)
}

fn setup(allows_extra_time: bool) -> MatchSetup {
    let (home, home_bench) = team("home", 70);
    let (away, away_bench) = team("away", 70);
    let mut setup = MatchSetup::league(home, away, MatchConfig::default())
        .with_benches(home_bench, away_bench);
    setup.allows_extra_time = allows_extra_time;
    setup
}

/// Format violations so a failure names the invariant and shows examples,
/// rather than dumping hundreds of near-identical lines.
fn describe(report: &compliance::ComplianceReport) -> String {
    let grouped = report.by_invariant();
    let mut sections: Vec<String> = grouped
        .iter()
        .map(|(invariant, violations)| {
            let examples: Vec<&str> = violations
                .iter()
                .take(3)
                .map(|violation| violation.detail.as_str())
                .collect();
            format!(
                "  {} — {} violation(s)\n    {}",
                invariant.name(),
                violations.len(),
                examples.join("\n    ")
            )
        })
        .collect();
    sections.sort();
    format!(
        "engine {:?} failed compliance over {} matches:\n{}",
        report.engine_id,
        report.matches_checked,
        sections.join("\n")
    )
}

#[test]
fn default_engine_is_compliant() {
    let report = compliance::run_all(&DefaultEngine, &setup(false), 400, SEED);
    assert!(report.passed(), "{}", describe(&report));
}

#[test]
fn default_engine_is_compliant_in_knockout_ties() {
    // Extra time and shootouts only exercise their invariants when the tie can
    // actually reach them, so this run uses two evenly matched sides.
    let setup = setup(true);
    let report = compliance::run_all(&DefaultEngine, &setup, 400, SEED ^ 0xFFFF);
    assert!(report.passed(), "{}", describe(&report));

    // And prove the run actually got there. This assertion exists because the
    // test spent a long time passing without it: the engine adapter rebuilt a
    // bare setup and dropped `allows_extra_time`, so four hundred "knockout"
    // matches all ended at ninety minutes and the shootout invariant was never
    // once evaluated. A compliance check that cannot reach its own subject is
    // worse than no check, because it reads as coverage.
    use engine::traits::InstantEngine;
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    let mut reached_extra_time = 0;
    let mut shootouts = 0;
    for offset in 0..400 {
        let mut rng = StdRng::seed_from_u64((SEED ^ 0xFFFF) + offset);
        let result = DefaultEngine.simulate(&setup, &mut rng);
        if result.total_minutes > 95 {
            reached_extra_time += 1;
        }
        if result.home_penalties.is_some() {
            shootouts += 1;
        }
    }
    assert!(
        reached_extra_time > 0,
        "no tie reached extra time, so the lifecycle invariant was never tested there"
    );
    assert!(
        shootouts > 0,
        "no tie reached a shootout, so the shootout invariant was never tested"
    );
}

#[test]
fn determinism_holds_across_repeated_runs() {
    let setup = setup(false);
    let mut report = compliance::ComplianceReport::default();
    for offset in 0..25 {
        compliance::check_determinism(&DefaultEngine, &setup, SEED + offset, &mut report);
    }
    assert!(
        report.passed(),
        "match replay depends on this: {}",
        describe(&report)
    );
}

/// The golden-report check that forces an `engine_version` bump.
///
/// This deliberately pins a fingerprint of the simulation's output for fixed
/// inputs. Any behaviour change breaks it — that is the point. When you have
/// intentionally changed engine behaviour, bump the engine version stamp and
/// then update the constant below with the value this test reports.
#[test]
fn golden_report_is_unchanged() {
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    use engine::traits::InstantEngine;

    let setup = setup(false);
    let mut rng = StdRng::seed_from_u64(SEED);
    let result = DefaultEngine.simulate(&setup, &mut rng);

    let mut hasher = DefaultHasher::new();
    compliance::fingerprint(&result).hash(&mut hasher);
    let actual = hasher.finish();

    // Pinned behaviour fingerprint. See the doc comment before changing.
    const GOLDEN: u64 = 0xb56e_bcc2_0fde_8e30;

    assert_eq!(
        actual, GOLDEN,
        "engine behaviour changed (fingerprint {actual:#x}). If this was \
         intentional, bump the engine version stamp and set GOLDEN to {actual:#x}."
    );
}

/// A second golden, for a side that has actually been given instructions.
///
/// `golden_report_is_unchanged` runs two default line-ups, which is a real
/// blind spot: a change that only affects non-neutral tactics leaves it
/// passing. Exactly that happened when the tactics dials were moved onto ball
/// retention — default matches were bit-identical while every instructed side
/// played differently.
#[test]
fn golden_report_is_unchanged_with_instructions() {
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    use engine::traits::InstantEngine;
    use engine::types::{
        DefensiveShape, PressingIntensity, TacticsBuildUpStyle, TacticsPitchWidth, Tempo,
    };

    let mut setup = setup(false);
    setup.home.tactics.tempo = Tempo::Patient;
    setup.home.tactics.build_up_style = TacticsBuildUpStyle::Short;
    setup.home.tactics.width = TacticsPitchWidth::Wide;
    setup.away.tactics.defensive_shape = DefensiveShape::Compact;
    setup.away.tactics.pressing_intensity = PressingIntensity::Aggressive;
    setup.away.tactics.build_up_style = TacticsBuildUpStyle::Long;

    let mut rng = StdRng::seed_from_u64(SEED);
    let result = DefaultEngine.simulate(&setup, &mut rng);

    let mut hasher = DefaultHasher::new();
    compliance::fingerprint(&result).hash(&mut hasher);
    let actual = hasher.finish();

    // Pinned behaviour fingerprint. See `golden_report_is_unchanged`.
    const GOLDEN_WITH_INSTRUCTIONS: u64 = 0x0d5a_5bf6_a7b8_273e;

    assert_eq!(
        actual, GOLDEN_WITH_INSTRUCTIONS,
        "instructed-team behaviour changed (fingerprint {actual:#x}). If this \
         was intentional, bump the engine version stamp and set \
         GOLDEN_WITH_INSTRUCTIONS to {actual:#x}."
    );
}

/// Ratings must actually discriminate.
///
/// A scale where everybody lands on the base mark is no more useful than the
/// zero it replaced, so this pins the shape of the distribution rather than
/// just its bounds.
#[test]
fn ratings_spread_across_the_scale() {
    use engine::traits::InstantEngine;
    use rand::SeedableRng;
    use rand::rngs::StdRng;

    let setup = setup(false);
    let mut all: Vec<f32> = Vec::new();
    for offset in 0..120 {
        let mut rng = StdRng::seed_from_u64(SEED + offset);
        let report = DefaultEngine.simulate(&setup, &mut rng);
        all.extend(
            report
                .player_stats
                .values()
                .filter(|stats| stats.minutes_played > 0)
                .map(|stats| stats.rating),
        );
    }
    assert!(!all.is_empty(), "no rated players");

    all.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let low = all[all.len() / 20];
    let high = all[all.len() * 19 / 20];
    let mean = all.iter().sum::<f32>() / all.len() as f32;

    assert!(
        high - low > 0.8,
        "ratings barely differ: 5th percentile {low:.2}, 95th {high:.2}"
    );
    assert!(
        (5.0..=7.5).contains(&mean),
        "the average performance should sit near the middle of the scale, got {mean:.2}"
    );
    assert!(
        all.iter().any(|rating| *rating > 7.5),
        "nobody ever has a good game, so the morale reward is unreachable"
    );
}

