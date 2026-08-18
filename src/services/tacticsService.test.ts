import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import {
  setFormation,
  setPlayStyle,
  setTeamMatchRoles,
} from "./squadService";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("tactics commands on squadService", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("sets the formation", async () => {
    const game = { manager: { id: "m1" } };
    mockedInvoke.mockResolvedValueOnce(game);

    await expect(setFormation("4-3-3")).resolves.toBe(game);
    expect(mockedInvoke).toHaveBeenCalledWith("set_formation", {
      formation: "4-3-3",
    });
  });

  it("sets the play style", async () => {
    const game = { manager: { id: "m1" } };
    mockedInvoke.mockResolvedValueOnce(game);

    await expect(setPlayStyle("HighPress")).resolves.toBe(game);
    expect(mockedInvoke).toHaveBeenCalledWith("set_play_style", {
      playStyle: "HighPress",
    });
  });

  it("sets the team match roles", async () => {
    const game = { manager: { id: "m1" } };
    const matchRoles = {
      captain: "p1",
      vice_captain: "p2",
      penalty_taker: "p3",
      free_kick_taker: "p4",
      corner_taker: "p5",
    };
    mockedInvoke.mockResolvedValueOnce(game);

    await expect(setTeamMatchRoles(matchRoles)).resolves.toBe(game);
    expect(mockedInvoke).toHaveBeenCalledWith("set_team_match_roles", {
      matchRoles,
    });
  });

  // Clearing a responsibility sends null, not an omitted key — the backend
  // distinguishes "no captain" from "leave the captain alone".
  it("preserves null responsibilities", async () => {
    mockedInvoke.mockResolvedValueOnce({});

    const matchRoles = {
      captain: null,
      vice_captain: null,
      penalty_taker: null,
      free_kick_taker: null,
      corner_taker: null,
    };
    await setTeamMatchRoles(matchRoles);

    expect(mockedInvoke).toHaveBeenCalledWith("set_team_match_roles", {
      matchRoles,
    });
  });

  it("lets a rejected command reach the caller", async () => {
    mockedInvoke.mockRejectedValueOnce("be.error.noTeamAssigned");

    await expect(setFormation("4-4-2")).rejects.toBe("be.error.noTeamAssigned");
  });
});
