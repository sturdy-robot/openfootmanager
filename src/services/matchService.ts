import { invoke } from "@tauri-apps/api/core";

import type { GameStateData } from "../store/gameStore";
import type {
  MatchCommand,
  MinuteResult,
  MatchSnapshot,
  MatchTacticsChangeSet,
  RoundSummary,
} from "../components/match/types";

interface StartLiveMatchOptions {
  allowsExtraTime: boolean;
  fixtureIndex: number;
  mode: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
}

export interface PressConferenceAnswer {
  question_id: string;
  question_text: string;
  response_id: string;
  response_text: string;
  response_text_key: string;
  response_tone?: string;
  response_text_params?: Record<string, string>;
  player_id?: string;
}

interface SubmitPressConferenceOptions {
  answers: PressConferenceAnswer[];
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  userTeamName: string;
  userTeamId: string;
  prerenderedBody: string;
  prerenderedHeadline: string;
}

export interface TeamTalkMoraleChange {
  player_id: string;
  player_name: string;
  old_morale: number;
  new_morale: number;
  delta: number;
}

export interface PressConferenceResult {
  game: GameStateData;
  morale_delta: number;
}

export interface AutoSelectSetPiecesResult {
  captain: string | null;
  penalty_taker: string | null;
  free_kick_taker: string | null;
  corner_taker: string | null;
}

export interface FinishLiveMatchResponse {
  game: GameStateData;
  round_summary?: RoundSummary | null;
}

export function startLiveMatch(
  options: StartLiveMatchOptions,
): Promise<MatchSnapshot> {
  return invoke<MatchSnapshot>("start_live_match", { ...options });
}

export function getMatchSnapshot(): Promise<MatchSnapshot | null> {
  return invoke<MatchSnapshot | null>("get_match_snapshot");
}

export function stepLiveMatch(minutes: number): Promise<MinuteResult[]> {
  return invoke<MinuteResult[]>("step_live_match", { minutes });
}

export function applyMatchCommand(
  command: MatchCommand,
): Promise<MatchSnapshot> {
  return invoke<MatchSnapshot>("apply_match_command", { command });
}

export function finishLiveMatch(): Promise<FinishLiveMatchResponse> {
  return invoke<FinishLiveMatchResponse>("finish_live_match");
}

export function applyTeamTalk(
  tone: string,
  context: string,
): Promise<TeamTalkMoraleChange[]> {
  return invoke<TeamTalkMoraleChange[]>("apply_team_talk", { tone, context });
}

export function submitPressConference(
  options: SubmitPressConferenceOptions,
): Promise<PressConferenceResult> {
  return invoke<PressConferenceResult>("submit_press_conference", {
    ...options,
  });
}

export function autoSelectSetPieces(
  playerIds: string[],
): Promise<AutoSelectSetPiecesResult> {
  return invoke<AutoSelectSetPiecesResult>("auto_select_set_pieces", {
    playerIds,
  });
}

export function applyMatchTactics(
  changes: MatchTacticsChangeSet,
): Promise<MatchSnapshot> {
  return invoke<MatchSnapshot>("apply_match_tactics", { changes });
}
