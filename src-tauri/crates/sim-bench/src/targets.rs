//! Real-football calibration bands, in one place.
//!
//! These were previously written out three times — inline `check(..)` calls in
//! the terminal report, a table in the HTML report, and a third copy driving
//! the HTML colour classes — and had already drifted apart: home win % existed
//! only in HTML, away clean sheets only in the terminal. Every consumer now
//! reads this table, and the JSON output carries the verdicts so a caller (CI,
//! a diff against a stored baseline) can act on them without re-encoding the
//! numbers.

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

/// One calibrated metric: what it is, what the engine produced, and the band a
/// real-football-like simulation is expected to land in.
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
/// Sources are top-flight European league averages. Where the engine is
/// currently outside a band, that is recorded as debt in `KNOWN_FAILING` rather
/// than by widening the band — a target that moves to match the engine stops
/// being a target.
pub fn all() -> Vec<Target> {
    vec![
        Target {
            label: "Goals/game",
            unit: Unit::PerGame,
            low: 2.3,
            high: 3.0,
            read: |s| s.gpg(),
            note: None,
        },
        Target {
            label: "Clean sheets (home)",
            unit: Unit::Percent,
            low: 22.0,
            high: 35.0,
            read: |s| s.clean_sheet_home_pct(),
            note: None,
        },
        Target {
            label: "Clean sheets (away)",
            unit: Unit::Percent,
            low: 22.0,
            high: 35.0,
            read: |s| s.clean_sheet_away_pct(),
            note: None,
        },
        Target {
            label: "Both teams scored",
            unit: Unit::Percent,
            low: 50.0,
            high: 55.0,
            read: |s| s.btts_pct(),
            note: None,
        },
        Target {
            label: "Home win %",
            unit: Unit::Percent,
            low: 40.0,
            high: 52.0,
            read: |s| s.home_win_pct(),
            note: Some("Between evenly matched sides; a stronger home side raises this."),
        },
        Target {
            label: "Shots/game",
            unit: Unit::PerGame,
            low: 18.0,
            high: 32.0,
            read: |s| s.shots_pg(),
            note: None,
        },
        Target {
            label: "Shots on target %",
            unit: Unit::Percent,
            low: 32.0,
            high: 45.0,
            read: |s| s.shot_accuracy_pct(),
            note: None,
        },
        Target {
            label: "Goal conversion %",
            unit: Unit::Percent,
            low: 20.0,
            high: 40.0,
            read: |s| s.goal_conversion_pct(),
            note: Some("Goals as a share of shots on target."),
        },
        Target {
            label: "Yellow cards/game",
            unit: Unit::PerGame,
            low: 2.0,
            high: 4.0,
            read: |s| s.yellows_pg(),
            note: None,
        },
        Target {
            label: "Red cards/game",
            unit: Unit::PerGame,
            low: 0.05,
            high: 0.15,
            read: |s| s.reds_pg(),
            note: None,
        },
        Target {
            label: "Fouls/game",
            unit: Unit::PerGame,
            low: 18.0,
            high: 28.0,
            read: |s| s.fouls_pg(),
            note: None,
        },
        Target {
            label: "Penalties/game",
            unit: Unit::PerGame,
            low: 0.20,
            high: 0.50,
            read: |s| s.penalties_pg(),
            note: None,
        },
        Target {
            label: "Penalty conversion %",
            unit: Unit::Percent,
            low: 65.0,
            high: 85.0,
            read: |s| s.penalty_conversion_pct(),
            note: None,
        },
        Target {
            label: "Corners/game",
            unit: Unit::PerGame,
            low: 8.0,
            high: 14.0,
            read: |s| s.corners_pg(),
            note: None,
        },
        Target {
            label: "Goal kicks/game",
            unit: Unit::PerGame,
            low: 8.0,
            high: 14.0,
            read: |s| s.goal_kicks_pg(),
            note: None,
        },
        Target {
            label: "Crosses/game",
            unit: Unit::PerGame,
            low: 15.0,
            high: 30.0,
            read: |s| s.crosses_pg(),
            note: None,
        },
        Target {
            label: "Open play goals %",
            unit: Unit::Percent,
            low: 60.0,
            high: 75.0,
            read: |s| s.open_play_goal_pct(),
            note: None,
        },
        Target {
            label: "Corner goals %",
            unit: Unit::Percent,
            low: 10.0,
            high: 20.0,
            read: |s| s.corner_goal_pct(),
            note: None,
        },
        Target {
            label: "Free kick goals %",
            unit: Unit::Percent,
            low: 5.0,
            high: 15.0,
            read: |s| s.free_kick_goal_pct(),
            note: None,
        },
        Target {
            label: "Penalty goals %",
            unit: Unit::Percent,
            low: 5.0,
            high: 15.0,
            read: |s| s.penalty_goal_pct(),
            note: None,
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
        },
    ]
}

/// Bands the engine is known to miss today, with the reason.
///
/// Listed rather than widened, so the gate can be enforced from the start
/// without pretending the engine is calibrated. A gate that is red on day one
/// gets ignored; a target quietly moved to match the engine stops meaning
/// anything. Remove entries here as the engine is recalibrated — the run fails
/// if a listed target starts passing, so this list cannot go stale.
pub const KNOWN_FAILING: &[(&str, &str)] = &[(
    "Both teams scored",
    "unreachable with an evenly matched fixture, and not an engine fault. Two \
     identical sides scoring independently at the measured rate give about \
     56% by arithmetic alone, which is what the engine produces. Real \
     football's 50-55% comes from a league containing mismatches: running this \
     bench at 78-v-62 gives 46% and at 84-v-56 gives 28%. Closing it means \
     benching a distribution of fixtures rather than one repeated pairing",
)];

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
            }
        })
        .collect()
}

/// Whether a run should be treated as a failure by a caller such as CI.
///
/// Known-failing metrics do not fail the run, but a known-failing metric that
/// starts *passing* does — that is the signal to delete its entry, and it keeps
/// the debt list honest.
pub fn run_failed(verdicts: &[TargetVerdict]) -> bool {
    verdicts
        .iter()
        .any(|verdict| (!verdict.passed && verdict.known_failure.is_none()) || verdict.unexpected_pass)
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
            known_failure: None,
            unexpected_pass: true,
        };
        assert!(run_failed(&[fixed]));
    }
}
