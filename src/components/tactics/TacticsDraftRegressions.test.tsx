import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamTacticsDraft } from "../../store/types";
import TacticsTab from "./TacticsTab";
import {
  remainingDraftAfterApply,
  saveCustomTactics,
} from "./TacticsCustomTactics.helpers";
import { TACTICS_PRESETS } from "./TacticsTab.helpers";
import { makeGameState } from "./tacticsTestFixtures";

/**
 * Four ways the staged draft went wrong in review. Each one is silent — the
 * screen looks like it worked — which is why they are pinned here rather than
 * left to the happy-path tests.
 */

const squadServiceMocks = vi.hoisted(() => ({
  applyTeamTactics: vi.fn(),
  getSquad: vi.fn(),
  setFormation: vi.fn(),
  setPlayerRole: vi.fn(),
  setPlayStyle: vi.fn(),
  setStartingXi: vi.fn(),
  setTacticsPhase: vi.fn(),
  setTeamMatchRoles: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === "string" ? fallback : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../../services/squadService", () => ({
  applyTeamTactics: squadServiceMocks.applyTeamTactics,
  getSquad: squadServiceMocks.getSquad,
  setFormation: squadServiceMocks.setFormation,
  setPlayerRole: squadServiceMocks.setPlayerRole,
  setPlayStyle: squadServiceMocks.setPlayStyle,
  setStartingXi: squadServiceMocks.setStartingXi,
  setTacticsPhase: squadServiceMocks.setTacticsPhase,
  setTeamMatchRoles: squadServiceMocks.setTeamMatchRoles,
}));

const SENT: TeamTacticsDraft = {
  formation: "4-3-3",
  play_style: "Attacking",
  starting_xi_ids: [],
  slot_roles: [],
  tactics_phase: {
    build_up_style: "Mixed",
    width: "Normal",
    tempo: "Direct",
    defensive_line: "Medium",
    pressing_intensity: "Medium",
    defensive_shape: "Normal",
    marking_style: "Zonal",
    counter_press_duration: "None",
    break_speed: "Medium",
  },
  match_roles: {
    captain: null,
    vice_captain: null,
    penalty_taker: null,
    free_kick_taker: null,
    corner_taker: null,
  },
};

describe("reconciling a draft with an apply that was in flight", () => {
  it("drops what landed and keeps what the manager changed while waiting", () => {
    // The request carried Attacking; midway through, they chose Counter.
    const remaining = remainingDraftAfterApply(
      { formation: "4-3-3", play_style: "Counter" },
      SENT,
    );

    expect(remaining).toEqual({ play_style: "Counter" });
  });

  it("clears the draft when nothing changed during the request", () => {
    expect(
      remainingDraftAfterApply(
        { formation: "4-3-3", play_style: "Attacking" },
        SENT,
      ),
    ).toEqual({});
  });
});

describe("custom tactic storage failures", () => {
  it("reports a refused write instead of swallowing it", () => {
    const rejectingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(
      saveCustomTactics(makeGameState(), [], rejectingStorage),
    ).toBe(false);
  });
});

