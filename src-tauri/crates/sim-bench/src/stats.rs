use std::collections::HashMap;

use engine::{EventType, GoalSource, MatchReport, Position, TeamData};
use serde::Serialize;

/// Involvement totals for one coarse position, summed over every appearance.
///
/// Team-level aggregates cannot answer "is this player type actually playing
/// football?" — a forward who finishes on zero passes is invisible in a shots
/// total. These are the counters that make that measurable.
#[derive(Debug, Clone, Copy, Default)]
pub struct PositionTotals {
    pub appearances: u64,
    pub minutes: u64,
    pub passes_attempted: u64,
    pub passes_completed: u64,
    pub shots: u64,
    pub tackles: u64,
    pub interceptions: u64,
    pub goals: u64,
    pub assists: u64,
}

impl PositionTotals {
    /// Rate per 90 minutes played, the standard way football stats are compared
    /// across players with different minutes.
    fn per_90(&self, total: u64) -> f64 {
        if self.minutes == 0 {
            return 0.0;
        }
        total as f64 / self.minutes as f64 * 90.0
    }

    pub fn passes_per_90(&self) -> f64 {
        self.per_90(self.passes_attempted)
    }
    pub fn shots_per_90(&self) -> f64 {
        self.per_90(self.shots)
    }
    pub fn tackles_per_90(&self) -> f64 {
        self.per_90(self.tackles)
    }
    pub fn interceptions_per_90(&self) -> f64 {
        self.per_90(self.interceptions)
    }
    pub fn goals_per_90(&self) -> f64 {
        self.per_90(self.goals)
    }
    pub fn assists_per_90(&self) -> f64 {
        self.per_90(self.assists)
    }
    /// Every counted action, as a proxy for how involved the position is.
    pub fn touches_per_90(&self) -> f64 {
        self.per_90(
            self.passes_attempted + self.shots + self.tackles + self.interceptions,
        )
    }
}

/// The four coarse positions, in report order.
pub const POSITIONS: [(Position, &str); 4] = [
    (Position::Goalkeeper, "Goalkeeper"),
    (Position::Defender, "Defender"),
    (Position::Midfielder, "Midfielder"),
    (Position::Forward, "Forward"),
];

fn position_index(position: Position) -> usize {
    match position {
        Position::Goalkeeper => 0,
        Position::Defender => 1,
        Position::Midfielder => 2,
        Position::Forward => 3,
    }
}

/// Per-position involvement across every simulated match.
#[derive(Debug, Clone, Default)]
pub struct PositionStats {
    totals: [PositionTotals; 4],
    /// Forward appearances, and how many of them logged no pass at all.
    forwards_played: u64,
    forwards_with_zero_passes: u64,
}

impl PositionStats {
    pub fn get(&self, position: Position) -> &PositionTotals {
        &self.totals[position_index(position)]
    }

    /// Share of forward appearances that ended without a single pass attempted.
    pub fn forwards_with_zero_passes_pct(&self) -> f64 {
        if self.forwards_played == 0 {
            return 0.0;
        }
        self.forwards_with_zero_passes as f64 / self.forwards_played as f64 * 100.0
    }

    fn add_match(&mut self, report: &MatchReport, teams: [&TeamData; 2]) {
        for team in teams {
            for player in &team.players {
                let Some(stats) = report.player_stats.get(&player.id) else {
                    continue;
                };
                // Unused substitutes would otherwise drag every per-90 rate
                // toward zero and count as "a forward with no passes".
                if stats.minutes_played == 0 {
                    continue;
                }

                let totals = &mut self.totals[position_index(player.position)];
                totals.appearances += 1;
                totals.minutes += stats.minutes_played as u64;
                totals.passes_attempted += stats.passes_attempted as u64;
                totals.passes_completed += stats.passes_completed as u64;
                totals.shots += stats.shots as u64;
                totals.tackles += stats.tackles_won as u64;
                totals.interceptions += stats.interceptions as u64;
                totals.goals += stats.goals as u64;
                totals.assists += stats.assists as u64;

                if player.position == Position::Forward {
                    self.forwards_played += 1;
                    if stats.passes_attempted == 0 {
                        self.forwards_with_zero_passes += 1;
                    }
                }
            }
        }
    }
}

/// Aggregated statistics across N simulated matches.
#[derive(Default)]
pub struct BenchStats {
    pub games: u32,
    pub home_wins: u32,
    pub draws: u32,
    pub away_wins: u32,

    // Goals
    pub total_goals: u32,
    pub home_goals: u32,
    pub away_goals: u32,
    pub clean_sheets_home: u32,
    pub clean_sheets_away: u32,
    pub btts: u32,

