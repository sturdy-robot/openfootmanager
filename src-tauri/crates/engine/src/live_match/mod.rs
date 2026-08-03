mod helpers;
mod metrics;
mod penalty;
mod possession;
mod simulation;
mod snapshot;
mod squad_cache;
mod substitution;
mod zone_resolution;

use metrics::MetricTally;
use squad_cache::SquadCache;

use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

use crate::event::MatchEvent;
use crate::report::MatchReport;
use crate::types::{MatchConfig, PlayStyle, PlayerData, PlayerRole, Side, TeamData, Zone};

// ---------------------------------------------------------------------------
// MatchPhase — tracks where we are in the match lifecycle
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MatchPhase {
    PreKickOff,
    FirstHalf,
    HalfTime,
    SecondHalf,
    FullTime,
    ExtraTimeFirstHalf,
    ExtraTimeHalfTime,
    ExtraTimeSecondHalf,
    ExtraTimeEnd,
    PenaltyShootout,
    Finished,
}

// ---------------------------------------------------------------------------
// MatchCommand — actions injected by user or AI between minutes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MatchCommand {
    Substitute {
        side: Side,
        player_off_id: String,
        player_on_id: String,
    },
    ChangeFormation {
        side: Side,
        formation: String,
    },
    ChangePlayStyle {
        side: Side,
        play_style: PlayStyle,
    },
    SetFreeKickTaker {
        side: Side,
        player_id: String,
    },
    SetCornerTaker {
        side: Side,
        player_id: String,
    },
    SetPenaltyTaker {
        side: Side,
        player_id: String,
    },
    SetCaptain {
        side: Side,
        player_id: String,
    },
    PreMatchSwap {
        side: Side,
        player_off_id: String,
        player_on_id: String,
    },
    ChangePlayerRole {
        side: Side,
        player_id: String,
        role: PlayerRole,
    },
}

// ---------------------------------------------------------------------------
// SubstitutionRecord — tracks a substitution that was made
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubstitutionRecord {
    pub minute: u8,
    pub side: Side,
    pub player_off_id: String,
    pub player_on_id: String,
}

// ---------------------------------------------------------------------------
// SetPieceTakers — designated set piece takers for a side
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SetPieceTakers {
    pub free_kick_taker: Option<String>,
    pub corner_taker: Option<String>,
    pub penalty_taker: Option<String>,
    pub captain: Option<String>,
}

// ---------------------------------------------------------------------------
// MinuteResult — what happened during one simulated minute
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinuteResult {
    pub minute: u8,
    pub phase: MatchPhase,
    pub events: Vec<MatchEvent>,
    pub home_score: u8,
    pub away_score: u8,
    pub possession: Side,
    pub ball_zone: Zone,
    pub is_finished: bool,
}

// ---------------------------------------------------------------------------
// MatchSnapshot — full read-only view of the match for the UI
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchSnapshot {
    pub phase: MatchPhase,
    pub current_minute: u8,
    pub home_score: u8,
    pub away_score: u8,
    pub possession: Side,
    pub ball_zone: Zone,
    pub home_team: TeamData,
    pub away_team: TeamData,
    pub home_bench: Vec<PlayerData>,
    pub away_bench: Vec<PlayerData>,
    pub home_possession_pct: f64,
    pub away_possession_pct: f64,
    pub events: Vec<MatchEvent>,
    pub home_subs_made: u8,
    pub away_subs_made: u8,
    pub max_subs: u8,
    pub home_set_pieces: SetPieceTakers,
    pub away_set_pieces: SetPieceTakers,
    pub substitutions: Vec<SubstitutionRecord>,
    pub allows_extra_time: bool,
    pub home_yellows: HashMap<String, u8>,
    pub away_yellows: HashMap<String, u8>,
    pub sent_off: HashSet<String>,
    pub penalty_shootout: Option<PenaltyShootoutSnapshot>,
}

// ---------------------------------------------------------------------------
// PenaltyShootoutSnapshot — public snapshot of shootout progress for the UI
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PenaltyShootoutSnapshot {
    pub home_taken: u8,
    pub away_taken: u8,
    pub home_scored: u8,
    pub away_scored: u8,
    pub sudden_death: bool,
}

