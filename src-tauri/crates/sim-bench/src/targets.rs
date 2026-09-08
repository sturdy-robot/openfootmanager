//! Real-football calibration bands, in one place.
//!
//! These were previously written out three times — inline `check(..)` calls in
//! the terminal report, a table in the HTML report, and a third copy driving
//! the HTML colour classes — and had already drifted apart: home win % existed
//! only in HTML, away clean sheets only in the terminal. Every consumer now
//! reads this table, and the JSON output carries the verdicts so a caller (CI,
//! a diff against a stored baseline) can act on them without re-encoding the
//! numbers.
//!
//! # These bands hold for the reference seed, and only for it
//!
//! `--seed` does not draw another sample of the same league — it generates a
//! different one. The squads, and therefore the balance of the whole
//! competition, come from it. So two seeds are two different worlds, and the
//! spread between them is not sampling noise and must not be read as though it
//! were: a metric that sits inside its band on one seed can sit well outside it
//! on another with nothing wrong.
//!
//! Calibrate against **seed 20260802**. Comparing a candidate change against
//! the baseline on a *different* seed measures the seed.
//!
//! # The bench does not play a league
//!
//! `main.rs` builds one home side and one away side, then re-simulates that
//! fixture `--games` times. The scoreline bands below are percentiles across
//! real league-seasons. Those are different experimental units, and raising
//! `--games` does not reconcile them — it estimates one accidental fixture more
//! sharply while adding none of the team-strength spread a league has.
//!
//! So the five scoreline bands are listed in [`NOT_COMPARABLE`] and cannot fail
//! a run. They are a measurement to steer by, not a gate to satisfy, and the
//! way to promote them is to make the bench simulate the unit they were
//! measured over — not to raise `--games` until the numbers settle.

use serde::Serialize;

use crate::stats::BenchStats;

/// How a metric should be rendered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Unit {
    /// A plain rate, e.g. goals per game.
    PerGame,
    /// A percentage, 0–100.
    Percent,
}

impl Unit {
    /// Render a value in this unit. Lives here so every consumer formats the
    /// same number the same way.
    pub fn value(self, value: f64) -> String {
        match self {
            Unit::PerGame => format!("{value:.2}"),
            Unit::Percent => format!("{value:.1}%"),
        }
    }

    /// Render a band, e.g. `2.30–3.00` or `32–45%`.
    pub fn band(self, low: f64, high: f64) -> String {
        match self {
            Unit::PerGame => format!("{low:.2}–{high:.2}"),
            Unit::Percent => format!("{low:.0}–{high:.0}%"),
        }
    }
}

/// Where a band came from.
///
/// Required on every target, because the alternative is what this table used to
/// be: twenty-one numbers under a comment claiming "sources are top-flight
/// European league averages", with no source recorded for any of them and no
/// way to tell which had been checked. Two that were spot-checked against
/// published figures turned out to be wrong.
///
/// A band nobody can point at is not a target. It is somebody's recollection,
/// and calibrating an engine against it means tuning toward a number that
/// cannot be defended — so an unsourced band is reported and never enforced.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Provenance {
    /// Taken from a named source. Every field is required: a citation that
    /// cannot be followed back is not a citation.
    ///
    /// The shape is enforced by
    /// `provenance_tests::a_measured_band_can_be_followed_back_to_its_source`:
    /// every field must be non-empty, because inventing a plausible citation
    /// would be worse than the unsourced numbers this type exists to expose —
    /// it would make them look checked.
    ///
    /// Measured is a claim about where the *band* came from, and nothing more.
    /// It does not assert that the bench simulates the population the band was
    /// measured over; [`NOT_COMPARABLE`] carries that, separately.
    Measured {
        source: &'static str,
        competition: &'static str,
        season: &'static str,
        /// When the figure was read. Published aggregates are restated as
        /// seasons are added, so a number without a date cannot be checked
        /// against its source later.
        ///
        /// A band derived from a pinned revision records *that commit's* date,
        /// not the day somebody ran the script: the commit is what the number
        /// can be re-derived from, and a wall-clock date would stop the
        /// artifact regenerating byte-for-byte.
        retrieved: &'static str,
    },
    /// Not a claim about football at all: an assertion about the simulation.
    ///
    /// "No forward finishes a match having never passed the ball" is not a
    /// statistic anybody publishes; it is how we say the engine is not broken.
    /// These are enforced, because nothing about them depends on a source.
    ModelInvariant { why: &'static str },
    /// A number somebody typed. Reported, never enforced, and the count only
    /// goes down — see [`UNSOURCED_BUDGET`].
    Unsourced,
}

