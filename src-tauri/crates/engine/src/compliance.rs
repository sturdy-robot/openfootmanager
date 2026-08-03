//! The engine compliance suite.
//!
//! Invariants that any match-simulation engine must satisfy to be usable by the
//! game. This is deliberately a *library* function rather than a test module, so
//! that a replacement engine can be checked by the same code that checks the
//! built-in one — `sim-bench` runs it, and so does the engine's own test suite.
//!
//! The suite exists for two reasons beyond correctness:
//!
//! - **Replay.** Match replay works by re-simulating from a stored seed, so
//!   determinism is not a nicety — a non-deterministic engine silently
//!   reconstructs the *wrong* match and presents it as history. Check
//!   [`Invariant::Determinism`] is what protects that, including the
//!   cross-process case: `HashMap` iteration order in Rust is randomly seeded
//!   per process, so an engine that lets collection order influence the
//!   simulation would replay differently after a restart.
//! - **Version discipline.** [`Invariant::GoldenReport`] pins a hash of the
//!   report for fixed inputs. Any behaviour change breaks it, which forces the
//!   `engine_version` stamp to be bumped before the change can land.

use std::collections::{HashMap, HashSet};

use rand::SeedableRng;
use rand::rngs::StdRng;

use crate::event::EventType;
use crate::report::MatchReport;
use crate::traits::{InstantEngine, MatchSetup};
use crate::types::Side;

/// A single checked property.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Invariant {
    /// Same seed and inputs produce the same report.
    Determinism,
    /// Report aggregates agree with the event log.
    ReportConsistency,
    /// Per-player stats are attributable and within bounds.
    PlayerStats,
    /// Cards and dismissals are legal and respected.
    Discipline,
    /// Substitutions are legal and honoured.
    Substitutions,
    /// Phases, minutes and event timing are coherent.
    Lifecycle,
    /// Shootouts resolve to a strict winner and never leak into match goals.
    Shootout,
    /// Behaviour is unchanged since the pinned golden hash.
    GoldenReport,
}

impl Invariant {
    pub fn name(self) -> &'static str {
        match self {
            Invariant::Determinism => "determinism",
            Invariant::ReportConsistency => "report-consistency",
            Invariant::PlayerStats => "player-stats",
            Invariant::Discipline => "discipline",
            Invariant::Substitutions => "substitutions",
            Invariant::Lifecycle => "lifecycle",
            Invariant::Shootout => "shootout",
            Invariant::GoldenReport => "golden-report",
        }
    }
}

/// One failed expectation.
#[derive(Debug, Clone)]
pub struct Violation {
    pub invariant: Invariant,
    /// What went wrong, with the concrete values involved.
    pub detail: String,
}

/// The outcome of a compliance run.
#[derive(Debug, Clone, Default)]
pub struct ComplianceReport {
    pub engine_id: String,
    pub matches_checked: u32,
    pub violations: Vec<Violation>,
}

impl ComplianceReport {
    pub fn passed(&self) -> bool {
        self.violations.is_empty()
    }

    /// Violations grouped by invariant, for reporting.
    pub fn by_invariant(&self) -> HashMap<Invariant, Vec<&Violation>> {
        let mut grouped: HashMap<Invariant, Vec<&Violation>> = HashMap::new();
        for violation in &self.violations {
            grouped
                .entry(violation.invariant)
                .or_default()
                .push(violation);
        }
        grouped
    }

    fn fail(&mut self, invariant: Invariant, detail: impl Into<String>) {
        self.violations.push(Violation {
            invariant,
            detail: detail.into(),
        });
    }
}

/// Run every invariant against `engine`, simulating `matches` fixtures from
/// `setup`. `matches` should be at least a few hundred for the discipline and
/// shootout checks to see enough rare events to be meaningful.
pub fn run_all<E: InstantEngine + ?Sized>(
    engine: &E,
    setup: &MatchSetup,
    matches: u32,
    base_seed: u64,
) -> ComplianceReport {
    let mut report = ComplianceReport {
        engine_id: engine.id().to_string(),
        matches_checked: matches,
        ..Default::default()
    };

    check_determinism(engine, setup, base_seed, &mut report);

    for index in 0..matches {
        let seed = base_seed.wrapping_add(index as u64);
        let mut rng = StdRng::seed_from_u64(seed);
        let result = engine.simulate(setup, &mut rng);
        check_one(&result, setup, seed, &mut report);
    }

    report
}

