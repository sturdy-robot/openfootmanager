//! Sweeps that isolate the effect of a single player.
//!
//! The aggregate report answers "does the league look like football?". These
//! answer the different question the match-engine rework turns on: **does an
//! individual player matter?** Each sweep holds two teams fixed, changes one
//! thing about one player, and reports what that player then does per 90
//! minutes.
//!
//! Every arm is run over the same seed set, so the arms differ only by the
//! change under test. Note that a change which alters how many random draws a
//! match consumes will desynchronise the streams — the comparison is therefore
//! distributional over many seeds, not a paired per-match diff.

use engine::{MatchConfig, PlayStyle, PlayerData, PlayerRole, Position, TeamData, simulate_with_rng};
use rand::SeedableRng;
use rand::rngs::StdRng;
use serde::Serialize;

use crate::builder::build_team;

/// What one arm of a sweep did, measured on the subject player alone.
#[derive(Debug, Clone, Serialize)]
pub struct ArmOutcome {
    /// The value under test, e.g. `"shooting 90"` or `"Poacher"`.
    pub arm: String,
    /// Team goals per game, for context.
    pub team_goals_per_game: f64,
    pub subject_goals_per_90: f64,
    pub subject_assists_per_90: f64,
    pub subject_shots_per_90: f64,
    pub subject_passes_per_90: f64,
    pub subject_tackles_per_90: f64,
    pub subject_touches_per_90: f64,
}

/// One sweep: several arms of the same dimension.
#[derive(Debug, Clone, Serialize)]
pub struct Sweep {
    /// What was varied, e.g. `"Striker shooting"`.
    pub dimension: String,
    /// Which metric decides whether the dimension has any effect.
    pub key_metric: &'static str,
    pub arms: Vec<ArmOutcome>,
}

impl Sweep {
    /// Ratio between the best and worst arm on the key metric.
    ///
    /// `1.0` means the dimension changed nothing at all. This is the number
    /// that says whether attributes, roles or traits are actually reaching the
    /// simulation.
    pub fn spread(&self) -> f64 {
        let values: Vec<f64> = self.arms.iter().map(|arm| self.key_value(arm)).collect();
        let low = values.iter().cloned().fold(f64::INFINITY, f64::min);
        let high = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        if low <= 0.0 {
            // A zero floor makes a ratio meaningless; report the absolute
            // range instead so "0 → 0" is still visibly flat.
            return if high <= 0.0 { 1.0 } else { f64::INFINITY };
        }
        high / low
    }

    pub fn key_value(&self, arm: &ArmOutcome) -> f64 {
        match self.key_metric {
            "goals/90" => arm.subject_goals_per_90,
            "passes/90" => arm.subject_passes_per_90,
            "shots/90" => arm.subject_shots_per_90,
            "touches/90" => arm.subject_touches_per_90,
            _ => arm.subject_goals_per_90,
        }
    }
}

/// How the subject player is located within the home side.
#[derive(Clone, Copy)]
struct Subject {
    position: Position,
    /// Which player of that position, in team order.
    index: usize,
}

impl Subject {
    const STRIKER: Self = Self {
        position: Position::Forward,
        index: 0,
    };
    const PLAYMAKER: Self = Self {
        position: Position::Midfielder,
        index: 0,
    };

    /// Id of the subject within `team`, if present.
    fn id_in(&self, team: &TeamData) -> Option<String> {
        team.players
            .iter()
            .filter(|player| player.position == self.position)
            .nth(self.index)
            .map(|player| player.id.clone())
    }

    fn apply(&self, team: &mut TeamData, mutate: impl Fn(&mut PlayerData)) {
        if let Some(player) = team
            .players
            .iter_mut()
            .filter(|player| player.position == self.position)
            .nth(self.index)
        {
            mutate(player);
        }
    }
}

/// Shared setup for every sweep, so arms differ only by the change under test.
struct Fixture {
    home: TeamData,
    away: TeamData,
    config: MatchConfig,
    games: u32,
    base_seed: u64,
}

impl Fixture {
    fn new(config: &MatchConfig, games: u32, base_seed: u64) -> Self {
        let mut team_rng = StdRng::seed_from_u64(base_seed.wrapping_add(0xDEAD_BEEF));
        let home = build_team(
            "home",
            "Home FC",
            70,
            PlayStyle::Balanced,
            "4-4-2",
            &mut team_rng,
        );
        let away = build_team(
            "away",
            "Away FC",
            70,
            PlayStyle::Balanced,
            "4-4-2",
            &mut team_rng,
        );
        Self {
            home,
            away,
            config: config.clone(),
            games,
            base_seed,
        }
    }

    /// Run one arm: mutate the subject, simulate, and measure that player.
    fn run_arm(
        &self,
        arm: impl Into<String>,
        subject: Subject,
        mutate: impl Fn(&mut PlayerData),
    ) -> ArmOutcome {
        let mut home = self.home.clone();
        subject.apply(&mut home, mutate);
        let subject_id = subject.id_in(&home).unwrap_or_default();

        let mut goals = 0u64;
        let mut assists = 0u64;
        let mut shots = 0u64;
        let mut passes = 0u64;
        let mut tackles = 0u64;
        let mut interceptions = 0u64;
        let mut minutes = 0u64;
        let mut team_goals = 0u64;

        for index in 0..self.games {
            let mut rng = StdRng::seed_from_u64(self.base_seed.wrapping_add(index as u64));
            let report = simulate_with_rng(&home, &self.away, &self.config, &mut rng);
            team_goals += report.home_goals as u64;
            if let Some(stats) = report.player_stats.get(&subject_id) {
                goals += stats.goals as u64;
                assists += stats.assists as u64;
                shots += stats.shots as u64;
                passes += stats.passes_attempted as u64;
                tackles += stats.tackles_won as u64;
                interceptions += stats.interceptions as u64;
                minutes += stats.minutes_played as u64;
            }
        }

        let per_90 = |total: u64| {
            if minutes == 0 {
                0.0
            } else {
                total as f64 / minutes as f64 * 90.0
            }
        };

        ArmOutcome {
            arm: arm.into(),
            team_goals_per_game: team_goals as f64 / self.games.max(1) as f64,
            subject_goals_per_90: per_90(goals),
            subject_assists_per_90: per_90(assists),
            subject_shots_per_90: per_90(shots),
            subject_passes_per_90: per_90(passes),
            subject_tackles_per_90: per_90(tackles),
            subject_touches_per_90: per_90(passes + shots + tackles + interceptions),
        }
    }
}