    // Scoreline heatmap: (home_goals, away_goals) → game count, capped at 6 per side
    pub scorelines: HashMap<(u8, u8), u32>,

    // Goals per 15-minute bucket [1-15, 16-30, 31-45, 46-60, 61-75, 76-90, 90+]
    pub goals_by_bucket: [u32; 7],

    // Shooting
    pub total_shots: u64,
    pub shots_on_target: u64,
    /// The advanced numbers, summed across every match in the run.
    pub xg: f64,
    pub xa: f64,
    pub xt: f64,
    pub distance_km: f64,
    pub shots_off_target: u64,
    pub shots_blocked: u64,

    // Penalties
    pub penalties_awarded: u64,
    pub penalty_goals: u64,

    // Passing
    pub passes_completed: u64,
    pub passes_intercepted: u64,

    // Discipline
    pub yellow_cards: u64,
    pub red_cards: u64,
    pub fouls: u64,
    pub injuries: u64,

    // Set pieces
    pub corners: u64,
    pub free_kicks: u64,
    pub goal_kicks: u64,
    pub crosses: u64,

    // Goal source breakdown
    pub open_play_goals: u64,
    pub corner_goals: u64,
    pub free_kick_goals: u64,

    // Tackles & interceptions
    pub tackles: u64,
    pub interceptions: u64,

    // Possession (sum of home % for averaging)
    pub home_possession_sum: f64,

    // Goals-per-game frequency histogram: total_goals_in_game → count_of_games
    pub goals_per_game_hist: HashMap<u8, u32>,

    // Per-position involvement
    pub positions: PositionStats,

    pub total_time_secs: f64,
}

impl BenchStats {
    fn per_game_u32(&self, value: u32) -> f64 {
        if self.games == 0 {
            return 0.0;
        }
        value as f64 / self.games as f64
    }

    fn per_game_u64(&self, value: u64) -> f64 {
        if self.games == 0 {
            return 0.0;
        }
        value as f64 / self.games as f64
    }

    fn pct_u32(&self, value: u32) -> f64 {
        self.per_game_u32(value) * 100.0
    }

    /// Fold one simulated match into the totals.
    ///
    /// The teams are needed to attribute each player's stats to a position;
    /// `MatchReport` keys player stats by id alone.
    pub fn add(&mut self, report: &MatchReport, home: &TeamData, away: &TeamData) {
        self.positions.add_match(report, [home, away]);
        self.games += 1;

        let hg = report.home_goals;
        let ag = report.away_goals;
        let total_this_game = hg as u32 + ag as u32;

        match hg.cmp(&ag) {
            std::cmp::Ordering::Greater => self.home_wins += 1,
            std::cmp::Ordering::Less => self.away_wins += 1,
            std::cmp::Ordering::Equal => self.draws += 1,
        }

        self.total_goals += total_this_game;
        self.home_goals += hg as u32;
        self.away_goals += ag as u32;

        if ag == 0 {
            self.clean_sheets_home += 1;
        }
        if hg == 0 {
            self.clean_sheets_away += 1;
        }
        if hg > 0 && ag > 0 {
            self.btts += 1;
        }

        *self.scorelines.entry((hg.min(6), ag.min(6))).or_default() += 1;
        *self
            .goals_per_game_hist
            .entry(total_this_game.min(9) as u8)
            .or_default() += 1;

        let hs = &report.home_stats;
        let aw = &report.away_stats;

        self.total_shots += (hs.shots + aw.shots) as u64;
        self.xg += (hs.xg + aw.xg) as f64;
        for stats in report.player_stats.values() {
            self.xa += stats.xa as f64;
            self.xt += stats.xt as f64;
            self.distance_km += stats.distance_km as f64;
        }
        self.shots_on_target += (hs.shots_on_target + aw.shots_on_target) as u64;
        self.shots_off_target += (hs.shots_off_target + aw.shots_off_target) as u64;
        self.shots_blocked += (hs.shots_blocked + aw.shots_blocked) as u64;
        // Count PenaltyAwarded directly to avoid double-counting with PenaltyGoal/PenaltyMiss
        self.penalties_awarded += report
            .events
            .iter()
            .filter(|e| matches!(e.event_type, EventType::PenaltyAwarded))
            .count() as u64;
        self.penalty_goals += report
            .goals
            .iter()
            .filter(|g| g.goal_source == GoalSource::Penalty)
            .count() as u64;
        self.passes_completed += (hs.passes_completed + aw.passes_completed) as u64;
        self.passes_intercepted += (hs.passes_intercepted + aw.passes_intercepted) as u64;
        self.yellow_cards += (hs.yellow_cards + aw.yellow_cards) as u64;
        self.red_cards += (hs.red_cards + aw.red_cards) as u64;
        self.fouls += (hs.fouls + aw.fouls) as u64;
        self.corners += (hs.corners + aw.corners) as u64;
        self.free_kicks += (hs.free_kicks + aw.free_kicks) as u64;
        self.tackles += (hs.tackles + aw.tackles) as u64;
        self.interceptions += (hs.interceptions + aw.interceptions) as u64;
        self.home_possession_sum += report.home_possession;

        for goal in &report.goals {
            match goal.goal_source {
                GoalSource::OpenPlay => self.open_play_goals += 1,
                GoalSource::Corner => self.corner_goals += 1,
                GoalSource::FreeKick => self.free_kick_goals += 1,
                GoalSource::Penalty => {} // already counted in penalty_goals
            }
        }

        for event in &report.events {
            if event.is_goal() {
                self.goals_by_bucket[goal_bucket(event.minute)] += 1;
            }
            match event.event_type {
                EventType::Injury => self.injuries += 1,
                EventType::GoalKick => self.goal_kicks += 1,
                EventType::Cross => self.crosses += 1,
                _ => {}
            }
        }
    }

