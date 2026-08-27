mod helpers;
mod penalty;
mod simulation;
mod snapshot;
mod step_response;
mod substitution;
mod zone_resolution;

pub use step_response::{MatchDelta, MatchStepBaseline, MatchStepResponse, PlayerCondition};

use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

use crate::event::MatchEvent;
use crate::report::MatchReport;
use crate::types::{
    MatchConfig, PlayStyle, PlayerData, PlayerRole, Side, TacticsConfig, TeamData, Zone,
};

// ---------------------------------------------------------------------------
// MatchPhase — tracks where we are in the match lifecycle
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TacticalLineupChange {
    pub slot_index: usize,
    pub expected_outgoing_player_id: String,
    pub incoming_player_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchTacticsChangeSet {
    pub side: Side,
    pub formation: String,
    pub play_style: PlayStyle,
    pub tactics: TacticsConfig,
    pub slot_roles: Vec<PlayerRole>,
    pub lineup_changes: Vec<TacticalLineupChange>,
    pub assignments: SetPieceTakers,
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

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
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
    /// Where the match stood when this was taken.
    ///
    /// Carried here and not only on the step response because every screen
    /// that applies a command is handed a whole snapshot — without it, a
    /// client would fall out of step after every change and stay there.
    #[serde(default)]
    pub revision: u64,
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

#[derive(Clone)]
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

    // Per-minute stamina depletion tracking (player_id → current effective condition)
    player_conditions: HashMap<String, f64>,

    // Penalty shootout state
    penalty_state: PenaltyShootoutState,

    // Rolling window of the last 10 ball_zone values (oldest first)
    recent_zones: VecDeque<Zone>,

    // Strictly increasing across every mutation, so a client can tell whether
    // the response it is holding describes the match it thinks it has.
    revision: u64,
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
        // Initialize player conditions from their condition attribute
        let mut player_conditions = HashMap::new();
        for p in home.players.iter().chain(away.players.iter()) {
            player_conditions.insert(p.id.clone(), p.condition as f64);
        }

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
            player_conditions,
            penalty_state: PenaltyShootoutState::default(),
            recent_zones: VecDeque::with_capacity(10),
            revision: 0,
        }
    }

    /// Step one minute forward. Returns the events that occurred.
    pub fn step_minute<R: Rng>(&mut self, rng: &mut R) -> MinuteResult {
        self.revision += 1;
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
        self.revision += 1;
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

    /// Apply a staged matchday change set to a clone, committing only after
    /// every lineup, role, and assignment validation succeeds.
    pub fn apply_tactics_change_set(
        &mut self,
        changes: MatchTacticsChangeSet,
    ) -> Result<(), String> {
        let mut candidate = self.clone();
        candidate.apply_tactics_change_set_in_place(&changes)?;
        // Only a set that passed in full moves the match on. A refused one
        // leaves the revision where it was, because nothing happened.
        candidate.revision += 1;
        *self = candidate;
        Ok(())
    }

    fn apply_tactics_change_set_in_place(
        &mut self,
        changes: &MatchTacticsChangeSet,
    ) -> Result<(), String> {
        let formation_parts = changes
            .formation
            .split('-')
            .map(str::parse::<usize>)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| "be.error.invalidFormation".to_string())?;
        if formation_parts.iter().sum::<usize>() != 10 {
            return Err("be.error.invalidFormation".into());
        }
        let team = self.team_ref(changes.side);
        let mut outgoing = HashSet::new();
        let mut incoming = HashSet::new();
        // Only what is actually a substitution is charged as one. Before kick-off
        // these changes go through `do_pre_match_swap` a few lines below — a
        // manager rearranging their team sheet has not used anything up, and
        // telling them they had run out of substitutions before a ball was
        // kicked would have been the first thing anyone noticed here.
        if self.phase != MatchPhase::PreKickOff
            && changes.lineup_changes.len()
                > self.max_subs.saturating_sub(match changes.side {
                    Side::Home => self.home_subs_made,
                    Side::Away => self.away_subs_made,
                }) as usize
        {
            return Err("be.error.liveMatch.maxSubstitutionsReached".into());
        }
        for change in &changes.lineup_changes {
            if team
                .players
                .get(change.slot_index)
                .map(|player| player.id.as_str())
                != Some(change.expected_outgoing_player_id.as_str())
            {
                return Err("be.error.liveMatch.staleLineupSlot".into());
            }
            if !outgoing.insert(change.expected_outgoing_player_id.as_str())
                || !incoming.insert(change.incoming_player_id.as_str())
            {
                return Err("be.error.liveMatch.duplicateLineupChange".into());
            }
            if !self
                .bench(changes.side)
                .iter()
                .any(|player| player.id == change.incoming_player_id)
            {
                return Err("be.error.liveMatch.playerNotOnBench".into());
            }
        }

        for change in &changes.lineup_changes {
            if self.phase == MatchPhase::PreKickOff {
                self.do_pre_match_swap(
                    changes.side,
                    &change.expected_outgoing_player_id,
                    &change.incoming_player_id,
                )?;
            } else {
                self.do_substitution(
                    changes.side,
                    &change.expected_outgoing_player_id,
                    &change.incoming_player_id,
                )?;
            }
        }

        self.apply_formation(changes.side, &changes.formation);
        let team = self.team_mut(changes.side);
        if changes.slot_roles.len() != team.players.len() {
            return Err("be.error.liveMatch.invalidSlotRoles".into());
        }
        team.play_style = changes.play_style;
        team.tactics = changes.tactics.clone();
        for (player, role) in team.players.iter_mut().zip(&changes.slot_roles) {
            if !is_role_valid_for_position(*role, player.position) {
                return Err("be.error.roleNotValidForPosition".into());
            }
            player.role = *role;
        }
        let on_field = team
            .players
            .iter()
            .map(|player| player.id.as_str())
            .collect::<HashSet<_>>();
        let assigned = [
            &changes.assignments.captain,
            &changes.assignments.penalty_taker,
            &changes.assignments.free_kick_taker,
            &changes.assignments.corner_taker,
        ];
        if assigned
            .into_iter()
            .flatten()
            .any(|player_id| !on_field.contains(player_id.as_str()))
        {
            return Err("be.error.liveMatch.assignmentPlayerNotOnPitch".into());
        }
        *self.set_pieces_mut(changes.side) = changes.assignments.clone();
        Ok(())
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

        let mut report = MatchReport::from_events_with_players(
            self.events,
            self.home_possession_ticks,
            self.away_possession_ticks,
            self.current_minute,
            tracked_player_ids,
        );
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
    pub fn phase(&self) -> MatchPhase {
        self.phase
    }

    /// Current minute
    pub fn minute(&self) -> u8 {
        self.current_minute
    }

    /// Rolling window of the last ≤10 ball_zone values (oldest first).
    ///
    /// Crate-private and iterator-shaped: only the AI reads this, and only to
    /// count zones. Handing out the `VecDeque` published a container choice
    /// that nothing outside the engine has any business depending on.
    pub(crate) fn recent_zones(&self) -> impl Iterator<Item = Zone> + '_ {
        self.recent_zones.iter().copied()
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
        self.revision += 1;
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
        // The engine keeps four coarse positions, so this bucket holds a
        // 4-3-3's wingers as well as its striker — and `ofm_core::tactics`,
        // the backend's own role authority, accepts winger roles here for
        // exactly that reason. Leaving them out refused every wide role the
        // squad screen had already accepted.
        Position::Forward => matches!(
            role,
            PlayerRole::Standard
                | PlayerRole::WideForward
                | PlayerRole::InsideForward
                | PlayerRole::InvertedWinger
                | PlayerRole::Poacher
                | PlayerRole::TargetMan
                | PlayerRole::DeepLyingForward
                | PlayerRole::False9
                | PlayerRole::PressingForward
                | PlayerRole::CompleteForward
        ),
    }
}
