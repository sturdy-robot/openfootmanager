mod team_builder;
pub use team_builder::auto_select_set_pieces;
pub(crate) use team_builder::build_team_with_bench;

use rand::SeedableRng;
use rand::rngs::StdRng;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::game::Game;

use domain::league::{
    ReplayCommand, ReplayCommandKind, ReplayInput, ReplayLineup, StandingEntry,
};
use domain::manager::Manager;
use domain::team::MatchRoles;
use engine::ai::{self, AiPersonality, AiProfile};
use engine::{LiveMatchState, MatchCommand, MatchConfig, MatchSnapshot, MinuteResult, Side};

/// Translate an engine command into its stored replay form.
///
/// Returns `None` for commands that carry no replay meaning. Kept exhaustive
/// (no wildcard arm) so a new `MatchCommand` variant fails to compile here
/// rather than being silently dropped from replays.
fn to_replay_command(cmd: &MatchCommand) -> Option<ReplayCommandKind> {
    let home = |side: &Side| *side == Side::Home;
    Some(match cmd {
        MatchCommand::Substitute {
            side,
            player_off_id,
            player_on_id,
        } => ReplayCommandKind::Substitute {
            home: home(side),
            player_off_id: player_off_id.clone(),
            player_on_id: player_on_id.clone(),
        },
        MatchCommand::PreMatchSwap {
            side,
            player_off_id,
            player_on_id,
        } => ReplayCommandKind::PreMatchSwap {
            home: home(side),
            player_off_id: player_off_id.clone(),
            player_on_id: player_on_id.clone(),
        },
        MatchCommand::ChangeFormation { side, formation } => ReplayCommandKind::ChangeFormation {
            home: home(side),
            formation: formation.clone(),
        },
        MatchCommand::ChangePlayStyle { side, play_style } => ReplayCommandKind::ChangePlayStyle {
            home: home(side),
            play_style: match play_style {
                engine::PlayStyle::Balanced => domain::team::PlayStyle::Balanced,
                engine::PlayStyle::Attacking => domain::team::PlayStyle::Attacking,
                engine::PlayStyle::Defensive => domain::team::PlayStyle::Defensive,
                engine::PlayStyle::Possession => domain::team::PlayStyle::Possession,
                engine::PlayStyle::Counter => domain::team::PlayStyle::Counter,
                engine::PlayStyle::HighPress => domain::team::PlayStyle::HighPress,
            },
        },
        MatchCommand::ChangePlayerRole {
            side,
            player_id,
            role,
        } => ReplayCommandKind::ChangePlayerRole {
            home: home(side),
            player_id: player_id.clone(),
            role: team_builder::engine_to_domain_role(*role),
        },
        MatchCommand::SetFreeKickTaker { side, player_id } => {
            ReplayCommandKind::SetFreeKickTaker {
                home: home(side),
                player_id: player_id.clone(),
            }
        }
        MatchCommand::SetCornerTaker { side, player_id } => ReplayCommandKind::SetCornerTaker {
            home: home(side),
            player_id: player_id.clone(),
        },
        MatchCommand::SetPenaltyTaker { side, player_id } => ReplayCommandKind::SetPenaltyTaker {
            home: home(side),
            player_id: player_id.clone(),
        },
        MatchCommand::SetCaptain { side, player_id } => ReplayCommandKind::SetCaptain {
            home: home(side),
            player_id: player_id.clone(),
        },
    })
}

/// Capture how one side lines up at kick-off.
fn capture_lineup(game: &Game, team_id: &str, xi: &engine::TeamData, bench: &[engine::PlayerData]) -> ReplayLineup {
    let team = game.teams.iter().find(|team| team.id == team_id);
    ReplayLineup {
        formation: xi.formation.clone(),
        starting_xi_ids: xi.players.iter().map(|p| p.id.clone()).collect(),
        bench_ids: bench.iter().map(|p| p.id.clone()).collect(),
        player_roles: team
            .map(|team| {
                team.player_roles
                    .iter()
                    .map(|(id, role)| (id.clone(), role.clone()))
                    .collect()
            })
            .unwrap_or_default(),
        tactics: team
            .map(|team| team.tactics_phase.clone())
            .unwrap_or_default(),
        // Condition at kick-off, which is not recoverable from a later save.
        conditions: xi
            .players
            .iter()
            .chain(bench.iter())
            .map(|p| (p.id.clone(), p.condition))
            .collect(),
    }
}