    // --- Computed metrics ---

    pub fn gpg(&self) -> f64 {
        self.per_game_u32(self.total_goals)
    }
    pub fn home_gpg(&self) -> f64 {
        self.per_game_u32(self.home_goals)
    }
    pub fn away_gpg(&self) -> f64 {
        self.per_game_u32(self.away_goals)
    }
    pub fn home_win_pct(&self) -> f64 {
        self.pct_u32(self.home_wins)
    }
    pub fn draw_pct(&self) -> f64 {
        self.pct_u32(self.draws)
    }
    pub fn away_win_pct(&self) -> f64 {
        self.pct_u32(self.away_wins)
    }
    pub fn clean_sheet_home_pct(&self) -> f64 {
        self.pct_u32(self.clean_sheets_home)
    }
    pub fn clean_sheet_away_pct(&self) -> f64 {
        self.pct_u32(self.clean_sheets_away)
    }
    pub fn btts_pct(&self) -> f64 {
        self.pct_u32(self.btts)
    }
    pub fn shots_pg(&self) -> f64 {
        self.per_game_u64(self.total_shots)
    }
    pub fn shot_accuracy_pct(&self) -> f64 {
        if self.total_shots == 0 {
            return 0.0;
        }
        self.shots_on_target as f64 / self.total_shots as f64 * 100.0
    }
    pub fn goal_conversion_pct(&self) -> f64 {
        if self.shots_on_target == 0 {
            return 0.0;
        }
        self.total_goals as f64 / self.shots_on_target as f64 * 100.0
    }
    /// Expected goals per game, as the engine valued each chance at the moment
    /// it was taken.
    ///
    /// This used to be shots-on-target multiplied by the conversion constant,
    /// which is not expected goals — it is the shot count wearing its name, and
    /// it could not be wrong about anything because it contained no model. The
    /// real figure comes from the engine, which values every chance by where it
    /// was struck from and how it was made, with an average finisher.
    pub fn xg_pg(&self) -> f64 {
        self.per_game(self.xg)
    }

    /// Expected assists per game — the quality of the chances that were created.
    pub fn xa_pg(&self) -> f64 {
        self.per_game(self.xa)
    }

    /// Expected threat per game: how much danger both sides generated by
    /// moving the ball, whether or not it ended in a shot.
    pub fn xt_pg(&self) -> f64 {
        self.per_game(self.xt)
    }

    /// Kilometres covered per player per match. Derived from role and stamina
    /// rather than simulated — the engine has no model of off-ball movement.
    pub fn distance_per_player(&self) -> f64 {
        if self.games == 0 {
            return 0.0;
        }
        // Twenty-two on the pitch, ignoring substitutes, who are folded in.
        self.distance_km / self.games as f64 / 22.0
    }

