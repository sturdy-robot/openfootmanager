/**
 * Smoke tests for the QA fixture factories and mockIPC setup.
 *
 * These verify that:
 * 1. The factory functions produce structurally valid objects.
 * 2. mockIPC (via test-setup.ts's mockWindows) lets invoke() be intercepted
 *    without a real Tauri backend.
 */

import { mockIPC } from "@tauri-apps/api/mocks";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it } from "vitest";
import { makeGameState, makeManager, makePlayer, makeStaff, makeTeam } from "./fixtures";

describe("fixture factories", () => {
  it("makeManager produces a valid ManagerData shape", () => {
    const m = makeManager();
    expect(m.id).toBe("mgr_user");
    expect(m.career_stats.matches_managed).toBe(0);
    expect(m.career_history).toEqual([]);
  });

  it("makeTeam produces a valid TeamData shape", () => {
    const t = makeTeam();
    expect(t.id).toBe("team-1");
    expect(t.starting_xi_ids).toEqual([]);
  });

  it("makePlayer produces a valid PlayerData shape", () => {
    const p = makePlayer();
    expect(p.id).toBe("player-1");
    expect(p.attributes.pace).toBe(60);
    expect(p.transfer_offers).toEqual([]);
  });

  it("makeStaff produces a valid StaffData shape", () => {
    const s = makeStaff();
    expect(s.role).toBe("Coach");
    expect(s.attributes.coaching).toBe(60);
  });

  it("makeGameState composes all sub-factories", () => {
    const gs = makeGameState();
    expect(gs.manager.id).toBe("mgr_user");
    expect(gs.teams).toHaveLength(1);
    expect(gs.players).toEqual([]);
    expect(gs.league).toBeNull();
  });

  it("makeGameState accepts overrides for individual fields", () => {
    const gs = makeGameState({ players: [makePlayer(), makePlayer({ id: "player-2" })] });
    expect(gs.players).toHaveLength(2);
    expect(gs.players[1].id).toBe("player-2");
  });
});

describe("mockIPC", () => {
  it("intercepts invoke() calls and returns the mock response", async () => {
    const fakeGame = makeGameState();

    mockIPC((cmd) => {
      if (cmd === "get_active_game") return fakeGame;
    });

    const result = await invoke<typeof fakeGame>("get_active_game");
    expect(result.manager.id).toBe("mgr_user");
    expect(result.teams).toHaveLength(1);
  });

  it("can simulate an error response from a command", async () => {
    mockIPC((cmd) => {
      if (cmd === "advance_time") throw new Error("be.error.noActiveGame");
    });

    await expect(invoke("advance_time", { days: 7 })).rejects.toThrow("be.error.noActiveGame");
  });
});