describe("tactics draft in the screen", () => {
  beforeEach(() => {
    localStorage.clear();
    const gameState = makeGameState();
    Object.values(squadServiceMocks).forEach((mock) => mock.mockReset());
    squadServiceMocks.applyTeamTactics.mockResolvedValue(gameState);
    squadServiceMocks.getSquad.mockResolvedValue(
      gameState.players.filter((player) => player.team_id === "team1"),
    );
    squadServiceMocks.setPlayerRole.mockResolvedValue(gameState);
    squadServiceMocks.setStartingXi.mockResolvedValue(gameState);
    squadServiceMocks.setTacticsPhase.mockResolvedValue(gameState);
    squadServiceMocks.setTeamMatchRoles.mockResolvedValue(gameState);
  });

  /** `Select` is an APG combobox — a button and a listbox, not a native select. */
  function chooseFromSelect(selectName: string, optionName: string) {
    fireEvent.click(screen.getByRole("combobox", { name: selectName }));
    fireEvent.click(screen.getByRole("option", { name: optionName }));
  }

  /** A team playing a shipped preset exactly, blueprint included. */
  function gameStateOnPreset(presetId: string) {
    const preset = TACTICS_PRESETS.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) {
      throw new Error(`unknown preset ${presetId}`);
    }

    const gameState = makeGameState();
    gameState.teams = [
      {
        ...gameState.teams[0],
        formation: preset.formation,
        play_style: preset.playStyle,
        tactics_phase: preset.phaseBlueprint,
        slot_roles: Array.from({ length: 11 }, () => "Standard" as const),
      },
    ];
    return gameState;
  }

  function renderTactics(gameState = makeGameState()) {
    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );
  }

  it("offers Reset as soon as a team already on a preset drifts from it", () => {
    renderTactics(gameStateOnPreset("balanced-control"));

    const reset = screen.getByRole("button", { name: "tactics.resetToPreset" });
    // Nothing has drifted yet, so there is nothing to reset to.
    expect(reset).toBeDisabled();

    chooseFromSelect("tactics.formation", "4-3-3");

    // The team was visibly playing this preset all along. Requiring the manager
    // to reselect it before Reset works is the bug being pinned.
    expect(reset).toBeEnabled();
  });

  it("offers Reset when the applied team has drifted from its preset already", () => {
    // Nothing is staged here at all — the team on the server is playing the
    // preset's shape and style but no longer its blueprint. Reset has to be
    // reachable without the manager first having to change something.
    const gameState = gameStateOnPreset("balanced-control");
    gameState.teams = [
      {
        ...gameState.teams[0],
        tactics_phase: {
          ...TACTICS_PRESETS[0].phaseBlueprint,
          pressing_intensity: "Aggressive",
        },
      },
    ];

    renderTactics(gameState);

    expect(
      screen.getByRole("button", { name: "tactics.resetToPreset" }),
    ).toBeEnabled();
  });

  it("withdraws the selected player's role picker while a shape change is staged", () => {
    renderTactics();

    fireEvent.click(screen.getByTestId("xi-player-m4"));
    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });
    // Step 8b-1 moves the settled-shape role picker from the pitch into the selected player's inspector.
    expect(within(pane).queryAllByRole("combobox")).toHaveLength(1);

    chooseFromSelect("tactics.formation", "4-3-3");

    // A role chosen now would be validated against the formation the server
    // still holds, and then overwritten by the draft's own roles on Apply.
    // Step 8b-1 moves the staged-formation guard with the role picker into the inspector.
    expect(within(pane).queryAllByRole("combobox")).toHaveLength(0);
  });
    function renderWithRoles() {
      const gameState = makeGameState();
      gameState.teams = [
        {
          ...gameState.teams[0],
          match_roles: {
            captain: "d2",
            vice_captain: "d1",
            penalty_taker: "f1",
            free_kick_taker: "m1",
            corner_taker: "m4",
          },
        },
      ];
      squadServiceMocks.getSquad.mockResolvedValue(
        gameState.players.filter((player) => player.team_id === "team1"),
      );
      render(
        <TacticsTab
          gameState={gameState}
          onSelectPlayer={vi.fn()}
          onGameUpdate={vi.fn()}
        />,
      );
      return gameState;
    }

    function sentDraft(): TeamTacticsDraft {
      expect(squadServiceMocks.applyTeamTactics).toHaveBeenCalledTimes(1);
      return squadServiceMocks.applyTeamTactics.mock
        .calls[0]?.[0] as TeamTacticsDraft;
    }

    it("never names a responsibility holder who has left the XI", async () => {
      renderWithRoles();

      // The captain is dropped for a bench player. The backend rejects a draft
      // whose captain is not in the XI it was handed, and it rejects the *whole*
      // draft — so a stale role here quietly makes Apply impossible.
      fireEvent.click(screen.getByTestId("pitch-bench-player-d5"));
      fireEvent.click(screen.getByTestId("xi-player-d2"));
      fireEvent.click(
        screen.getByRole("button", { name: "tactics.confirmSwap" }),
      );
      await waitFor(() => {
        expect(squadServiceMocks.setStartingXi).toHaveBeenCalled();
      });

      chooseFromSelect("tactics.formation", "4-3-3");
      fireEvent.click(
        screen.getByRole("button", { name: "tactics.applyChanges" }),
      );

      await waitFor(() => {
        expect(squadServiceMocks.applyTeamTactics).toHaveBeenCalled();
      });

      const draft = sentDraft();
      const named = Object.values(draft.match_roles).filter(
        (id): id is string => id !== null,
      );

      expect(named.length).toBeGreaterThan(0);
      for (const playerId of named) {
        expect(draft.starting_xi_ids).toContain(playerId);
      }
      expect(draft.match_roles.captain).not.toBe("d2");
    });

    it("sends the XI on the pitch, not the one the server last acknowledged", async () => {
      const deferred: { release?: () => void } = {};
      const gameState = makeGameState();
      squadServiceMocks.setStartingXi.mockImplementation(
        () =>
          new Promise((resolve) => {
            deferred.release = () => resolve(gameState);
          }),
      );
      renderWithRoles();

      fireEvent.click(screen.getByTestId("pitch-bench-player-d5"));
      fireEvent.click(screen.getByTestId("xi-player-d2"));
      fireEvent.click(
        screen.getByRole("button", { name: "tactics.confirmSwap" }),
      );
      await waitFor(() => {
        expect(squadServiceMocks.setStartingXi).toHaveBeenCalled();
      });

      // Apply while the XI write is still out. The draft is total, so an Apply
      // built from the last snapshot would put the dropped player straight back.
      chooseFromSelect("tactics.formation", "4-3-3");
      fireEvent.click(
        screen.getByRole("button", { name: "tactics.applyChanges" }),
      );

      await waitFor(() => {
        expect(squadServiceMocks.applyTeamTactics).toHaveBeenCalled();
      });

      const draft = sentDraft();

      expect(draft.starting_xi_ids).toContain("d5");
      expect(draft.starting_xi_ids).not.toContain("d2");

      deferred.release?.();
    });
});