    fn per_game(&self, total: f64) -> f64 {
        if self.games == 0 { 0.0 } else { total / self.games as f64 }
    }
    pub fn yellows_pg(&self) -> f64 {
        self.per_game_u64(self.yellow_cards)
    }
    pub fn reds_pg(&self) -> f64 {
        self.per_game_u64(self.red_cards)
    }
    pub fn fouls_pg(&self) -> f64 {
        self.per_game_u64(self.fouls)
    }
    pub fn corners_pg(&self) -> f64 {
        self.per_game_u64(self.corners)
    }
    pub fn free_kicks_pg(&self) -> f64 {
        self.per_game_u64(self.free_kicks)
    }
    pub fn penalties_pg(&self) -> f64 {
        self.per_game_u64(self.penalties_awarded)
    }
    pub fn penalty_conversion_pct(&self) -> f64 {
        if self.penalties_awarded == 0 {
            return 0.0;
        }
        self.penalty_goals as f64 / self.penalties_awarded as f64 * 100.0
    }
    pub fn injuries_pg(&self) -> f64 {
        self.per_game_u64(self.injuries)
    }
    pub fn avg_home_possession(&self) -> f64 {
        if self.games == 0 {
            return 0.0;
        }
        self.home_possession_sum / self.games as f64
    }
    pub fn pass_accuracy_pct(&self) -> f64 {
        let total = self.passes_completed + self.passes_intercepted;
        if total == 0 {
            return 0.0;
        }
        self.passes_completed as f64 / total as f64 * 100.0
    }
    pub fn games_per_sec(&self) -> f64 {
        if self.total_time_secs <= 0.0 {
            return 0.0;
        }
        self.games as f64 / self.total_time_secs
    }
    pub fn goal_kicks_pg(&self) -> f64 {
        self.goal_kicks as f64 / self.games as f64
    }
    pub fn crosses_pg(&self) -> f64 {
        self.crosses as f64 / self.games as f64
    }
    pub fn open_play_goal_pct(&self) -> f64 {
        self.open_play_goals as f64 / self.total_goals.max(1) as f64 * 100.0
    }
    pub fn corner_goal_pct(&self) -> f64 {
        self.corner_goals as f64 / self.total_goals.max(1) as f64 * 100.0
    }
    pub fn free_kick_goal_pct(&self) -> f64 {
        self.free_kick_goals as f64 / self.total_goals.max(1) as f64 * 100.0
    }
    pub fn penalty_goal_pct(&self) -> f64 {
        self.penalty_goals as f64 / self.total_goals.max(1) as f64 * 100.0
    }

    /// Top N scorelines sorted by frequency descending.
    pub fn top_scorelines(&self, n: usize) -> Vec<((u8, u8), u32)> {
        let mut list: Vec<_> = self.scorelines.iter().map(|(&k, &v)| (k, v)).collect();
        list.sort_by_key(|entry| std::cmp::Reverse(entry.1));
        list.truncate(n);
        list
    }

    pub fn tackles_pg(&self) -> f64 {
        self.per_game_u64(self.tackles)
    }
    pub fn interceptions_pg(&self) -> f64 {
        self.per_game_u64(self.interceptions)
    }

    /// Serialisable summary for JSON output.
    pub fn to_json(&self) -> JsonSummary {
        JsonSummary {
            games: self.games,
            outcomes: OutcomeJson {
                home_wins: self.home_wins,
                draws: self.draws,
                away_wins: self.away_wins,
                home_win_pct: self.home_win_pct(),
                draw_pct: self.draw_pct(),
                away_win_pct: self.away_win_pct(),
            },
            goals: GoalsJson {
                per_game: self.gpg(),
                home_per_game: self.home_gpg(),
                away_per_game: self.away_gpg(),
                clean_sheet_home_pct: self.clean_sheet_home_pct(),
                clean_sheet_away_pct: self.clean_sheet_away_pct(),
                btts_pct: self.btts_pct(),
            },
            shooting: ShootingJson {
                shots_per_game: self.shots_pg(),
                shots_on_target_pct: self.shot_accuracy_pct(),
                goal_conversion_pct: self.goal_conversion_pct(),
                xg_per_game: self.xg_pg(),
                goals_vs_xg: self.gpg() - self.xg_pg(),
            },
            discipline: DisciplineJson {
                yellow_cards_per_game: self.yellows_pg(),
                red_cards_per_game: self.reds_pg(),
                fouls_per_game: self.fouls_pg(),
                penalties_per_game: self.penalties_pg(),
                penalty_conversion_pct: self.penalty_conversion_pct(),
                injuries_per_game: self.injuries_pg(),
            },
            set_pieces: SetPiecesJson {
                corners_per_game: self.corners_pg(),
                free_kicks_per_game: self.free_kicks_pg(),
                goal_kicks_per_game: self.goal_kicks_pg(),
                crosses_per_game: self.crosses_pg(),
            },
            goal_sources: GoalSourcesJson {
                open_play_pct: self.open_play_goal_pct(),
                corner_pct: self.corner_goal_pct(),
                free_kick_pct: self.free_kick_goal_pct(),
                penalty_pct: self.penalty_goal_pct(),
            },
            possession: PossessionJson {
                home_avg_pct: self.avg_home_possession(),
                away_avg_pct: 100.0 - self.avg_home_possession(),
                pass_accuracy_pct: self.pass_accuracy_pct(),
            },
            defending: DefendingJson {
                tackles_per_game: self.tackles_pg(),
                interceptions_per_game: self.interceptions_pg(),
            },
            positions: POSITIONS
                .iter()
                .map(|(position, label)| {
                    let totals = self.positions.get(*position);
                    PositionJson {
                        position: label,
                        appearances: totals.appearances,
                        passes_per_90: totals.passes_per_90(),
                        shots_per_90: totals.shots_per_90(),
                        tackles_per_90: totals.tackles_per_90(),
                        interceptions_per_90: totals.interceptions_per_90(),
                        goals_per_90: totals.goals_per_90(),
                        assists_per_90: totals.assists_per_90(),
                        touches_per_90: totals.touches_per_90(),
                    }
                })
                .collect(),
            forwards_with_zero_passes_pct: self.positions.forwards_with_zero_passes_pct(),
            targets: crate::targets::evaluate(self),
            performance: PerfJson {
                total_time_secs: self.total_time_secs,
                games_per_sec: self.games_per_sec(),
            },
        }
    }
}