/// The determinism check, isolated so callers can run it on its own — for
/// example across two processes, which is the case that catches
/// order-dependent `HashMap` iteration.
pub fn check_determinism<E: InstantEngine + ?Sized>(
    engine: &E,
    setup: &MatchSetup,
    seed: u64,
    report: &mut ComplianceReport,
) {
    let mut first_rng = StdRng::seed_from_u64(seed);
    let first = engine.simulate(setup, &mut first_rng);

    let mut second_rng = StdRng::seed_from_u64(seed);
    let second = engine.simulate(setup, &mut second_rng);

    for detail in compare_reports(&first, &second) {
        report.fail(Invariant::Determinism, detail);
    }
}

/// A stable fingerprint of a report's simulated content.
///
/// Compares *semantics*, not serialized bytes: `MatchReport::player_stats` is a
/// `HashMap`, whose serialization order varies between processes, so a byte
/// comparison would report spurious differences. Everything here is either
/// scalar or drawn from the ordered event log.
pub fn fingerprint(report: &MatchReport) -> String {
    let mut parts = vec![
        format!("score={}:{}", report.home_goals, report.away_goals),
        format!("minutes={}", report.total_minutes),
        format!("possession={:.4}", report.home_possession),
        format!(
            "pens={:?}:{:?}",
            report.home_penalties, report.away_penalties
        ),
    ];
    // Team stats are included even though they are derived from the events,
    // because a change to how they are derived is a change the player sees on
    // the stat sheet and must therefore trip the golden check too.
    for (label, stats) in [("home", &report.home_stats), ("away", &report.away_stats)] {
        parts.push(format!(
            "{label}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
            stats.goals,
            stats.shots,
            stats.shots_on_target,
            stats.shots_off_target,
            stats.shots_blocked,
            stats.passes_completed,
            stats.passes_intercepted,
            stats.tackles,
            stats.interceptions,
            stats.fouls,
            stats.corners,
            stats.free_kicks,
            stats.penalties,
            stats.yellow_cards,
        ));
        // Expected goals is in here deliberately. It draws nothing from the
        // random stream, so a change to how a chance is valued moves no
        // scoreline and no event — and would slip past a fingerprint made only
        // of things that happened. Formatted to four places so the check is
        // about the model and not about floating-point noise.
        parts.push(format!("{label}-xg|{:.4}", stats.xg));
    }
    // Momentum is in here for the same reason expected goals is: it changes
    // nothing that happens, so a change to how it is measured moves no
    // scoreline and would slip past a fingerprint made only of events. It is
    // persisted to saves now, which makes a silent change to it worse than a
    // loud one. Four places, so the check is about the model rather than
    // floating-point noise.
    for minute in &report.momentum {
        parts.push(format!(
            "mom|{}|{:.4}|{:.4}",
            minute.minute, minute.home, minute.away
        ));
    }
    for event in &report.events {
        parts.push(format!(
            "{}|{:?}|{:?}|{:?}|{}|{}|{:?}",
            event.minute,
            event.event_type,
            event.side,
            event.zone,
            event.player_id.as_deref().unwrap_or("-"),
            event.secondary_player_id.as_deref().unwrap_or("-"),
            event.detail,
        ));
    }
    // Player stats are sorted by id so HashMap ordering cannot leak in.
    let mut ids: Vec<&String> = report.player_stats.keys().collect();
    ids.sort();
    for id in ids {
        let stats = &report.player_stats[id];
        parts.push(format!(
            "{id}|{}|{}|{}|{}|{}|{}",
            stats.minutes_played,
            stats.goals,
            stats.assists,
            stats.shots,
            stats.passes_completed,
            stats.rating,
        ));
    }
    parts.join("\n")
}

fn compare_reports(first: &MatchReport, second: &MatchReport) -> Vec<String> {
    let (left, right) = (fingerprint(first), fingerprint(second));
    if left == right {
        return Vec::new();
    }
    // Report the first differing line rather than two large blobs.
    let diff = left
        .lines()
        .zip(right.lines())
        .find(|(a, b)| a != b)
        .map(|(a, b)| format!("first difference: {a:?} vs {b:?}"))
        .unwrap_or_else(|| {
            format!(
                "differing length: {} vs {} lines",
                left.lines().count(),
                right.lines().count()
            )
        });
    vec![format!(
        "same seed produced different reports — {diff}. A non-deterministic \
         engine cannot support replay."
    )]
}