/// Offset that derives the AI's random stream from the fixture seed.
///
/// Changing it changes every AI decision for a given seed, so it is engine
/// behaviour: treat it as pinned, and bump `engine::ENGINE_VERSION` if it ever
/// has to move.
const AI_STREAM_SALT: u64 = 0xA15E_EDA1_5EED;

const LIVE_MATCH_NO_LEAGUE_ERROR: &str = "be.error.liveMatch.noLeague";
const LIVE_MATCH_FIXTURE_NOT_FOUND_ERROR: &str = "be.error.liveMatch.fixtureNotFound";

fn resolve_match_role_assignment(
    assigned_id: &Option<String>,
    starter_ids: &HashSet<String>,
    fallback_id: Option<String>,
) -> Option<String> {
    if let Some(player_id) = assigned_id
        && starter_ids.contains(player_id)
    {
        return Some(player_id.clone());
    }

    fallback_id
}

fn apply_saved_match_roles(
    match_state: &mut LiveMatchState,
    side: Side,
    match_roles: &MatchRoles,
    starter_ids: &[String],
    auto_selection: (
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    ),
) {
    let starter_id_set = starter_ids.iter().cloned().collect::<HashSet<_>>();
    let (auto_captain, auto_penalty, auto_free_kick, auto_corner) = auto_selection;

    if let Some(player_id) =
        resolve_match_role_assignment(&match_roles.captain, &starter_id_set, auto_captain)
    {
        let _ = match_state.apply_command(MatchCommand::SetCaptain { side, player_id });
    }

    if let Some(player_id) =
        resolve_match_role_assignment(&match_roles.penalty_taker, &starter_id_set, auto_penalty)
    {
        let _ = match_state.apply_command(MatchCommand::SetPenaltyTaker { side, player_id });
    }

    if let Some(player_id) = resolve_match_role_assignment(
        &match_roles.free_kick_taker,
        &starter_id_set,
        auto_free_kick,
    ) {
        let _ = match_state.apply_command(MatchCommand::SetFreeKickTaker { side, player_id });
    }

    if let Some(player_id) =
        resolve_match_role_assignment(&match_roles.corner_taker, &starter_id_set, auto_corner)
    {
        let _ = match_state.apply_command(MatchCommand::SetCornerTaker { side, player_id });
    }
}

// ---------------------------------------------------------------------------
// MatchMode — how the user wants to experience this match
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MatchMode {
    /// User controls their team live (full interactivity)
    Live,
    /// User watches as spectator (no interaction, can control speed)
    Spectator,
    /// Instantly simulate — no UI, just get the result
    Instant,
}

// ---------------------------------------------------------------------------
// LiveMatchSession — wraps LiveMatchState + metadata for Tauri layer
// ---------------------------------------------------------------------------

pub struct LiveMatchSession {
    pub match_state: LiveMatchState,
    /// The simulation stream: everything the match engine itself draws.
    ///
    /// Deliberately separate from `ai_rng`. With one shared generator, a user
    /// substitution changes how many draws the AI consumes, which shifts every
    /// subsequent simulation draw — so a replay would reconstruct a *different*
    /// match while presenting it as history. Splitting the streams by concern
    /// keeps the simulation aligned no matter what the user does.
    pub rng: StdRng,
    /// The in-match AI's stream, seeded independently from the same fixture
    /// seed.
    pub ai_rng: StdRng,
    /// Seed this match's RNG was created from, stored so the fixture can be
    /// re-simulated later to replay the match.
    pub seed: u64,
    /// User commands in the order they were applied, with the minute they were
    /// applied at. Only the human's decisions are recorded: AI decisions are
    /// drawn from `rng` and so are reproduced by the seed alone.
    pub recorded_commands: Vec<ReplayCommand>,
    /// How each side lined up at kick-off. Captured rather than re-derived,
    /// because condition, injuries and personnel all move on afterwards.
    pub kickoff_home: ReplayLineup,
    pub kickoff_away: ReplayLineup,
    pub mode: MatchMode,
    /// Index into the fixtures of the competition identified by
    /// `competition_id` — NOT necessarily into `game.league`, which
    /// `sync_legacy_league` resets to the user's domestic league.
    pub fixture_index: usize,
    /// Id of the competition (league or cup) this fixture belongs to; the
    /// finish path uses it to apply the report to the right competition.
    pub competition_id: String,
    pub round_matchday: u32,
    pub round_previous_standings: Vec<StandingEntry>,
    pub home_team_id: String,
    pub away_team_id: String,
    pub user_side: Option<Side>,
    pub ai_home: AiProfile,
    pub ai_away: AiProfile,
}

