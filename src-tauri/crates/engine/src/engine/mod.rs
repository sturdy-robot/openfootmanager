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

use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};

use crate::ai;
use crate::live_match::LiveMatchState;
use crate::report::MatchReport;
use crate::traits::MatchSetup;
use crate::types::{MatchConfig, Side, TeamData};

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

    // The dugouts draw from their own stream, seeded from the match stream.
    // Keeping them apart means a change to how managers decide cannot shift
    // the simulation's own draws, which is what lets one thing be varied at a
    // time and compared against a fixed seed set.
    //
    // Derived only when someone is actually in a dugout: seeding it
    // unconditionally would consume a draw from the match stream and change the
    // result of every match that has no managers at all.
    let mut manager_rng = (setup.home_manager.is_some() || setup.away_manager.is_some())
        .then(|| StdRng::seed_from_u64(rng.next_u64()));

    const MAX_STEPS: u32 = 1_000;
    for _ in 0..MAX_STEPS {
        if state.is_finished() {
            return state.into_report();
        }
        let result = state.step_minute(rng);
        if let Some(manager_rng) = manager_rng.as_mut()
            && !result.is_finished
        {
            apply_manager_decisions(&mut state, setup, manager_rng);
        }
    }

    // A phase machine that stopped advancing would otherwise hang the caller,
    // and this path runs unattended over every fixture in the league. The bound
    // is far above any real match: 90 minutes plus stoppage, extra time, and a
    // shootout that can reach sudden death.
    log::error!(
        "match did not finish within {MAX_STEPS} steps; stuck in {:?} at minute {}",
        state.phase(),
        state.minute()
    );
    state.into_report()
}

/// Let each side's manager act, as the live match does between minutes.
///
/// Without this an unattended fixture has nobody in the dugout: players tire
/// for ninety minutes and are never replaced, which contradicts the fatigue
/// model the same match is running.
fn apply_manager_decisions<R: Rng + ?Sized>(
    state: &mut LiveMatchState,
    setup: &MatchSetup,
    rng: &mut R,
) {
    for (side, profile) in [
        (Side::Home, setup.home_manager.as_ref()),
        (Side::Away, setup.away_manager.as_ref()),
    ] {
        let Some(profile) = profile else { continue };
        for command in ai::ai_decide(state, side, profile, rng) {
            // A rejected command (an ineligible substitute, no subs left)
            // simply means the manager wanted something they could not have.
            let _ = state.apply_command(command);
        }
    }
}