impl Provenance {
    /// Whether a run may be failed on this band.
    ///
    /// The whole point of the split. An unsourced band still appears in the
    /// report — it is a useful orientation — but it cannot fail CI and must not
    /// be a calibration target, because tuning the engine to satisfy a number
    /// with no source is how a wrong number becomes engine behaviour.
    pub fn enforceable(self) -> bool {
        !matches!(self, Provenance::Unsourced)
    }
}

/// One calibrated metric: what it is, what the engine produced, the band it is
/// expected to land in, and where that band came from.
#[derive(Debug, Clone)]
pub struct Target {
    pub label: &'static str,
    pub unit: Unit,
    pub low: f64,
    pub high: f64,
    /// Reads the metric off a completed run.
    pub read: fn(&BenchStats) -> f64,
    /// Why this band, when the number is not self-evident.
    pub note: Option<&'static str>,
    /// Where the band came from. No default: a new target must say.
    pub provenance: Provenance,
}

impl Target {
    pub fn value(&self, stats: &BenchStats) -> f64 {
        (self.read)(stats)
    }

    pub fn passes(&self, stats: &BenchStats) -> bool {
        let value = self.value(stats);
        value >= self.low && value <= self.high
    }
}

/// The calibration table.
///
/// Every band records where it came from, and **fifteen of the twenty-one still
/// say `Unsourced`** — numbers written down under a comment claiming they were
/// top-flight European league averages, with nothing recorded to support it,
/// and two of two spot-checks against published figures coming back wrong.
///
/// They are kept and reported, because they are a useful orientation and
/// throwing them away would lose the only picture the bench has. They are not
/// enforced, because an unsourced band is not a target: calibrating to satisfy
/// one is how somebody's recollection becomes engine behaviour.
///
/// The five scoreline bands are the exception. `scripts/calibrate-scorelines.mjs`
/// derives them from 14,534 real matches, and `derived_band_tests` checks this
/// table against the artifact it writes — consistency, not correctness: the two
/// can still be edited together, and the script is what makes them true.
/// Sourcing them found a third wrong number — home and away clean sheets had
/// been given the *same* band, 22–35%, when real football splits them 27–36%
/// and 18–25%. Home advantage is most of the difference, and the old table had
/// it nowhere.
///
/// They are `Measured` but not enforced: see [`NOT_COMPARABLE`]. Measured says
/// the band can be followed back to a source; it does not say the bench plays
/// the thing the band describes, and today it does not.
///
/// Where the engine is outside an *enforced* band, that is recorded as debt in
/// `KNOWN_FAILING` rather than by widening the band — a target that moves to
/// match the engine stops being a target.
pub fn all() -> Vec<Target> {
    vec![
        Target {
            label: "Goals/game",
            unit: Unit::PerGame,
            low: 2.55,
            high: 3.13,
            read: |s| s.gpg(),
            note: None,
            provenance: Provenance::Measured {
                source: "openfootball/football.json @ 4e4146c9 (CC0-1.0)",
                competition: "Big-five European top flights",
                season: "2014-15 to 2023-24, the 8 seasons all five ran complete outside the pandemic",
                retrieved: "2026-08-26",
            },
        },
        Target {
            label: "Clean sheets (home)",
            unit: Unit::Percent,
            low: 27.0,
            high: 36.0,
            read: |s| s.clean_sheet_home_pct(),
            note: None,
            provenance: Provenance::Measured {
                source: "openfootball/football.json @ 4e4146c9 (CC0-1.0)",
                competition: "Big-five European top flights",
                season: "2014-15 to 2023-24, the 8 seasons all five ran complete outside the pandemic",
                retrieved: "2026-08-26",
            },
        },
        Target {
            label: "Clean sheets (away)",
            unit: Unit::Percent,
            low: 18.0,
            high: 25.0,
            read: |s| s.clean_sheet_away_pct(),
            note: None,
            provenance: Provenance::Measured {
                source: "openfootball/football.json @ 4e4146c9 (CC0-1.0)",
                competition: "Big-five European top flights",
                season: "2014-15 to 2023-24, the 8 seasons all five ran complete outside the pandemic",
                retrieved: "2026-08-26",
            },
        },
        Target {
            label: "Both teams scored",
            unit: Unit::Percent,
            low: 48.0,
            high: 60.0,
            read: |s| s.btts_pct(),
            note: None,
            provenance: Provenance::Measured {
                source: "openfootball/football.json @ 4e4146c9 (CC0-1.0)",
                competition: "Big-five European top flights",
                season: "2014-15 to 2023-24, the 8 seasons all five ran complete outside the pandemic",
                retrieved: "2026-08-26",
            },
        },
        Target {
            label: "Home win %",
            unit: Unit::Percent,
            low: 41.0,
            high: 49.0,
            read: |s| s.home_win_pct(),
            note: Some("Between evenly matched sides; a stronger home side raises this."),
            provenance: Provenance::Measured {
                source: "openfootball/football.json @ 4e4146c9 (CC0-1.0)",
                competition: "Big-five European top flights",
                season: "2014-15 to 2023-24, the 8 seasons all five ran complete outside the pandemic",
                retrieved: "2026-08-26",
            },
        },
        Target {
            label: "Shots/game",
            unit: Unit::PerGame,
            low: 18.0,
            high: 32.0,
            read: |s| s.shots_pg(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Shots on target %",
            unit: Unit::Percent,
            low: 32.0,
            high: 45.0,
            read: |s| s.shot_accuracy_pct(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Goal conversion %",
            unit: Unit::Percent,
            low: 20.0,
            high: 40.0,
            read: |s| s.goal_conversion_pct(),
            note: Some("Goals as a share of shots on target."),
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Yellow cards/game",
            unit: Unit::PerGame,
            low: 2.0,
            high: 4.0,
            read: |s| s.yellows_pg(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Red cards/game",
            unit: Unit::PerGame,
            low: 0.05,
            high: 0.15,
            read: |s| s.reds_pg(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Fouls/game",
            unit: Unit::PerGame,
            low: 18.0,
            high: 28.0,
            read: |s| s.fouls_pg(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Penalties/game",
            unit: Unit::PerGame,
            low: 0.20,
            high: 0.50,
            read: |s| s.penalties_pg(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Penalty conversion %",
            unit: Unit::Percent,
            low: 65.0,
            high: 85.0,
            read: |s| s.penalty_conversion_pct(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Corners/game",
            unit: Unit::PerGame,
            low: 8.0,
            high: 14.0,
            read: |s| s.corners_pg(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Goal kicks/game",
            unit: Unit::PerGame,
            low: 8.0,
            high: 14.0,
            read: |s| s.goal_kicks_pg(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Crosses/game",
            unit: Unit::PerGame,
            low: 15.0,
            high: 30.0,
            read: |s| s.crosses_pg(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Open play goals %",
            unit: Unit::Percent,
            low: 60.0,
            high: 75.0,
            read: |s| s.open_play_goal_pct(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Corner goals %",
            unit: Unit::Percent,
            low: 10.0,
            high: 20.0,
            read: |s| s.corner_goal_pct(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Free kick goals %",
            unit: Unit::Percent,
            low: 5.0,
            high: 15.0,
            read: |s| s.free_kick_goal_pct(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Penalty goals %",
            unit: Unit::Percent,
            low: 5.0,
            high: 15.0,
            read: |s| s.penalty_goal_pct(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Forwards with 0 passes %",
            unit: Unit::Percent,
            low: 0.0,
            high: 2.0,
            read: |s| s.positions.forwards_with_zero_passes_pct(),
            note: Some(
                "A forward who never touches the ball in 90 minutes is a \
                 simulation artefact, not a football event.",
            ),
            provenance: Provenance::ModelInvariant {
                why: "Nobody publishes this. It is not a football statistic — it \
                      is how the bench says a forward is being simulated as a \
                      footballer rather than as a shot generator.",
            },
        },
    ]
}

/// How many bands are still allowed to have no source.
///
/// A ratchet, not a budget to spend: the test below fails if the count rises,
/// so a new target must come with a citation, and the number comes down as the
/// existing ones are sourced. It cannot be raised to make a build pass without
/// that being the whole of the diff.
pub const UNSOURCED_BUDGET: usize = 15;

/// Bands whose population `sim-bench` does not reproduce, and therefore cannot
/// be enforced no matter how many games are run.
///
/// The scoreline bands are percentiles across real *league-seasons*: 306–380
/// fixtures between 18–20 different clubs. `main.rs` builds one home side and
/// one away side, then re-simulates that single fixture `--games` times. Both
/// default to rating 70, but `build_team` samples attributes around that, so
/// the two realised squads are not equal — and whichever drew better moves
/// home win %, clean sheets and both-teams-scored directly.
///
/// That is a mismatch of experimental unit, not of precision. Raising
/// `--games` estimates one accidental fixture more sharply; it never adds the
/// team-strength spread a league has, and it never averages out the roster
/// draw. So a miss here says nothing about the engine, and a pass says nothing
/// either.
///
/// Entries leave this list when the bench simulates the unit the band was
/// measured over — many team pairs with mirrored home and away legs at the
/// least, whole synthetic league-seasons ideally. Until then the bands are
/// reported, and the report is the point: they are a measurement to steer by,
/// not a gate to satisfy.
pub const NOT_COMPARABLE: &[(&str, &str)] = &[
    (
        "Goals/game",
        "The band is a percentile across real league-seasons — 306–380 fixtures \
         between 18–20 clubs. The bench builds one home side and one away side \
         and replays that single fixture, so the comparison is between unlike \
         units and no value of `--games` closes the gap. Reported, not enforced, \
         until the bench simulates league-shaped populations.",
    ),
    (
        "Clean sheets (home)",
        "The band is a percentile across real league-seasons — 306–380 fixtures \
         between 18–20 clubs. The bench builds one home side and one away side \
         and replays that single fixture, so the comparison is between unlike \
         units and no value of `--games` closes the gap. Reported, not enforced, \
         until the bench simulates league-shaped populations.",
    ),
    (
        "Clean sheets (away)",
        "The band is a percentile across real league-seasons — 306–380 fixtures \
         between 18–20 clubs. The bench builds one home side and one away side \
         and replays that single fixture, so the comparison is between unlike \
         units and no value of `--games` closes the gap. Reported, not enforced, \
         until the bench simulates league-shaped populations.",
    ),
    (
        "Both teams scored",
        "The band is a percentile across real league-seasons — 306–380 fixtures \
         between 18–20 clubs. The bench builds one home side and one away side \
         and replays that single fixture, so the comparison is between unlike \
         units and no value of `--games` closes the gap. Reported, not enforced, \
         until the bench simulates league-shaped populations.",
    ),
    (
        "Home win %",
        "The band is a percentile across real league-seasons — 306–380 fixtures \
         between 18–20 clubs. The bench builds one home side and one away side \
         and replays that single fixture, so the comparison is between unlike \
         units and no value of `--games` closes the gap. Reported, not enforced, \
         until the bench simulates league-shaped populations.",
    ),
];

fn not_comparable_reason(label: &str) -> Option<&'static str> {
    NOT_COMPARABLE
        .iter()
        .find(|(name, _)| *name == label)
        .map(|(_, reason)| *reason)
}

/// Bands the engine is known to miss today, with the reason.
///
/// Listed rather than widened, so the gate can be enforced from the start
/// without pretending the engine is calibrated. A gate that is red on day one
/// gets ignored; a target quietly moved to match the engine stops meaning
/// anything. Remove entries here as the engine is recalibrated — the run fails
/// if a listed target starts passing, so this list cannot go stale.
pub const KNOWN_FAILING: &[(&str, &str)] = &[];

fn known_failure_reason(label: &str) -> Option<&'static str> {
    KNOWN_FAILING
        .iter()
        .find(|(name, _)| *name == label)
        .map(|(_, reason)| *reason)
}

/// A metric's verdict after a run.
#[derive(Debug, Clone, Serialize)]
pub struct TargetVerdict {
    pub label: &'static str,
    pub unit: Unit,
    pub value: f64,
    pub low: f64,
    pub high: f64,
    pub passed: bool,
    /// Why this band, when the number is not self-evident.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<&'static str>,
    /// Set when the metric is failing but listed as known debt.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub known_failure: Option<&'static str>,
    /// Set when a metric listed as known debt has started passing, so the entry
    /// can be removed.
    pub unexpected_pass: bool,
    /// Set when the bench does not simulate the population this band describes,
    /// so neither a miss nor a pass means anything — see [`NOT_COMPARABLE`].
    #[serde(skip_serializing_if = "Option::is_none")]
    pub not_comparable: Option<&'static str>,
    /// Where the band came from, and therefore whether it can fail a run.
    pub provenance: Provenance,
}

impl TargetVerdict {
    /// Whether this verdict may fail the run.
    pub fn enforceable(&self) -> bool {
        self.provenance.enforceable()
    }
}

/// Every metric's verdict, in table order.
pub fn evaluate(stats: &BenchStats) -> Vec<TargetVerdict> {
    all()
        .into_iter()
        .map(|target| {
            let passed = target.passes(stats);
            let known = known_failure_reason(target.label);
            TargetVerdict {
                label: target.label,
                unit: target.unit,
                value: target.value(stats),
                low: target.low,
                high: target.high,
                passed,
                note: target.note,
                known_failure: known.filter(|_| !passed),
                unexpected_pass: passed && known.is_some(),
                not_comparable: not_comparable_reason(target.label),
                provenance: target.provenance,
            }
        })
        .collect()
}

/// Whether a run should be treated as a failure by a caller such as CI.
///
/// Only enforceable bands count. An unsourced one is reported and skipped: it
/// cannot fail a build, because failing a build is a claim that the engine is
/// wrong, and a band with no source cannot support that claim.
///
/// Known-failing metrics do not fail the run either, but a known-failing metric
/// that starts *passing* does — that is the signal to delete its entry, and it
/// keeps the debt list honest.
///
/// A band the bench cannot reproduce is skipped in both directions: see
/// [`NOT_COMPARABLE`]. It is not debt, because debt is a claim that the engine
/// is wrong, and the bench is not in a position to make that claim.
pub fn run_failed(verdicts: &[TargetVerdict]) -> bool {
    verdicts
        .iter()
        .filter(|v| v.enforceable() && v.not_comparable.is_none())
        .any(|verdict| {
            (!verdict.passed && verdict.known_failure.is_none()) || verdict.unexpected_pass
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_known_failing_entry_names_a_real_target() {
        let labels: Vec<&str> = all().iter().map(|target| target.label).collect();
        for (label, _) in KNOWN_FAILING {
            assert!(
                labels.contains(label),
                "KNOWN_FAILING names {label:?}, which is not in the target table"
            );
        }
    }

    #[test]
    fn target_bands_are_ordered_and_non_empty() {
        let targets = all();
        assert!(!targets.is_empty());
        for target in targets {
            assert!(
                target.low < target.high,
                "{} has an inverted band {}–{}",
                target.label,
                target.low,
                target.high
            );
        }
    }

    #[test]
    fn a_metric_outside_its_band_fails_the_run_unless_it_is_known_debt() {
        let unknown = TargetVerdict {
            label: "Shots/game",
            unit: Unit::PerGame,
            value: 99.0,
            low: 18.0,
            high: 32.0,
            passed: false,
            note: None,
            // Enforceable, because this test is about the known-debt mechanism
            // rather than about provenance. An unsourced band cannot fail a run
            // at all, which is what `an_unsourced_band_cannot_fail_a_run` pins.
            provenance: Provenance::ModelInvariant { why: "test" },
            known_failure: None,
            unexpected_pass: false,
            not_comparable: None,
        };
        assert!(run_failed(std::slice::from_ref(&unknown)));

        let known = TargetVerdict {
            known_failure: Some("documented debt"),
            ..unknown
        };
        assert!(!run_failed(&[known]));
    }

    #[test]
    fn known_debt_that_starts_passing_fails_the_run() {
        // Otherwise the debt list silently rots.
        let fixed = TargetVerdict {
            label: "Goals/game",
            unit: Unit::PerGame,
            value: 2.6,
            low: 2.3,
            high: 3.0,
            passed: true,
            note: None,
            provenance: Provenance::ModelInvariant { why: "test" },
            known_failure: None,
            unexpected_pass: true,
            not_comparable: None,
        };
        assert!(run_failed(&[fixed]));
    }

    #[test]
    fn a_band_the_bench_cannot_reproduce_never_fails_the_run() {
        // Neither direction means anything: the bench is not playing the thing
        // the band was measured over, so a miss is not evidence against the
        // engine and a pass is not evidence for it.
        let missed = TargetVerdict {
            label: "Home win %",
            unit: Unit::Percent,
            value: 12.0,
            low: 41.0,
            high: 49.0,
            passed: false,
            note: None,
            provenance: Provenance::ModelInvariant { why: "test" },
            known_failure: None,
            unexpected_pass: false,
            not_comparable: Some("one fixture, not a league"),
        };
        assert!(!run_failed(std::slice::from_ref(&missed)));

        let landed = TargetVerdict {
            passed: true,
            unexpected_pass: true,
            ..missed
        };
        assert!(!run_failed(&[landed]));
    }

    #[test]
    fn every_not_comparable_entry_names_a_real_target() {
        let labels: Vec<&str> = all().iter().map(|target| target.label).collect();
        for (label, _) in NOT_COMPARABLE {
            assert!(
                labels.contains(label),
                "NOT_COMPARABLE names {label:?}, which is not in the target table"
            );
        }
    }

    #[test]
    fn no_band_is_both_known_debt_and_incomparable() {
        // They are different claims. Known debt says the engine is wrong and we
        // have not fixed it; incomparable says the bench cannot tell. Listing a
        // band as both asserts a finding the bench cannot support.
        for (label, _) in KNOWN_FAILING {
            assert!(
                not_comparable_reason(label).is_none(),
                "{label:?} is listed as known debt and as incomparable; the bench \
                 cannot show it is failing if it cannot measure it at all"
            );
        }
    }

    #[test]
    fn the_scoreline_bands_are_reported_but_not_enforced() {
        // Pins the reason `NOT_COMPARABLE` exists. Delete these entries only in
        // the change that makes `sim-bench` simulate league-shaped populations.
        for label in [
            "Goals/game",
            "Clean sheets (home)",
            "Clean sheets (away)",
            "Both teams scored",
            "Home win %",
        ] {
            assert!(
                not_comparable_reason(label).is_some(),
                "{label:?} is a percentile across real league-seasons, but the bench \
                 replays a single fixture — it must not be able to fail a run"
            );
        }
    }
}

#[cfg(test)]
mod provenance_tests {
    use super::*;

    #[test]
    fn the_unsourced_count_only_ratchets_down() {
        let unsourced = all()
            .iter()
            .filter(|t| t.provenance == Provenance::Unsourced)
            .count();
        assert!(
            unsourced <= UNSOURCED_BUDGET,
            "{unsourced} bands have no source; the ratchet allows {UNSOURCED_BUDGET}. \
             A new target needs a citation, not another unsourced band. If you have \
             just sourced one, lower UNSOURCED_BUDGET to match in the same change."
        );
    }

    #[test]
    fn a_measured_band_can_be_followed_back_to_its_source() {
        // A citation nobody can chase is not a citation. Vacuous today — there
        // are no measured bands yet — and the point is that it bites the moment
        // somebody adds one.
        for target in all() {
            if let Provenance::Measured {
                source,
                competition,
                season,
                retrieved,
            } = target.provenance
            {
                for (field, value) in [
                    ("source", source),
                    ("competition", competition),
                    ("season", season),
                    ("retrieved", retrieved),
                ] {
                    assert!(
                        !value.trim().is_empty(),
                        "{} cites a source with an empty {field}",
                        target.label
                    );
                }
            }
        }
    }

    fn verdict(label: &'static str, provenance: Provenance) -> TargetVerdict {
        TargetVerdict {
            label,
            unit: Unit::PerGame,
            value: 99.0,
            low: 0.0,
            high: 1.0,
            passed: false,
            note: None,
            known_failure: None,
            unexpected_pass: false,
            not_comparable: None,
            provenance,
        }
    }

    #[test]
    fn an_unsourced_band_cannot_fail_a_run() {
        // Wildly out of band, and it still does not fail the build. Failing a
        // build says the engine is wrong; a number with no source cannot say
        // that.
        assert!(!run_failed(&[verdict(
            "Yellow cards/game",
            Provenance::Unsourced
        )]));
    }

    #[test]
    fn a_model_invariant_still_fails_a_run() {
        // Nothing about "no forward finishes a match having never passed"
        // depends on a source, so nothing excuses it.
        assert!(run_failed(&[verdict(
            "Forwards with 0 passes %",
            Provenance::ModelInvariant { why: "test" }
        )]));
    }

    #[test]
    fn a_measured_band_fails_a_run() {
        assert!(run_failed(&[verdict(
            "Goals/game",
            Provenance::Measured {
                source: "test",
                competition: "test",
                season: "test",
                retrieved: "test",
            }
        )]));
    }

    #[test]
    fn something_is_still_enforced() {
        // The gate must not become decorative. If every band ends up unsourced,
        // `ofm-sim-bench` can no longer fail on anything and CI would go quietly
        // green on a broken engine.
        let enforced = all().iter().filter(|t| t.provenance.enforceable()).count();
        assert!(
            enforced > 0,
            "no band is enforceable, so the calibration gate cannot fail on anything"
        );
    }
}

/// The scoreline bands are derived, not typed in. These hold the table to the
/// artifact `scripts/calibrate-scorelines.mjs` produces, so the two cannot
/// drift: regenerate the artifact and this test tells you the table is stale.
#[cfg(test)]
mod derived_band_tests {
    use super::*;

    const ARTIFACT: &str = include_str!("../data/big5-scorelines.json");

    fn artifact() -> serde_json::Value {
        serde_json::from_str(ARTIFACT).expect("the derived artifact is valid JSON")
    }

    #[test]
    fn every_derived_band_matches_the_table() {
        let artifact = artifact();
        let commit = artifact["source"]["commit"].as_str().unwrap();
        let commit_date = artifact["source"]["commit_date"].as_str().unwrap();
        let targets = all();

        let metrics = artifact["metrics"].as_array().unwrap();
        // Named, not counted: a non-empty check would let four of the five be
        // dropped from the artifact and the stale table entries survive.
        let derived: Vec<&str> = metrics
            .iter()
            .map(|m| m["label"].as_str().unwrap())
            .collect();
        assert_eq!(
            derived,
            vec![
                "Goals/game",
                "Clean sheets (home)",
                "Clean sheets (away)",
                "Both teams scored",
                "Home win %",
            ],
            "the artifact no longer derives the five scoreline bands"
        );

        for metric in metrics {
            let label = metric["label"].as_str().unwrap();
            let target = targets
                .iter()
                .find(|t| t.label == label)
                .unwrap_or_else(|| panic!("the artifact derives {label:?}, which is not a target"));

            let (low, high) = (metric["low"].as_f64().unwrap(), metric["high"].as_f64().unwrap());
            assert_eq!(
                (target.low, target.high),
                (low, high),
                "{label} is {}–{} in the table but {low}–{high} in the artifact; \
                 the table was not updated after the last regeneration",
                target.low,
                target.high
            );

            let Provenance::Measured {
                source, retrieved, ..
            } = target.provenance
            else {
                panic!("{label} is derived from a real dataset, so it must be Measured");
            };
            assert!(
                source.contains(&commit[..8]),
                "{label} cites {source:?}, which does not name the pinned commit {commit}"
            );
            assert_eq!(
                retrieved,
                &commit_date[..10],
                "{label} was retrieved at the pinned commit, so its date is the commit's"
            );
        }
    }
}