fn check_one(result: &MatchReport, setup: &MatchSetup, seed: u64, report: &mut ComplianceReport) {
    check_report_consistency(result, seed, report);
    check_player_stats(result, setup, seed, report);
    check_discipline(result, seed, report);
    check_substitutions(result, setup, seed, report);
    check_lifecycle(result, seed, report);
    check_shootout(result, seed, report);
}

fn check_report_consistency(result: &MatchReport, seed: u64, report: &mut ComplianceReport) {
    for side in [Side::Home, Side::Away] {
        let goal_events = result
            .events
            .iter()
            .filter(|e| e.side == side && e.is_goal())
            .count();
        let recorded = match side {
            Side::Home => result.home_goals,
            Side::Away => result.away_goals,
        };
        if goal_events != recorded as usize {
            report.fail(
                Invariant::ReportConsistency,
                format!(
                    "seed {seed}: {side:?} recorded {recorded} goals but the event log has \
                     {goal_events} goal events"
                ),
            );
        }

        let stats = match side {
            Side::Home => &result.home_stats,
            Side::Away => &result.away_stats,
        };
        let parts = stats.shots_on_target + stats.shots_off_target + stats.shots_blocked;
        if stats.shots != parts {
            report.fail(
                Invariant::ReportConsistency,
                format!(
                    "seed {seed}: {side:?} shots={} but on-target+off-target+blocked={parts}",
                    stats.shots
                ),
            );
        }
    }

    if !(0.0..=100.0).contains(&result.home_possession) {
        report.fail(
            Invariant::ReportConsistency,
            format!(
                "seed {seed}: home possession {:.2} is outside 0–100",
                result.home_possession
            ),
        );
    }
}

fn check_player_stats(
    result: &MatchReport,
    setup: &MatchSetup,
    seed: u64,
    report: &mut ComplianceReport,
) {
    let known: HashSet<&str> = setup
        .home
        .players
        .iter()
        .chain(setup.away.players.iter())
        .chain(setup.home_bench.iter())
        .chain(setup.away_bench.iter())
        .map(|p| p.id.as_str())
        .collect();

    for (id, stats) in &result.player_stats {
        if !known.contains(id.as_str()) {
            report.fail(
                Invariant::PlayerStats,
                format!("seed {seed}: stats recorded for unknown player {id}"),
            );
        }
        if stats.minutes_played > result.total_minutes {
            report.fail(
                Invariant::PlayerStats,
                format!(
                    "seed {seed}: player {id} played {} minutes in a {}-minute match",
                    stats.minutes_played, result.total_minutes
                ),
            );
        }
        if stats.shots_on_target > stats.shots {
            report.fail(
                Invariant::PlayerStats,
                format!(
                    "seed {seed}: player {id} has {} shots on target from {} shots",
                    stats.shots_on_target, stats.shots
                ),
            );
        }
        if stats.passes_completed > stats.passes_attempted {
            report.fail(
                Invariant::PlayerStats,
                format!(
                    "seed {seed}: player {id} completed {} of {} attempted passes",
                    stats.passes_completed, stats.passes_attempted
                ),
            );
        }
        if !(0.0..=10.0).contains(&stats.rating) {
            report.fail(
                Invariant::PlayerStats,
                format!(
                    "seed {seed}: player {id} has rating {:.2}, outside 0–10",
                    stats.rating
                ),
            );
        }
    }
}

fn check_discipline(result: &MatchReport, seed: u64, report: &mut ComplianceReport) {
    let mut dismissed_at: HashMap<&str, u8> = HashMap::new();
    let mut yellows: HashMap<&str, u8> = HashMap::new();

    for event in &result.events {
        let Some(player) = event.player_id.as_deref() else {
            continue;
        };
        match event.event_type {
            EventType::YellowCard => {
                let count = yellows.entry(player).or_insert(0);
                *count += 1;
                if *count > 2 {
                    report.fail(
                        Invariant::Discipline,
                        format!(
                            "seed {seed}: player {player} received {count} yellow cards without \
                             being dismissed"
                        ),
                    );
                }
            }
            EventType::RedCard | EventType::SecondYellow => {
                dismissed_at.entry(player).or_insert(event.minute);
            }
            _ => {}
        }
    }

    // A dismissed player must not act again. Substitution events are excluded:
    // a sending-off legitimately appears alongside bench reshuffles.
    for event in &result.events {
        let Some(player) = event.player_id.as_deref() else {
            continue;
        };
        if matches!(
            event.event_type,
            EventType::RedCard | EventType::SecondYellow | EventType::Substitution
        ) {
            continue;
        }
        if let Some(&minute) = dismissed_at.get(player)
            && event.minute > minute
        {
            report.fail(
                Invariant::Discipline,
                format!(
                    "seed {seed}: player {player} was dismissed in minute {minute} but has a \
                     {:?} event in minute {}",
                    event.event_type, event.minute
                ),
            );
        }
    }
}

