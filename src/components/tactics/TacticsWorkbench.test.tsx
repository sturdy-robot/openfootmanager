import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import TacticsTab from "./TacticsTab";
import { makeGameState } from "./tacticsTestFixtures";

/**
 * Step 8a — the tactics screen becomes a workbench.
 *
 * The complaint that started this (#332) was that the screen is crowded: six
 * regions competing at equal weight, a pitch boxed into a third of the width
 * while two permanently-open panels sit beside it, and the whole thing riding
 * one page-long scrollbar.
 *
 * The answer is three panes — squad, board, details — each bounded, with only
 * the two side rails scrolling. The board is the subject and can never be the
 * thing that overflows.
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

function renderWorkbench(gameState: GameStateData = makeGameState()) {
  return render(
    <TacticsTab
      gameState={gameState}
      onSelectPlayer={vi.fn()}
      onGameUpdate={vi.fn()}
    />,
  );
}

/** A squad where one starter is deployed away from his natural position. */
function makeOutOfPositionGameState(): GameStateData {
  const gameState = makeGameState();
  gameState.players = gameState.players.map((player) =>
    player.id === "m4"
      ? { ...player, position: "Striker", natural_position: "Striker" }
      : player,
  );
  return gameState;
}

function scrollingAncestorOf(element: HTMLElement): Element | null {
  return element.closest('[class*="overflow-y-auto"]');
}

describe("tactics workbench layout", () => {
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

  it("presents the squad, the board and the details as three named panes", () => {
    renderWorkbench();

    expect(
      screen.getByRole("region", { name: "tactics.squadPane" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "tactics.startingXI" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "tactics.detailsPane" }),
    ).toBeInTheDocument();
  });

  it("gives the two rails their own scrollbars and never the board", () => {
    renderWorkbench();

    const squad = screen.getByRole("region", { name: "tactics.squadPane" });
    const details = screen.getByRole("region", { name: "tactics.detailsPane" });
    const board = screen.getByRole("region", { name: "tactics.startingXI" });

    // Each rail contains its own scroller — either it is one, or it holds one.
    expect(
      squad.className.includes("overflow-y-auto") ||
        squad.querySelector('[class*="overflow-y-auto"]') !== null,
    ).toBe(true);
    expect(
      details.className.includes("overflow-y-auto") ||
        details.querySelector('[class*="overflow-y-auto"]') !== null,
    ).toBe(true);

    // The board is the subject of the screen. If it is inside a scroller, the
    // pitch is what gets cut off — which is the thing this layout exists to
    // stop happening.
    expect(scrollingAncestorOf(board)).toBeNull();
  });

  it("calls the players who are not starting the available squad", () => {
    renderWorkbench();

    // `TeamData` carries no bench list, so every non-starter is simply
    // available. Calling them substitutes claims a selection nobody made.
    expect(screen.getByText(/tactics\.availableSquad/)).toBeInTheDocument();
    expect(screen.queryByText(/preMatch\.substitutes/)).toBeNull();
  });

  it("keeps the legend and the interaction hints off the resting screen", () => {
    renderWorkbench();

    for (const key of [
      "tactics.pitchInteractionHint",
      "tactics.tableInteractionHint",
      "tactics.naturalFit",
      "tactics.adaptedFit",
    ]) {
      expect(screen.queryByText(key), key).toBeNull();
    }
  });

  it("mentions out-of-position players only when there are some", () => {
    const { unmount } = renderWorkbench();
    expect(screen.queryByText(/squad\.outOfPosition/)).toBeNull();
    unmount();

    renderWorkbench(makeOutOfPositionGameState());
    expect(screen.getByText(/squad\.outOfPosition/)).toBeInTheDocument();
  });
});

describe("tactics workbench responsiveness", () => {
  const source = (() => {
    try {
      return readFileSync("src/components/tactics/TacticsTab.tsx", "utf-8");
    } catch {
      return "";
    }
  })();

  it("sizes the panes against its own container, not the viewport", () => {
    // The workspace is the window minus a sidebar, and `ui_scale` can be
    // xlarge — so a nominally wide window can leave this screen narrow. Only a
    // container query measures the space the panes actually have.
    expect(source).not.toBe("");
    expect(source).toMatch(/@container\/tactics/);
    expect(source).toMatch(/@\w+\/tactics:/);
  });

  it("no longer pins the three columns to a viewport breakpoint", () => {
    expect(source).not.toMatch(/xl:grid-cols-\[260px_1fr_270px\]/);
  });
});
