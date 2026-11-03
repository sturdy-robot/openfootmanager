//! How much the world's staff move, role by role, over twenty seasons: the baseline the AI staff
//! management slices are measured against (hires, moves, releases, exits, the market's size and
//! the days clubs go without a role).
//!
//! Measurement only: the test is `#[ignore]`d and prints its numbers, so it runs outside the PR
//! gate, in release mode like the shipped game:
//!
//! `cargo test --release -p season-harness --test measure_staff_churn -- --ignored --nocapture`

use season_harness::driver::{RunOptions, run_seasons};
use season_harness::staff_churn::{ROLES, StaffChurnLog};
use season_harness::worlds::WorldSpec;

const SEASONS: u32 = 20;

fn measure(name: &str, spec: WorldSpec) {
    let mut game = spec.build().expect("the world builds");
    let clubs = game.teams.len();
    eprintln!("{name} ({clubs} clubs)");
    let mut log = StaffChurnLog::starting_from(&game);
    run_seasons(&mut game, RunOptions::seasons(SEASONS), &mut log).expect("the run completes");
    for (index, season) in log.seasons.iter().enumerate() {
        for (role, churn) in ROLES.iter().zip(season.iter()) {
            eprintln!(
                "season {:>2} | {:<16} | hires {:>4} moves {:>4} releases {:>4} club exits {:>4} | market +{:>4} -{:>4} size {:>4}..{:>4} | vacant club-days {:>6}",
                index + 1,
                format!("{role:?}"),
                churn.hires,
                churn.moves,
                churn.releases,
                churn.club_exits,
                churn.market_entrants,
                churn.market_exits,
                churn.market_min,
                churn.market_max,
                churn.vacant_club_days,
            );
        }
    }
}

/// Given the shipped world on seeds 1 and 2
/// When twenty seasons are played
/// Then each role's churn is printed per season: hires, moves, releases and exits at clubs, the
///      market's entrants, exits and size range, and the days clubs went without the role.
#[test]
#[ignore = "measurement, run by hand in release mode"]
fn the_staff_churn_over_twenty_seasons() {
    for seed in 1..=2 {
        measure(
            &format!("shipped world, seed {seed}"),
            WorldSpec::shipped(seed),
        );
    }
}