impl LiveMatchSession {
    /// Step one minute and apply AI decisions for computer-controlled sides.
    pub fn step(&mut self) -> MinuteResult {
        let result = self.match_state.step_minute(&mut self.rng);

        // Apply AI decisions for non-user sides (only during playing phases)
        if !result.is_finished {
            self.apply_ai_decisions();
        }

        result
    }

    /// Step multiple minutes at once (for fast-forward / instant sim).
    pub fn step_many(&mut self, count: u16) -> Vec<MinuteResult> {
        let mut results = Vec::with_capacity(count as usize);
        for _ in 0..count {
            let result = self.step();
            let finished = result.is_finished;
            results.push(result);
            if finished {
                break;
            }
        }
        results
    }

    /// Run the entire match to completion instantly.
    pub fn run_to_completion(&mut self) -> Vec<MinuteResult> {
        let mut results = Vec::with_capacity(100);
        loop {
            let result = self.step();
            let finished = result.is_finished;
            results.push(result);
            if finished {
                break;
            }
        }
        results
    }

    pub fn snapshot(&self) -> MatchSnapshot {
        self.match_state.snapshot()
    }

    /// Apply a user command.
    ///
    /// This is the funnel for *human* decisions only — the in-match AI calls
    /// `match_state.apply_command` directly (see `apply_ai_decisions`), which is
    /// what lets replay capture record the user's inputs without also recording
    /// decisions the seed already reproduces.
    pub fn apply_command(&mut self, cmd: MatchCommand) -> Result<(), String> {
        // Record only commands the engine accepted; a rejected command changed
        // nothing, so replaying it would diverge from what actually happened.
        if let Some(command) = to_replay_command(&cmd) {
            self.match_state.apply_command(cmd)?;
            self.recorded_commands.push(ReplayCommand {
                minute: self.match_state.minute(),
                command,
            });
            return Ok(());
        }
        self.match_state.apply_command(cmd)
    }

    /// The inputs needed to replay this match, for storing on the fixture.
    pub fn replay_input(&self) -> ReplayInput {
        ReplayInput {
            home: self.kickoff_home.clone(),
            away: self.kickoff_away.clone(),
            commands: self.recorded_commands.clone(),
        }
    }

    pub fn is_finished(&self) -> bool {
        self.match_state.is_finished()
    }

