//! A new world's stars belong to its big clubs (#869, GEN-1).
//!
//! The maintainer's targets for a generated world at opening, read with the reputation and
//! distribution reports: the top fifth of clubs holds at least half of the S players and the
//! bottom fifth at most 5%; the free agents hold at most 5% of S and 10% of A; a club's first team
//! is better the higher its reputation; and the world as a whole keeps its tiers (S 1 to 3%, A 5 to
//! 8% of seniors, mean rating about 68) and its rare wonderkids.

use season_harness::distribution::{DistributionReport, distribution_report};
use season_harness::reputation::{ReputationReport, reputation_report};
use season_harness::worlds::WorldSpec;

fn summary(reputation: &ReputationReport, world: &DistributionReport) -> String {
    let fifths: Vec<String> = reputation
        .quintiles
        .iter()
        .map(|group| {
            format!(
                "S {:.1}% A {:.1}% ovr {:.1}",
                group.s_share * 100.0,
                group.a_share * 100.0,
                group.first_team_ovr
            )
        })
        .collect();
    format!(
        "fifths (lowest first): [{}]; free agents S {:.1}% A {:.1}%; world S {:.2}% A {:.2}% mean {:.2} wonderkids {:.2}%",
        fifths.join("; "),
        reputation.unattached.s_share * 100.0,
        reputation.unattached.a_share * 100.0,
        world.senior_ovr_s_share * 100.0,
        world.senior_ovr_a_share * 100.0,
        world.mean_senior_ovr,
        world.wonderkid_share * 100.0,
    )
}

fn opening(seed: u64) -> (ReputationReport, DistributionReport) {
    let game = WorldSpec::shipped(seed).build().expect("the world builds");
    let (reputation, world) = (reputation_report(&game), distribution_report(&game));
    eprintln!("OPENING seed {seed}: {}", summary(&reputation, &world));
    (reputation, world)
}

/// Given the shipped world generated from a seed,
/// When it is read on its opening day,
/// Then the top reputation fifth holds at least half of the S players and the bottom fifth at most 5%.
#[test]
fn the_top_fifth_of_clubs_holds_half_of_the_stars_at_opening() {
    for seed in [1, 2] {
        let (reputation, world) = opening(seed);
        let message = summary(&reputation, &world);

        assert!(
            reputation.quintiles[4].s_share >= 0.5,
            "seed {seed}: the top fifth holds too little of S; {message}"
        );
        assert!(
            reputation.quintiles[0].s_share <= 0.05,
            "seed {seed}: the bottom fifth holds too much of S; {message}"
        );
    }
}

/// Given the shipped world on its opening day,
/// When the players no club has signed are counted,
/// Then they hold at most 5% of S and 10% of A.
#[test]
fn the_free_agents_are_mostly_ordinary_at_opening() {
    for seed in [1, 2] {
        let (reputation, world) = opening(seed);
        let message = summary(&reputation, &world);

        assert!(
            reputation.unattached.s_share <= 0.05,
            "seed {seed}: free agents hold too much of S; {message}"
        );
        assert!(
            reputation.unattached.a_share <= 0.10,
            "seed {seed}: free agents hold too much of A; {message}"
        );
    }
}

/// Given the shipped world on its opening day,
/// When the first teams of the five reputation fifths are compared,
/// Then each fifth's first team is better than the one below it.
#[test]
fn a_higher_reputation_fifth_has_a_better_first_team_at_opening() {
    for seed in [1, 2] {
        let (reputation, world) = opening(seed);
        let message = summary(&reputation, &world);

        for pair in reputation.quintiles.windows(2) {
            assert!(
                pair[0].first_team_ovr < pair[1].first_team_ovr,
                "seed {seed}: first teams do not rise with reputation; {message}"
            );
        }
    }
}

/// Given the shipped world on its opening day,
/// When the whole world is read,
/// Then its tiers, mean rating and wonderkids are what the maintainer set: giving the big clubs
///      the stars moves them, it does not make more of them.
#[test]
fn the_worlds_tiers_and_mean_are_unchanged_at_opening() {
    for seed in [1, 2] {
        let (reputation, world) = opening(seed);
        let message = summary(&reputation, &world);

        assert!(
            (0.01..=0.03).contains(&world.senior_ovr_s_share),
            "seed {seed}: S share; {message}"
        );
        assert!(
            (0.05..=0.08).contains(&world.senior_ovr_a_share),
            "seed {seed}: A share; {message}"
        );
        assert!(
            (67.0..=69.0).contains(&world.mean_senior_ovr),
            "seed {seed}: mean rating; {message}"
        );
        assert!(
            world.wonderkid_share <= 0.012,
            "seed {seed}: wonderkids; {message}"
        );
    }
}