// ---------------------------------------------------------------------------
// PenaltyShootoutState — tracks penalty shootout progress
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default)]
#[allow(dead_code)]
struct PenaltyShootoutState {
    round: u8,
    home_taken: u8,
    away_taken: u8,
    home_scored: u8,
    away_scored: u8,
    sudden_death: bool,
}

// ---------------------------------------------------------------------------
// LiveMatchState — the core step-by-step simulation engine
// ---------------------------------------------------------------------------

/// The live match session is held behind a mutex in `StateManager` and shared
/// between the Tauri command pool and, under the `mcp` feature, the MCP
/// server's runtime. So this type has to be `Send`, and the cheapest way to
/// make a hot-path field faster — a reference-counted handle — is exactly the
/// kind of change that quietly takes that away. Worse, it would still compile
/// here and only fail in the crate that shares it, under a feature flag that is
/// off by default.
const _: () = {
    const fn assert_send<T: Send>() {}
    assert_send::<LiveMatchState>();
};

pub struct LiveMatchState {
    // Teams (owned — subs mutate the player list)
    home: TeamData,
    away: TeamData,
    config: MatchConfig,

    // Match progress
    phase: MatchPhase,
    current_minute: u8,

    // Score
    home_score: u8,
    away_score: u8,

    // Field state
    ball_zone: Zone,
    possession: Side,

    // Events log
    events: Vec<MatchEvent>,

    // Possession tracking
    home_possession_ticks: u32,
    away_possession_ticks: u32,

    // Discipline
    yellows: HashMap<String, u8>,
    sent_off: HashSet<String>,

    // Substitutions
    home_subs_made: u8,
    away_subs_made: u8,
    max_subs: u8,
    substitutions: Vec<SubstitutionRecord>,

    // Bench players (available for substitution)
    home_bench: Vec<PlayerData>,
    away_bench: Vec<PlayerData>,

    // Set piece takers
    home_set_pieces: SetPieceTakers,
    away_set_pieces: SetPieceTakers,

    // Extra time / knockout
    allows_extra_time: bool,

    // Stoppage time (pre-computed when each half starts)
    first_half_stoppage: u8,
    second_half_stoppage: u8,
    et_first_half_stoppage: u8,
    et_second_half_stoppage: u8,

    // Everything about a player the resolution code reads by index rather than
    // by id — stamina, traits, and a shared handle on the id itself. Aligned
    // with each side's `players` order; see `squad_cache`.
    home_cache: SquadCache,
    away_cache: SquadCache,

    // Expected goals, assists and threat, and ground covered — the numbers
    // football talks about that no counting stat records. See `metrics`.
    home_metrics: MetricTally,
    away_metrics: MetricTally,

    // Penalty shootout state
    penalty_state: PenaltyShootoutState,

    // Rolling window of the last 10 ball_zone values (oldest first)
    recent_zones: VecDeque<Zone>,

    /// A corner has been won and not yet played out. The next shot in the box
    /// is a delivery attacked in the air rather than a ball played into
    /// somebody's feet — which is what makes a corner produce headers.
    awaiting_set_piece: bool,
}

impl LiveMatchState {
    /// Create a new live match. `starting_xi` are already in `home.players` / `away.players`.
    /// Bench players are separate and available for substitution.
    pub fn new(
        home: TeamData,
        away: TeamData,
        config: MatchConfig,
        home_bench: Vec<PlayerData>,
        away_bench: Vec<PlayerData>,
        allows_extra_time: bool,
    ) -> Self {
        let home_cache = SquadCache::new(&home.players);
        let away_cache = SquadCache::new(&away.players);
        let home_metrics = MetricTally::new(home_cache.work_rates());
        let away_metrics = MetricTally::new(away_cache.work_rates());

        Self {
            home,
            away,
            config,
            phase: MatchPhase::PreKickOff,
            current_minute: 0,
            home_score: 0,
            away_score: 0,
            ball_zone: Zone::Midfield,
            possession: Side::Home,
            events: Vec::with_capacity(300),
            home_possession_ticks: 0,
            away_possession_ticks: 0,
            yellows: HashMap::new(),
            sent_off: HashSet::new(),
            home_subs_made: 0,
            away_subs_made: 0,
            max_subs: 5,
            substitutions: Vec::new(),
            home_bench,
            away_bench,
            home_set_pieces: SetPieceTakers::default(),
            away_set_pieces: SetPieceTakers::default(),
            allows_extra_time,
            first_half_stoppage: 0,
            second_half_stoppage: 0,
            et_first_half_stoppage: 0,
            et_second_half_stoppage: 0,
            home_cache,
            away_cache,
            home_metrics,
            away_metrics,
            penalty_state: PenaltyShootoutState::default(),
            recent_zones: VecDeque::with_capacity(10),
            awaiting_set_piece: false,
        }
    }

