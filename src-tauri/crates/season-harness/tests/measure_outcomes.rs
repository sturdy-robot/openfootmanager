//! Season outcomes of the shipped world with every match real, for a before/after comparison.
//!
//! `cargo test --release -p season-harness --test measure_outcomes -- --ignored --nocapture`
//!
//! Local measuring tool for #1016 and PR 3 (never committed): goals per game, clean sheets, both teams
//! scored and home wins over every played club fixture of one season.

use domain::league::{CompetitionType, FixtureStatus};
use ofm_core::game::Game;
use season_harness::driver::{RunOptions, SeasonObserver, run_seasons};
use season_harness::worlds::{Scope, WorldSpec};

#[derive(Default)]
struct Outcomes {
    matches: u64,
    goals: u64,
    home_clean_sheets: u64,
    away_clean_sheets: u64,
    both_scored: u64,
    home_wins: u64,
}

impl SeasonObserver for Outcomes {
    fn on_before_rollover(&mut self, game: &Game, _season: u32) {
        for fixture in game
            .competitions
            .iter()
            .filter(|competition| competition.kind != CompetitionType::InternationalNation)
            .flat_map(|competition| &competition.fixtures)
            .filter(|fixture| fixture.status == FixtureStatus::Completed)
        {
            let Some(result) = &fixture.result else {
                continue;
            };
            let (home, away) = (u64::from(result.home_goals), u64::from(result.away_goals));
            self.matches += 1;
            self.goals += home + away;
            self.home_clean_sheets += u64::from(away == 0);
            self.away_clean_sheets += u64::from(home == 0);
            self.both_scored += u64::from(home > 0 && away > 0);
            self.home_wins += u64::from(home > away);
        }
    }
}

#[test]
#[ignore = "measurement, run by hand in release mode"]
fn season_outcomes_of_the_shipped_world() {
    // OUTCOME_SEED picks one seed, so each seed can run as its own job.
    let seeds: Vec<u64> = match std::env::var("OUTCOME_SEED") {
        Ok(seed) => vec![seed.parse().expect("OUTCOME_SEED is a number")],
        Err(_) => vec![1, 2],
    };
    for seed in seeds {
        let spec = WorldSpec::shipped(seed).with_scope(Scope::Everything);
        let mut game = spec.build().expect("the world builds");
        let mut outcomes = Outcomes::default();
        run_seasons(&mut game, RunOptions::seasons(1), &mut outcomes).expect("the season plays");
        let n = outcomes.matches.max(1) as f64;
        let pct = |count: u64| 100.0 * count as f64 / n;
        println!(
            "OUTCOMES shipped seed {seed}: matches {} | goals/game {:.3} | clean sheets home {:.2}% away {:.2}% | both scored {:.2}% | home wins {:.2}%",
            outcomes.matches,
            outcomes.goals as f64 / n,
            pct(outcomes.home_clean_sheets),
            pct(outcomes.away_clean_sheets),
            pct(outcomes.both_scored),
            pct(outcomes.home_wins),
        );
    }
}
