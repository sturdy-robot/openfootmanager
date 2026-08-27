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
//! Measured, so nobody has to rediscover it: at `-n 20000`, seed 20260802 passes
//! all twenty-one bands, while seed 771 misses five — away clean sheets, home
//! win %, goal kicks, free-kick goals and both-teams-scored — and missed them
//! before the calibration was last touched, too.
//!
//! Calibrate against **seed 20260802**, and raise `-n` rather than averaging
//! seeds when a number looks marginal. Comparing a candidate change against the
//! baseline on a *different* seed measures the seed.

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
    /// Not constructed yet, and deliberately left that way rather than filled
    /// in from memory. Inventing a plausible citation would be worse than the
    /// unsourced numbers this type exists to expose — it would make them look
    /// checked. The shape is enforced by
    /// `provenance_tests::a_measured_band_can_be_followed_back_to_its_source`,
    /// which is vacuous today and bites the moment somebody adds one.
    #[allow(dead_code)]
    Measured {
        source: &'static str,
        competition: &'static str,
        season: &'static str,
        /// When the figure was read. Published aggregates are restated as
        /// seasons are added, so a number without a date cannot be checked
        /// against its source later.
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
/// Every band records where it came from. Today that record is uncomfortable:
/// **twenty of the twenty-one are `Unsourced`** — numbers that were written
/// down under a comment claiming they were top-flight European league averages,
/// with nothing recorded to support it, and two of two spot-checks against
/// published figures coming back wrong.
///
/// They are kept and reported, because they are a useful orientation and
/// throwing them away would lose the only picture the bench has. They are not
/// enforced, because an unsourced band is not a target: calibrating to satisfy
/// one is how somebody's recollection becomes engine behaviour.
///
/// Where the engine is outside an *enforced* band, that is recorded as debt in
/// `KNOWN_FAILING` rather than by widening the band — a target that moves to
/// match the engine stops being a target.
pub fn all() -> Vec<Target> {
    vec![
        Target {
            label: "Goals/game",
            unit: Unit::PerGame,
            low: 2.3,
            high: 3.0,
            read: |s| s.gpg(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Clean sheets (home)",
            unit: Unit::Percent,
            low: 22.0,
            high: 35.0,
            read: |s| s.clean_sheet_home_pct(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Clean sheets (away)",
            unit: Unit::Percent,
            low: 22.0,
            high: 35.0,
            read: |s| s.clean_sheet_away_pct(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Both teams scored",
            unit: Unit::Percent,
            low: 50.0,
            high: 55.0,
            read: |s| s.btts_pct(),
            note: None,
            provenance: Provenance::Unsourced,
        },
        Target {
            label: "Home win %",
            unit: Unit::Percent,
            low: 40.0,
            high: 52.0,
            read: |s| s.home_win_pct(),
            note: Some("Between evenly matched sides; a stronger home side raises this."),
            provenance: Provenance::Unsourced,
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
pub const UNSOURCED_BUDGET: usize = 20;

/// Bands the engine is known to miss today, with the reason.
///
/// Listed rather than widened, so the gate can be enforced from the start
/// without pretending the engine is calibrated. A gate that is red on day one
/// gets ignored; a target quietly moved to match the engine stops meaning
/// anything. Remove entries here as the engine is recalibrated — the run fails
/// if a listed target starts passing, so this list cannot go stale.
pub const KNOWN_FAILING: &[(&str, &str)] = &[
    // Empty, and it should stay that way. Every band this engine is measured
    // against is currently met. A metric that drifts out belongs here only with
    // a reason and a plan, never to make the gate quiet.
];

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
pub fn run_failed(verdicts: &[TargetVerdict]) -> bool {
    verdicts.iter().filter(|v| v.enforceable()).any(|verdict| {
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
        };
        assert!(run_failed(&[fixed]));
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