    /// Step one minute forward. Returns the events that occurred.
    pub fn step_minute<R: Rng + ?Sized>(&mut self, rng: &mut R) -> MinuteResult {
        match self.phase {
            MatchPhase::PreKickOff => self.start_match(rng),
            MatchPhase::FirstHalf => self.play_minute(rng),
            MatchPhase::HalfTime => self.start_second_half(rng),
            MatchPhase::SecondHalf => self.play_minute(rng),
            MatchPhase::FullTime => self.handle_full_time(rng),
            MatchPhase::ExtraTimeFirstHalf => self.play_minute(rng),
            MatchPhase::ExtraTimeHalfTime => self.start_et_second_half(rng),
            MatchPhase::ExtraTimeSecondHalf => self.play_minute(rng),
            MatchPhase::ExtraTimeEnd => self.handle_et_end(rng),
            MatchPhase::PenaltyShootout => self.play_penalty_round(rng),
            MatchPhase::Finished => self.make_result(true),
        }
    }

    /// Apply a command (substitution, tactic change, set piece assignment).
    pub fn apply_command(&mut self, cmd: MatchCommand) -> Result<(), String> {
        match cmd {
            MatchCommand::Substitute {
                side,
                player_off_id,
                player_on_id,
            } => self.do_substitution(side, &player_off_id, &player_on_id),
            MatchCommand::ChangeFormation { side, formation } => {
                self.apply_formation(side, &formation);
                Ok(())
            }
            MatchCommand::ChangePlayStyle { side, play_style } => {
                self.team_mut(side).play_style = play_style;
                Ok(())
            }
            MatchCommand::SetFreeKickTaker { side, player_id } => {
                self.set_pieces_mut(side).free_kick_taker = Some(player_id);
                Ok(())
            }
            MatchCommand::SetCornerTaker { side, player_id } => {
                self.set_pieces_mut(side).corner_taker = Some(player_id);
                Ok(())
            }
            MatchCommand::SetPenaltyTaker { side, player_id } => {
                self.set_pieces_mut(side).penalty_taker = Some(player_id);
                Ok(())
            }
            MatchCommand::SetCaptain { side, player_id } => {
                self.set_pieces_mut(side).captain = Some(player_id);
                Ok(())
            }
            MatchCommand::PreMatchSwap {
                side,
                player_off_id,
                player_on_id,
            } => {
                if self.phase != MatchPhase::PreKickOff {
                    return Err("be.error.liveMatch.preMatchSwapTooLate".into());
                }
                self.do_pre_match_swap(side, &player_off_id, &player_on_id)
            }
            MatchCommand::ChangePlayerRole {
                side,
                player_id,
                role,
            } => {
                let team = self.team_mut(side);
                if let Some(p) = team.players.iter_mut().find(|p| p.id == player_id)
                    && is_role_valid_for_position(role, p.position)
                {
                    p.role = role;
                }
                Ok(())
            }
        }
    }