fn check_substitutions(
    result: &MatchReport,
    setup: &MatchSetup,
    seed: u64,
    report: &mut ComplianceReport,
) {
    let bench: HashSet<&str> = setup
        .home_bench
        .iter()
        .chain(setup.away_bench.iter())
        .map(|p| p.id.as_str())
        .collect();

    let mut subs_by_side: HashMap<Side, u8> = HashMap::new();
    for event in &result.events {
        if event.event_type != EventType::Substitution {
            continue;
        }
        *subs_by_side.entry(event.side).or_insert(0) += 1;

        // The player coming on must have started on the bench.
        if let Some(on) = event.player_id.as_deref()
            && !bench.is_empty()
            && !bench.contains(on)
        {
            report.fail(
                Invariant::Substitutions,
                format!("seed {seed}: player {on} came on but was not on the bench"),
            );
        }
    }

    for (side, count) in subs_by_side {
        // Five is the engine's `max_subs`; an engine may allow fewer but never
        // more without the game having agreed to it.
        if count > 5 {
            report.fail(
                Invariant::Substitutions,
                format!("seed {seed}: {side:?} made {count} substitutions, more than the maximum"),
            );
        }
    }
}

fn check_lifecycle(result: &MatchReport, seed: u64, report: &mut ComplianceReport) {
    if result.total_minutes < 90 {
        report.fail(
            Invariant::Lifecycle,
            format!(
                "seed {seed}: match lasted {} minutes, fewer than 90",
                result.total_minutes
            ),
        );
    }

    for event in &result.events {
        if event.minute > result.total_minutes {
            report.fail(
                Invariant::Lifecycle,
                format!(
                    "seed {seed}: {:?} event in minute {} of a {}-minute match",
                    event.event_type, event.minute, result.total_minutes
                ),
            );
        }
    }

    // The event log must be chronological — replay feeds it back in order.
    if let Some((previous, current)) = result
        .events
        .windows(2)
        .map(|pair| (&pair[0], &pair[1]))
        .find(|(a, b)| b.minute < a.minute)
    {
        report.fail(
            Invariant::Lifecycle,
            format!(
                "seed {seed}: event log is out of order — minute {} ({:?}) precedes minute {} ({:?})",
                previous.minute, previous.event_type, current.minute, current.event_type
            ),
        );
    }
}

fn check_shootout(result: &MatchReport, seed: u64, report: &mut ComplianceReport) {
    let shootout_events = result
        .events
        .iter()
        .filter(|e| {
            matches!(
                e.event_type,
                EventType::ShootoutGoal | EventType::ShootoutMiss
            )
        })
        .count();

    match (result.home_penalties, result.away_penalties) {
        (Some(home), Some(away)) => {
            if home == away {
                report.fail(
                    Invariant::Shootout,
                    format!("seed {seed}: shootout ended level at {home}-{away}"),
                );
            }
            if shootout_events == 0 {
                report.fail(
                    Invariant::Shootout,
                    format!("seed {seed}: shootout score recorded but no shootout kicks logged"),
                );
            }
        }
        (None, None) => {
            if shootout_events > 0 {
                report.fail(
                    Invariant::Shootout,
                    format!(
                        "seed {seed}: {shootout_events} shootout kicks logged but no shootout \
                         score recorded"
                    ),
                );
            }
        }
        _ => report.fail(
            Invariant::Shootout,
            format!(
                "seed {seed}: only one side has a shootout score ({:?} vs {:?})",
                result.home_penalties, result.away_penalties
            ),
        ),
    }

    // Shootout kicks must never count as match goals.
    let shootout_goals = result
        .events
        .iter()
        .filter(|e| e.event_type == EventType::ShootoutGoal)
        .count();
    if shootout_goals > 0 {
        let counted = result.events.iter().filter(|e| e.is_goal()).count();
        if counted != (result.home_goals + result.away_goals) as usize {
            report.fail(
                Invariant::Shootout,
                format!("seed {seed}: shootout kicks leaked into the match score"),
            );
        }
    }
}
