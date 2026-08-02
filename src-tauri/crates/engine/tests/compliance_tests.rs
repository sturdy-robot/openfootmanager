//! Runs the engine compliance suite against the built-in engine.
//!
//! These are the invariants any engine must satisfy to be usable by the game.
//! They are the regression net for the match-engine overhaul: determinism (which
//! match replay depends on), report/event agreement, discipline, substitution
//! legality and shootout resolution.

use engine::compliance;
use engine::traits::{DefaultEngine, MatchSetup};
use engine::types::{MatchConfig, PlayStyle, PlayerData, PlayerRole, Position, TeamData};

const SEED: u64 = 0xDEC0_DE01;

fn player(id: &str, position: Position, rating: u8) -> PlayerData {
    PlayerData {
        id: id.to_string(),
        name: format!("Player {id}"),
        position,
        ovr: rating,
        condition: 100,
        fitness: 90,
        pace: rating,
        stamina: rating,
        strength: rating,
        agility: rating,
        passing: rating,
        shooting: rating,
        tackling: rating,
        dribbling: rating,
        defending: rating,
        positioning: rating,
        vision: rating,
        decisions: rating,
        composure: rating,
        aggression: rating,
        teamwork: rating,
        leadership: rating,
        handling: rating,
        reflexes: rating,
        aerial: rating,
        traits: Vec::new(),
        role: PlayerRole::Standard,
    }
}

/// A 4-4-2 with a given base rating, plus a seven-player bench.
fn team(id: &str, rating: u8) -> (TeamData, Vec<PlayerData>) {
    let mut players = vec![player(&format!("{id}-gk"), Position::Goalkeeper, rating)];
    for index in 0..4 {
        players.push(player(&format!("{id}-d{index}"), Position::Defender, rating));
    }
    for index in 0..4 {
        players.push(player(&format!("{id}-m{index}"), Position::Midfielder, rating));
    }
    for index in 0..2 {
        players.push(player(&format!("{id}-f{index}"), Position::Forward, rating));
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
    let report = compliance::run_all(&DefaultEngine, &setup(true), 400, SEED ^ 0xFFFF);
    assert!(report.passed(), "{}", describe(&report));
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
    const GOLDEN: u64 = 0x9e58_4b34_b06a_9135;

    assert_eq!(
        actual, GOLDEN,
        "engine behaviour changed (fingerprint {actual:#x}). If this was \
         intentional, bump the engine version stamp and set GOLDEN to {actual:#x}."
    );
}