#[derive(Serialize)]
pub struct JsonSummary {
    pub games: u32,
    pub outcomes: OutcomeJson,
    pub goals: GoalsJson,
    pub shooting: ShootingJson,
    pub discipline: DisciplineJson,
    pub set_pieces: SetPiecesJson,
    pub goal_sources: GoalSourcesJson,
    pub possession: PossessionJson,
    pub defending: DefendingJson,
    /// Involvement by position — what team totals cannot show.
    pub positions: Vec<PositionJson>,
    pub forwards_with_zero_passes_pct: f64,
    /// Calibration verdicts, so a caller can act on them without re-encoding
    /// the bands.
    pub targets: Vec<crate::targets::TargetVerdict>,
    pub performance: PerfJson,
}

#[derive(Serialize)]
pub struct DefendingJson {
    pub tackles_per_game: f64,
    pub interceptions_per_game: f64,
}

#[derive(Serialize)]
pub struct PositionJson {
    pub position: &'static str,
    pub appearances: u64,
    pub passes_per_90: f64,
    pub shots_per_90: f64,
    pub tackles_per_90: f64,
    pub interceptions_per_90: f64,
    pub goals_per_90: f64,
    pub assists_per_90: f64,
    pub touches_per_90: f64,
}

#[derive(Serialize)]
pub struct OutcomeJson {
    pub home_wins: u32,
    pub draws: u32,
    pub away_wins: u32,
    pub home_win_pct: f64,
    pub draw_pct: f64,
    pub away_win_pct: f64,
}

#[derive(Serialize)]
pub struct GoalsJson {
    pub per_game: f64,
    pub home_per_game: f64,
    pub away_per_game: f64,
    pub clean_sheet_home_pct: f64,
    pub clean_sheet_away_pct: f64,
    pub btts_pct: f64,
}

#[derive(Serialize)]
pub struct ShootingJson {
    pub shots_per_game: f64,
    pub shots_on_target_pct: f64,
    pub goal_conversion_pct: f64,
    /// Expected goals per game, as the engine valued the chances.
    pub xg_per_game: f64,
    pub goals_vs_xg: f64,
}

#[derive(Serialize)]
pub struct DisciplineJson {
    pub yellow_cards_per_game: f64,
    pub red_cards_per_game: f64,
    pub fouls_per_game: f64,
    pub penalties_per_game: f64,
    pub penalty_conversion_pct: f64,
    pub injuries_per_game: f64,
}

#[derive(Serialize)]
pub struct SetPiecesJson {
    pub corners_per_game: f64,
    pub free_kicks_per_game: f64,
    pub goal_kicks_per_game: f64,
    pub crosses_per_game: f64,
}

#[derive(Serialize)]
pub struct GoalSourcesJson {
    pub open_play_pct: f64,
    pub corner_pct: f64,
    pub free_kick_pct: f64,
    pub penalty_pct: f64,
}

#[derive(Serialize)]
pub struct PossessionJson {
    pub home_avg_pct: f64,
    pub away_avg_pct: f64,
    pub pass_accuracy_pct: f64,
}

#[derive(Serialize)]
pub struct PerfJson {
    pub total_time_secs: f64,
    pub games_per_sec: f64,
}

fn goal_bucket(minute: u8) -> usize {
    match minute {
        1..=15 => 0,
        16..=30 => 1,
        31..=45 => 2,
        46..=60 => 3,
        61..=75 => 4,
        76..=90 => 5,
        _ => 6,
    }
}
