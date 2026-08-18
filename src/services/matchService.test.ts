import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import {
  applyMatchCommand,
  applyTeamTalk,
  autoSelectSetPieces,
  finishLiveMatch,
  getMatchSnapshot,
  startLiveMatch,
  stepLiveMatch,
  submitPressConference,
} from "./matchService";
import type { MatchCommand } from "../components/match/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("matchService", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("starts a live match with the fixture and both team ids", async () => {
    const snapshot = { phase: "PreKickOff" };
    mockedInvoke.mockResolvedValueOnce(snapshot);

    await expect(
      startLiveMatch({
        allowsExtraTime: true,
        fixtureIndex: 3,
        mode: "live",
        homeTeamId: "team-home",
        awayTeamId: "team-away",
      }),
    ).resolves.toBe(snapshot);

    expect(mockedInvoke).toHaveBeenCalledWith("start_live_match", {
      allowsExtraTime: true,
      fixtureIndex: 3,
      mode: "live",
      homeTeamId: "team-home",
      awayTeamId: "team-away",
    });
  });

  // The restore path passes null when the route carries no snapshot to read
  // team ids from, and the backend distinguishes null from absent.
  it("preserves null team ids rather than dropping them", async () => {
    mockedInvoke.mockResolvedValueOnce({});

    await startLiveMatch({
      allowsExtraTime: false,
      fixtureIndex: 0,
      mode: "spectator",
      homeTeamId: null,
      awayTeamId: null,
    });

    expect(mockedInvoke).toHaveBeenCalledWith("start_live_match", {
      allowsExtraTime: false,
      fixtureIndex: 0,
      mode: "spectator",
      homeTeamId: null,
      awayTeamId: null,
    });
  });

  it("reads the current snapshot with no arguments", async () => {
    const snapshot = { current_minute: 12 };
    mockedInvoke.mockResolvedValueOnce(snapshot);

    await expect(getMatchSnapshot()).resolves.toBe(snapshot);
    expect(mockedInvoke).toHaveBeenCalledWith("get_match_snapshot");
  });

  // There is no live session before kick-off and after finalisation; the
  // command answers null rather than failing, and callers branch on it.
  it("passes through a null snapshot when no session is live", async () => {
    mockedInvoke.mockResolvedValueOnce(null);

    await expect(getMatchSnapshot()).resolves.toBeNull();
  });

  it("steps the match by a number of minutes", async () => {
    const minutes = [{ minute: 1 }];
    mockedInvoke.mockResolvedValueOnce(minutes);

    await expect(stepLiveMatch(1)).resolves.toBe(minutes);
    expect(mockedInvoke).toHaveBeenCalledWith("step_live_match", {
      minutes: 1,
    });
  });

  it("sends a match command under the command key", async () => {
    const snapshot = { home_score: 1 };
    const command: MatchCommand = {
      ChangeFormation: { side: "Home", formation: "4-3-3" },
    };
    mockedInvoke.mockResolvedValueOnce(snapshot);

    await expect(applyMatchCommand(command)).resolves.toBe(snapshot);
    expect(mockedInvoke).toHaveBeenCalledWith("apply_match_command", {
      command,
    });
  });

  it("finishes the live match with no arguments", async () => {
    const response = { game: {}, round_summary: null };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(finishLiveMatch()).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("finish_live_match");
  });

  it("applies a team talk and returns the per-player morale changes", async () => {
    const results = [
      {
        player_id: "p1",
        player_name: "Alves",
        old_morale: 60,
        new_morale: 68,
        delta: 8,
      },
    ];
    mockedInvoke.mockResolvedValueOnce(results);

    const changes = await applyTeamTalk("motivational", "losing");

    expect(mockedInvoke).toHaveBeenCalledWith("apply_team_talk", {
      tone: "motivational",
      context: "losing",
    });
    // Typed, not `any` — reading a field must survive the type check.
    expect(changes[0].player_name).toBe("Alves");
    expect(changes[0].delta).toBe(8);
  });

  it("submits press conference answers with the full fixture context", async () => {
    const result = { game: { manager: {} }, morale_delta: -2 };
    mockedInvoke.mockResolvedValueOnce(result);

    const answers = [
      {
        question_id: "q1",
        question_text: "How do you feel?",
        response_id: "r1",
        response_text: "Delighted.",
        response_text_key: "match.press.r1",
      },
    ];

    const response = await submitPressConference({
      answers,
      homeTeam: "Home FC",
      awayTeam: "Away FC",
      homeScore: 2,
      awayScore: 1,
      userTeamName: "Home FC",
      userTeamId: "team-home",
      prerenderedBody: "body",
      prerenderedHeadline: "headline",
    });

    expect(mockedInvoke).toHaveBeenCalledWith("submit_press_conference", {
      answers,
      homeTeam: "Home FC",
      awayTeam: "Away FC",
      homeScore: 2,
      awayScore: 1,
      userTeamName: "Home FC",
      userTeamId: "team-home",
      prerenderedBody: "body",
      prerenderedHeadline: "headline",
    });
    expect(response.morale_delta).toBe(-2);
  });

  it("auto-selects set-piece takers for the given squad", async () => {
    const result = {
      captain: "p1",
      penalty_taker: "p2",
      free_kick_taker: "p3",
      corner_taker: "p4",
    };
    mockedInvoke.mockResolvedValueOnce(result);

    const takers = await autoSelectSetPieces(["p1", "p2", "p3", "p4"]);

    expect(mockedInvoke).toHaveBeenCalledWith("auto_select_set_pieces", {
      playerIds: ["p1", "p2", "p3", "p4"],
    });
    expect(takers.captain).toBe("p1");
  });

  // Every taker is nullable: a squad with no eligible outfielder returns nulls
  // rather than omitting the keys, and the caller skips assignment.
  it("passes through null takers", async () => {
    mockedInvoke.mockResolvedValueOnce({
      captain: null,
      penalty_taker: null,
      free_kick_taker: null,
      corner_taker: null,
    });

    const takers = await autoSelectSetPieces([]);

    expect(takers.captain).toBeNull();
    expect(takers.corner_taker).toBeNull();
  });

  it("lets a rejected command reach the caller", async () => {
    mockedInvoke.mockRejectedValueOnce("be.error.noActiveGameSession");

    await expect(stepLiveMatch(1)).rejects.toBe("be.error.noActiveGameSession");
  });
});