    fn apply_ai_decisions(&mut self) {
        // Drawn from `ai_rng`, not `rng`: see the field comments. The AI's draw
        // count varies with what the user has done, so it must not be able to
        // shift the simulation stream.
        // AI for home team (if not user-controlled)
        if self.user_side != Some(Side::Home) {
            let cmds = ai::ai_decide(
                &self.match_state,
                Side::Home,
                &self.ai_home,
                &mut self.ai_rng,
            );
            for cmd in cmds {
                let _ = self.match_state.apply_command(cmd);
            }
        }

        // AI for away team (if not user-controlled)
        if self.user_side != Some(Side::Away) {
            let cmds = ai::ai_decide(
                &self.match_state,
                Side::Away,
                &self.ai_away,
                &mut self.ai_rng,
            );
            for cmd in cmds {
                let _ = self.match_state.apply_command(cmd);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Helper: build a LiveMatchSession from the Game state
// ---------------------------------------------------------------------------

/// Create a live match session for a specific fixture.
pub fn create_live_match(
    game: &Game,
    fixture_index: usize,
    mode: MatchMode,
    allows_extra_time: bool,
) -> Result<LiveMatchSession, String> {
    let league = game.league.as_ref().ok_or(LIVE_MATCH_NO_LEAGUE_ERROR)?;
    let fixture = league
        .fixtures
        .get(fixture_index)
        .ok_or(LIVE_MATCH_FIXTURE_NOT_FOUND_ERROR)?;

    let home_team_id = fixture.home_team_id.clone();
    let away_team_id = fixture.away_team_id.clone();
    let seed = fixture.simulation_seed();

    // Build engine TeamData (starting XI = first 11 players by position)
    let (home_xi, home_bench) = build_team_with_bench(game, &home_team_id);
    let (away_xi, away_bench) = build_team_with_bench(game, &away_team_id);
    let kickoff_home = capture_lineup(game, &home_team_id, &home_xi, &home_bench);
    let kickoff_away = capture_lineup(game, &away_team_id, &away_xi, &away_bench);
    let home_starter_ids = home_xi
        .players
        .iter()
        .map(|player| player.id.clone())
        .collect::<Vec<_>>();
    let away_starter_ids = away_xi
        .players
        .iter()
        .map(|player| player.id.clone())
        .collect::<Vec<_>>();
    let home_match_roles = game
        .teams
        .iter()
        .find(|team| team.id == home_team_id)
        .map(|team| team.match_roles.clone())
        .unwrap_or_default();
    let away_match_roles = game
        .teams
        .iter()
        .find(|team| team.id == away_team_id)
        .map(|team| team.match_roles.clone())
        .unwrap_or_default();
    let home_auto_selection = auto_select_set_pieces(game, &home_starter_ids);
    let away_auto_selection = auto_select_set_pieces(game, &away_starter_ids);

    let config = MatchConfig::default();

    let mut match_state = LiveMatchState::new(
        home_xi,
        away_xi,
        config,
        home_bench,
        away_bench,
        allows_extra_time,
    );
    apply_saved_match_roles(
        &mut match_state,
        Side::Home,
        &home_match_roles,
        &home_starter_ids,
        home_auto_selection,
    );
    apply_saved_match_roles(
        &mut match_state,
        Side::Away,
        &away_match_roles,
        &away_starter_ids,
        away_auto_selection,
    );

    // Determine user side
    let user_side = game.manager.team_id.as_ref().and_then(|tid| {
        if *tid == home_team_id {
            Some(Side::Home)
        } else if *tid == away_team_id {
            Some(Side::Away)
        } else {
            None
        }
    });

    let ai_home = ai_profile_for(game, &home_team_id);
    let ai_away = ai_profile_for(game, &away_team_id);

    Ok(LiveMatchSession {
        match_state,
        // Seeded from the fixture rather than thread entropy, so the match can
        // be re-simulated later and replayed exactly as it was played. The two
        // streams are derived from the same seed but kept independent.
        rng: StdRng::seed_from_u64(seed),
        ai_rng: StdRng::seed_from_u64(seed ^ AI_STREAM_SALT),
        seed,
        recorded_commands: Vec::new(),
        kickoff_home,
        kickoff_away,
        mode,
        fixture_index,
        competition_id: league.id.clone(),
        round_matchday: fixture.matchday,
        round_previous_standings: league.standings.clone(),
        home_team_id,
        away_team_id,
        user_side,
        ai_home,
        ai_away,
    })
}

fn manager_for_team<'a>(game: &'a Game, team_id: &str) -> Option<&'a Manager> {
    let manager_id = game
        .teams
        .iter()
        .find(|team| team.id == team_id)
        .and_then(|team| team.manager_id.as_deref())?;

    game.managers
        .iter()
        .find(|manager| manager.id == manager_id)
        .or_else(|| (game.manager.id == manager_id).then_some(&game.manager))
}

/// The dugout profile for a club: how sophisticated its in-match decisions are.
///
/// Shared by the watched match and by unattended fixtures, so a club manages
/// itself the same way whether or not the player is looking.
pub(crate) fn ai_profile_for(game: &Game, team_id: &str) -> AiProfile {
    let reputation = game
        .teams
        .iter()
        .find(|team| team.id == team_id)
        .map(|team| team.reputation)
        .unwrap_or(500);
    AiProfile {
        reputation,
        experience: (reputation / 10).min(100) as u8,
        personality: derive_personality(reputation, manager_for_team(game, team_id)),
    }
}

/// Derive an AI personality from reputation and career statistics.
///
/// - Visionary: high reputation (700+) with substantial matches managed (50+)
/// - Reactive: moderate reputation with a winning record (win rate ≥ 55 %)
/// - Pragmatist: default
fn derive_personality(rep: u32, manager: Option<&Manager>) -> AiPersonality {
    if let Some(manager) = manager {
        let stats = &manager.career_stats;
        let total = stats.matches_managed;
        if rep >= 700 && total >= 50 {
            return AiPersonality::Visionary;
        }
        if total >= 20 {
            let win_rate = stats.wins as f64 / total as f64;
            if win_rate >= 0.55 {
                return AiPersonality::Reactive;
            }
        }
    }

    if rep >= 800 {
        return AiPersonality::Visionary;
    }

    AiPersonality::Pragmatist
}