/// Attribute levels swept, chosen to span the usable range of a squad.
const ATTRIBUTE_LEVELS: [u8; 5] = [50, 60, 70, 80, 90];

/// Forward roles that should produce visibly different profiles.
const FORWARD_ROLES: [(PlayerRole, &str); 4] = [
    (PlayerRole::Poacher, "Poacher"),
    (PlayerRole::TargetMan, "TargetMan"),
    (PlayerRole::False9, "False9"),
    (PlayerRole::CompleteForward, "CompleteForward"),
];

/// Traits the engine actually reads, so the sweep exercises `trait_bonus`.
///
/// The team builder leaves `traits` empty, which means no bench run has ever
/// exercised trait handling at all.
const FINISHING_TRAITS: [(&str, &str); 3] = [
    ("", "none"),
    ("Sharpshooter", "Sharpshooter"),
    ("CoolHead", "CoolHead"),
];

/// Run every sweep.
pub fn run_all(config: &MatchConfig, games: u32, base_seed: u64) -> Vec<Sweep> {
    let fixture = Fixture::new(config, games, base_seed);

    vec![
        striker_shooting(&fixture),
        playmaker_passing(&fixture),
        striker_role(&fixture),
        striker_traits(&fixture),
    ]
}

/// Does a better finisher score more?
fn striker_shooting(fixture: &Fixture) -> Sweep {
    Sweep {
        dimension: "Striker shooting".to_string(),
        key_metric: "goals/90",
        arms: ATTRIBUTE_LEVELS
            .iter()
            .map(|&level| {
                fixture.run_arm(format!("shooting {level}"), Subject::STRIKER, move |player| {
                    player.shooting = level;
                })
            })
            .collect(),
    }
}

/// Does a better passer pass more, and better?
fn playmaker_passing(fixture: &Fixture) -> Sweep {
    Sweep {
        dimension: "Playmaker passing + vision".to_string(),
        key_metric: "passes/90",
        arms: ATTRIBUTE_LEVELS
            .iter()
            .map(|&level| {
                fixture.run_arm(
                    format!("passing/vision {level}"),
                    Subject::PLAYMAKER,
                    move |player| {
                        player.passing = level;
                        player.vision = level;
                    },
                )
            })
            .collect(),
    }
}

/// Do different forward roles play differently?
fn striker_role(fixture: &Fixture) -> Sweep {
    Sweep {
        dimension: "Striker role".to_string(),
        key_metric: "shots/90",
        arms: FORWARD_ROLES
            .iter()
            .map(|&(role, label)| {
                fixture.run_arm(label, Subject::STRIKER, move |player| {
                    player.role = role;
                })
            })
            .collect(),
    }
}

/// Do traits reach the simulation at all?
fn striker_traits(fixture: &Fixture) -> Sweep {
    Sweep {
        dimension: "Striker traits".to_string(),
        key_metric: "goals/90",
        arms: FINISHING_TRAITS
            .iter()
            .map(|&(name, label)| {
                fixture.run_arm(label, Subject::STRIKER, move |player| {
                    player.traits = if name.is_empty() {
                        Vec::new()
                    } else {
                        vec![name.to_string()]
                    };
                })
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_sweep_with_identical_arms_has_no_spread() {
        let sweep = Sweep {
            dimension: "test".to_string(),
            key_metric: "goals/90",
            arms: vec![
                ArmOutcome {
                    arm: "a".into(),
                    team_goals_per_game: 1.0,
                    subject_goals_per_90: 0.5,
                    subject_assists_per_90: 0.0,
                    subject_shots_per_90: 0.0,
                    subject_passes_per_90: 0.0,
                    subject_tackles_per_90: 0.0,
                    subject_touches_per_90: 0.0,
                },
                ArmOutcome {
                    arm: "b".into(),
                    team_goals_per_game: 1.0,
                    subject_goals_per_90: 0.5,
                    subject_assists_per_90: 0.0,
                    subject_shots_per_90: 0.0,
                    subject_passes_per_90: 0.0,
                    subject_tackles_per_90: 0.0,
                    subject_touches_per_90: 0.0,
                },
            ],
        };
        assert!((sweep.spread() - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn an_all_zero_dimension_reads_as_flat_rather_than_infinite() {
        // Forwards currently attempt no passes at all, so a passes/90 sweep
        // over them is 0 → 0. That must read as "no effect", not as a divide
        // by zero.
        let sweep = Sweep {
            dimension: "test".to_string(),
            key_metric: "passes/90",
            arms: vec![ArmOutcome {
                arm: "a".into(),
                team_goals_per_game: 1.0,
                subject_goals_per_90: 0.0,
                subject_assists_per_90: 0.0,
                subject_shots_per_90: 0.0,
                subject_passes_per_90: 0.0,
                subject_tackles_per_90: 0.0,
                subject_touches_per_90: 0.0,
            }],
        };
        assert_eq!(sweep.spread(), 1.0);
    }
}