    /// Convert the finished match into a MatchReport.
    pub fn into_report(self) -> MatchReport {
        let tracked_player_ids = self
            .home
            .players
            .iter()
            .chain(self.away.players.iter())
            .map(|player| player.id.clone())
            .collect();

        let home_metrics = self.home_metrics.by_id(|index| self.home_cache.id(index));
        let away_metrics = self.away_metrics.by_id(|index| self.away_cache.id(index));

        let mut report = MatchReport::from_events_with_players(
            self.events,
            self.home_possession_ticks,
            self.away_possession_ticks,
            self.current_minute,
            tracked_player_ids,
        );
        // Includes players who were substituted off: they have a performance
        // to rate even though they are no longer in the eleven.
        let side_ids = |players: &[PlayerData], side: Side| -> Vec<String> {
            players
                .iter()
                .map(|player| player.id.clone())
                .chain(
                    self.substitutions
                        .iter()
                        .filter(|sub| sub.side == side)
                        .map(|sub| sub.player_off_id.clone()),
                )
                .collect()
        };
        let home_ids = side_ids(&self.home.players, Side::Home);
        let away_ids = side_ids(&self.away.players, Side::Away);
        let home_refs: Vec<&str> = home_ids.iter().map(String::as_str).collect();
        let away_refs: Vec<&str> = away_ids.iter().map(String::as_str).collect();
        // Expected goals, assists and threat are accumulated as the match runs
        // rather than read back off the event log, because the log has no place
        // to put them: threat accrues on actions that produce no event at all.
        for (metrics, stats) in [
            (&home_metrics, &mut report.home_stats),
            (&away_metrics, &mut report.away_stats),
        ] {
            stats.xg = metrics.values().map(|m| m.xg).sum::<f64>() as f32;
        }
        for (id, m) in home_metrics.iter().chain(away_metrics.iter()) {
            // A player with nothing but running to show for his afternoon still
            // needs a row, or the distance he covered disappears.
            let entry = report.player_stats.entry(id.to_string()).or_default();
            entry.xg = m.xg as f32;
            entry.xa = m.xa as f32;
            entry.xt = m.xt as f32;
            entry.distance_km = m.distance_km as f32;
        }

        report.assign_ratings(&home_refs, &away_refs);

        if self.penalty_state.home_taken > 0 || self.penalty_state.away_taken > 0 {
            report.home_penalties = Some(self.penalty_state.home_scored);
            report.away_penalties = Some(self.penalty_state.away_scored);
        }
        report
    }

    /// Is the match finished?
    pub fn is_finished(&self) -> bool {
        self.phase == MatchPhase::Finished
    }

    /// Current phase
    /// The event log so far. Grows as the match is stepped.
    pub fn events(&self) -> &[MatchEvent] {
        &self.events
    }

    pub fn phase(&self) -> MatchPhase {
        self.phase
    }

    /// Current minute
    pub fn minute(&self) -> u8 {
        self.current_minute
    }

    /// Rolling window of the last ≤10 ball_zone values (oldest first)
    pub fn recent_zones(&self) -> &VecDeque<Zone> {
        &self.recent_zones
    }

    /// Get the bench for a side
    pub fn bench(&self, side: Side) -> &[PlayerData] {
        match side {
            Side::Home => &self.home_bench,
            Side::Away => &self.away_bench,
        }
    }

    /// Simulate a red card for a player (adds to sent_off set).
    /// Primarily used for testing substitution guards.
    pub fn test_send_off(&mut self, player_id: &str) {
        self.sent_off.insert(player_id.to_string());
    }
}

fn is_role_valid_for_position(role: PlayerRole, position: crate::types::Position) -> bool {
    use crate::types::Position;
    match position {
        Position::Goalkeeper => matches!(
            role,
            PlayerRole::Standard | PlayerRole::BallPlayingKeeper | PlayerRole::SweeperKeeper
        ),
        Position::Defender => matches!(
            role,
            PlayerRole::Standard
                | PlayerRole::Stopper
                | PlayerRole::CoverCB
                | PlayerRole::BallPlayingCB
                | PlayerRole::AttackingFB
                | PlayerRole::DefensiveFB
                | PlayerRole::InvertedFB
                | PlayerRole::WingBack
        ),
        Position::Midfielder => matches!(
            role,
            PlayerRole::Standard
                | PlayerRole::AnchorMan
                | PlayerRole::BallWinner
                | PlayerRole::DeepLyingPlaymaker
                | PlayerRole::BoxToBox
                | PlayerRole::Carrilero
                | PlayerRole::Mezzala
                | PlayerRole::AdvancedPlaymaker
                | PlayerRole::ShadowStriker
                | PlayerRole::WideForward
                | PlayerRole::InsideForward
                | PlayerRole::InvertedWinger
        ),
        Position::Forward => matches!(
            role,
            PlayerRole::Standard
                | PlayerRole::Poacher
                | PlayerRole::TargetMan
                | PlayerRole::DeepLyingForward
                | PlayerRole::False9
                | PlayerRole::PressingForward
                | PlayerRole::CompleteForward
        ),
    }
}
