//! Whole-match simulation.
//!
//! This is a thin driver over [`crate::live_match::LiveMatchState`], not a
//! second engine. It builds the same match state the watched match uses, steps
//! it to full time with nothing driving it, and returns the report.
//!
//! It used to be a parallel implementation — its own zone resolution, its own
//! foul handling, its own fatigue model — kept roughly in sync with the live
//! one by hand. The two had already drifted: the batch copy tracked a single
//! condition scalar per team where the live one tracks each player, never
//! emitted the `EventDetail` qualifiers commentary is built from, and did not
//! apply condition to a player's effective skill. Since the league is
//! simulated by this path and the player's own match by the other, that
//! divergence meant the league table was produced by different football than
//! the match in front of them.

use rand::Rng;

use crate::live_match::LiveMatchState;
use crate::report::MatchReport;
use crate::traits::MatchSetup;
use crate::types::{MatchConfig, TeamData};

/// Simulate a full match between two teams and return a detailed report.
pub fn simulate(home: &TeamData, away: &TeamData, config: &MatchConfig) -> MatchReport {
    let mut rng = rand::rng();
    simulate_with_rng(home, away, config, &mut rng)
}

/// Simulate with an explicit RNG, which is what makes a match reproducible.
///
/// Equivalent to [`simulate_setup`] with empty benches and no extra time.
pub fn simulate_with_rng<R: Rng + ?Sized>(
    home: &TeamData,
    away: &TeamData,
    config: &MatchConfig,
    rng: &mut R,
) -> MatchReport {
    let setup = MatchSetup::league(home.clone(), away.clone(), config.clone());
    simulate_setup(&setup, rng)
}

/// Simulate a match described by `setup`.
///
/// Prefer this over [`simulate_with_rng`] when the caller has benches or a
/// knockout tie: it is the same entry point the live match uses, so a fixture
/// resolved here behaves exactly as it would if the player had watched it.
pub fn simulate_setup<R: Rng + ?Sized>(setup: &MatchSetup, rng: &mut R) -> MatchReport {
    let mut state = LiveMatchState::new(
        setup.home.clone(),
        setup.away.clone(),
        setup.config.clone(),
        setup.home_bench.clone(),
        setup.away_bench.clone(),
        setup.allows_extra_time,
    );
    run_to_completion(&mut state, rng);
    state.into_report()
}

/// Step a match to full time.
///
/// The step count is bounded rather than looping on `is_finished` alone: a
/// phase machine that failed to advance would otherwise hang the caller — and
/// this path runs unattended, over every fixture in the league. The bound is
/// far above any real match (90 + stoppage, plus extra time and a shootout that
/// can run to sudden death).
pub fn run_to_completion<R: Rng + ?Sized>(state: &mut LiveMatchState, rng: &mut R) {
    const MAX_STEPS: u32 = 1_000;

    for _ in 0..MAX_STEPS {
        if state.is_finished() {
            return;
        }
        state.step_minute(rng);
    }

    log::error!(
        "match did not finish within {MAX_STEPS} steps; stuck in {:?} at minute {}",
        state.phase(),
        state.minute()
    );
}
