import { readFileSync } from "node:fs";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import type { TacticsPhaseSettings } from "../../store/types";
import type {
  EnginePlayerData,
  MatchCommand,
  MatchSnapshot,
} from "./types";
import PreMatchSetup from "./PreMatchSetup";

const matchServiceMocks = vi.hoisted(() => ({
  applyMatchCommand: vi.fn(),
  applyMatchTactics: vi.fn(),
  autoSelectSetPieces: vi.fn(),
}));

const squadServiceMocks = vi.hoisted(() => ({
  setPlayerRole: vi.fn(),
  setTacticsPhase: vi.fn(),
}));

vi.mock("../../services/matchService", () => ({
  applyMatchCommand: matchServiceMocks.applyMatchCommand,
  applyMatchTactics: matchServiceMocks.applyMatchTactics,
  autoSelectSetPieces: matchServiceMocks.autoSelectSetPieces,
}));

vi.mock("../../services/squadService", () => ({
  setPlayerRole: squadServiceMocks.setPlayerRole,
  setTacticsPhase: squadServiceMocks.setTacticsPhase,
}));

// Mock the few external dependencies PreMatchSetup pulls in at render time so we
// can exercise the real component tree (the opponent scout panel in particular).
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      if (typeof opts === "string") return opts;
      if (opts && typeof opts === "object" && "defaultValue" in opts) {
        return (opts as { defaultValue: string }).defaultValue;
      }
      return key;
    },
    i18n: { language: "en" },
  }),
}));
vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

function enginePlayer(
  overrides: Partial<EnginePlayerData>,
): EnginePlayerData {
  return {
    id: "p",
    name: "Player",
    position: "Midfielder",
    condition: 100,
    pace: 50,
    stamina: 50,
    strength: 50,
    agility: 50,
    passing: 50,
    shooting: 50,
    tackling: 50,
    dribbling: 50,
    defending: 50,
    positioning: 50,
    vision: 50,
    decisions: 50,
    composure: 50,
    aggression: 50,
    teamwork: 50,
    leadership: 50,
    handling: 50,
    reflexes: 50,
    aerial: 50,
    ovr: 60,
    traits: [],
    role: "Standard",
    ...overrides,
  };
}

const homePlayers = [
  enginePlayer({ id: "h-gk", name: "Home GK", position: "Goalkeeper" }),
  enginePlayer({ id: "h-d1", name: "Home Defender 1", position: "Defender" }),
  enginePlayer({ id: "h-d2", name: "Home Defender 2", position: "Defender" }),
  enginePlayer({ id: "h-d3", name: "Home Defender 3", position: "Defender" }),
  enginePlayer({ id: "h-d4", name: "Home Defender 4", position: "Defender" }),
  enginePlayer({ id: "h-m1", name: "Shape Mid", position: "Midfielder" }),
  enginePlayer({ id: "h-m2", name: "Home Mid 2", position: "Midfielder", condition: 77 }),
  enginePlayer({ id: "h-m3", name: "Home Mid 3", position: "Midfielder" }),
  enginePlayer({ id: "h-m4", name: "Home Mid 4", position: "Midfielder" }),
  enginePlayer({ id: "h-f1", name: "Home Forward 1", position: "Forward" }),
  enginePlayer({ id: "h-f2", name: "Home Forward 2", position: "Forward" }),
];

const benchPlayer = enginePlayer({
  id: "h-b1",
  name: "Bench One",
  position: "Midfielder",
  condition: 91,
});

const awayPlayers = [
  enginePlayer({ id: "a-gk", name: "Away GK", position: "Goalkeeper" }),
  enginePlayer({ id: "a-fw", name: "Away Fwd", position: "Forward" }),
];

const PHASE: TacticsPhaseSettings = {
  build_up_style: "Short",
  width: "Narrow",
  tempo: "Patient",
  defensive_line: "VeryLow",
  pressing_intensity: "Passive",
  defensive_shape: "Stretched",
  marking_style: "Zonal",
  counter_press_duration: "None",
  break_speed: "Slow",
};

const PHASE_TEXT = [
  ["buildUpStyle", "Short"],
  ["width", "Narrow"],
  ["tempo", "Patient"],
  ["defensiveLine", "VeryLow"],
  ["pressingIntensity", "Passive"],
  ["defensiveShape", "Stretched"],
  ["markingStyle", "Zonal"],
  ["counterPressDuration", "None"],
  ["breakSpeed", "Slow"],
] as const;

const homeSetPieces = {
  free_kick_taker: "h-m1",
  corner_taker: "h-m4",
  penalty_taker: "h-f1",
  captain: "h-gk",
};

const emptySetPieces = {
  free_kick_taker: null,
  corner_taker: null,
  penalty_taker: null,
  captain: null,
};

function snapshot(): MatchSnapshot {
  return {
    phase: "PreMatch",
    current_minute: 0,
    home_score: 0,
    away_score: 0,
    possession: "Home",
    ball_zone: "Middle",
    home_team: {
      id: "home1",
      name: "Home FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: homePlayers,
      tactics: PHASE,
    },
    away_team: {
      id: "away1",
      name: "Away FC",
      formation: "4-3-3", // distinct from home, so it only appears in the opponent panel
      play_style: "Counter",
      players: awayPlayers,
    },
    home_bench: [benchPlayer],
    away_bench: [],
    home_possession_pct: 50,
    away_possession_pct: 50,
    events: [],
    home_subs_made: 0,
    away_subs_made: 0,
    max_subs: 5,
    home_set_pieces: homeSetPieces,
    away_set_pieces: emptySetPieces,
    substitutions: [],
    allows_extra_time: false,
    home_yellows: {},
    away_yellows: {},
    sent_off: [],
    revision: 0,
  };
}

function snapshotWithHomeRole(
  current: MatchSnapshot,
  playerId: string,
  role: string,
): MatchSnapshot {
  return {
    ...current,
    home_team: {
      ...current.home_team,
      players: current.home_team.players.map((player) =>
        player.id === playerId ? { ...player, role } : player,
      ),
    },
  };
}

function postSwapSnapshot(current: MatchSnapshot): MatchSnapshot {
  const outgoing = current.home_team.players[7];
  return {
    ...current,
    home_team: {
      ...current.home_team,
      players: current.home_team.players.map((player, index) =>
        index === 7 ? benchPlayer : player,
      ),
    },
    home_bench: [outgoing],
  };
}

function storePlayer(player: EnginePlayerData, naturalPosition = player.position) {
  const attributes = {
    pace: player.pace,
    stamina: player.stamina,
    strength: player.strength,
    agility: player.agility,
    passing: player.passing,
    shooting: player.shooting,
    tackling: player.tackling,
    dribbling: player.dribbling,
    defending: player.defending,
    positioning: player.positioning,
    vision: player.vision,
    decisions: player.decisions,
    composure: player.composure,
    aggression: player.aggression,
    teamwork: player.teamwork,
    leadership: player.leadership,
    handling: player.handling,
    reflexes: player.reflexes,
    aerial: player.aerial,
  };
  return {
    id: player.id,
    match_name: player.name,
    full_name: player.name,
    team_id: "home1",
    position: naturalPosition,
    natural_position: naturalPosition,
    condition: player.condition,
    ovr: player.ovr,
    attributes,
    jersey_number: null,
  };
}

function gameState(): GameStateData {
  return {
    clock: { current_date: "2026-08-01" },
    players: [
      ...homePlayers.map((player) =>
        storePlayer(player, player.id === "h-m1" ? "Striker" : player.position),
      ),
      storePlayer(benchPlayer),
    ],
    teams: [
      {
        id: "home1",
        name: "Home FC",
        short_name: "HOM",
        colors: { primary: "#10b981", secondary: "#1a3a6b" },
        tactics_phase: PHASE,
      },
      {
        id: "away1",
        name: "Away FC",
        short_name: "AWY",
        colors: { primary: "#6366f1", secondary: "#1a3a6b" },
      },
    ],
  } as unknown as GameStateData;
}

function renderSetup({
  initialSnapshot = snapshot(),
  userSide = "Home",
}: {
  initialSnapshot?: MatchSnapshot;
  userSide?: "Home" | "Away";
} = {}) {
  const onUpdateSnapshot = vi.fn();

  function SnapshotHarness() {
    const [current, setCurrent] = useState(initialSnapshot);
    return (
      <PreMatchSetup
        matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
        snapshot={current}
        gameState={gameState()}
        userSide={userSide}
        onStart={vi.fn()}
        onUpdateSnapshot={(next) => {
          onUpdateSnapshot(next);
          setCurrent(next);
        }}
      />
    );
  }

  return { ...render(<SnapshotHarness />), onUpdateSnapshot };
}

function detailsPane(): HTMLElement {
  return screen.getByRole("region", { name: "tactics.detailsPane" });
}

function chooseFromSelect(selectName: string, optionName: string): void {
  fireEvent.click(screen.getByRole("combobox", { name: selectName }));
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

function selectPitchPlayer(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

/**
 * The nearest scrolling ancestor *inside the workbench*.
 *
 * Scoped, because `MatchdayShell`'s frame body is deliberately a scroller —
 * that is how every stage stays readable when its columns collapse, and it is
 * the shell's contract, not pre-match's. Walking past the workbench would make
 * this test fail for a decision another component owns. What it pins is what
 * the layout contract actually says: the board never sits in a pane-level
 * scroller of its own.
 */
function scrollingAncestorOf(element: HTMLElement): Element | null {
  const workbench = element.closest('[class*="@container/prematch"]');
  const scroller = element.closest('[class*="overflow-y-auto"]');

  if (!scroller || !workbench) {
    return scroller;
  }

  return workbench.contains(scroller) ? scroller : null;
}

beforeEach(() => {
  matchServiceMocks.applyMatchCommand.mockReset();
  matchServiceMocks.applyMatchTactics.mockReset();
  matchServiceMocks.autoSelectSetPieces.mockReset();
  squadServiceMocks.setPlayerRole.mockReset();
  squadServiceMocks.setPlayerRole.mockResolvedValue(gameState());
  squadServiceMocks.setTacticsPhase.mockReset();
  squadServiceMocks.setTacticsPhase.mockResolvedValue(gameState());
});

describe("PreMatchSetup opponent scout panel", () => {
  it("scouts the opponent squad on the Opponent tab", () => {
    renderSetup();

    // Default "Your Team" view: opponent players are not listed.
    expect(screen.queryByText("Away Fwd")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Away FC/ }));

    // The opponent scout panel lists the opponent's players by name.
    expect(screen.getByText("Away GK")).toBeTruthy();
    expect(screen.getByText("Away Fwd")).toBeTruthy();
  });
});

describe("pre-match workbench layout", () => {
  const source = (() => {
    try {
      return readFileSync("src/components/match/PreMatchSetup.tsx", "utf-8");
    } catch {
      return "";
    }
  })();

  it("sizes its panes against the pre-match container", () => {
    expect(source).not.toBe("");
    expect(source).toMatch(/@container\/prematch/);
    expect(source).toMatch(/@\w+\/prematch:/);
  });

  it("removes the viewport-pinned three-column breakpoint", () => {
    expect(source).not.toMatch(/xl:grid-cols-\[300px_1fr_320px\]/);
  });

  it("presents the squad, board and details as three named panes", () => {
    renderSetup();

    expect(
      screen.getByRole("region", { name: "tactics.squadPane" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "4-4-2" })).toBeInTheDocument();
    expect(detailsPane()).toBeInTheDocument();
  });

  it("gives both rails independent scrolling while the board owns its column", () => {
    renderSetup();

    const squad = screen.getByRole("region", { name: "tactics.squadPane" });
    const details = detailsPane();
    const board = screen.getByRole("region", { name: "4-4-2" });

    expect(
      squad.className.includes("overflow-y-auto") ||
        squad.querySelector('[class*="overflow-y-auto"]') !== null,
    ).toBe(true);
    expect(
      details.className.includes("overflow-y-auto") ||
        details.querySelector('[class*="overflow-y-auto"]') !== null,
    ).toBe(true);
    expect(scrollingAncestorOf(board)).toBeNull();
  });
});

describe("pre-match contextual inspector", () => {
  it("shows phase and responsibility values as text with no resting editor", () => {
    renderSetup();
    const pane = detailsPane();

    for (const [field, value] of PHASE_TEXT) {
      expect(
        within(pane).getByText(`tactics.phaseSettings.${field}`),
      ).toBeInTheDocument();
      expect(
        within(pane).getByText(`tactics.phaseSettings.${field}_${value}`),
      ).toBeInTheDocument();
    }
    for (const playerName of [
      "Home GK",
      "Home Forward 1",
      "Shape Mid",
      "Home Mid 4",
    ]) {
      expect(within(pane).getByText(playerName)).toBeInTheDocument();
      expect(
        within(pane)
          .getByText(playerName)
          .closest("button, input, select, [role='combobox']"),
      ).toBeNull();
    }
    expect(within(pane).queryAllByRole("combobox")).toEqual([]);
  });

  it("keeps each editor one named Adjust action behind the read view", () => {
    renderSetup();
    const pane = detailsPane();
    const instructionAdjust = within(pane).getByRole("button", {
      name: "tactics.adjust tactics.teamInstructions",
    });
    const responsibilityAdjust = within(pane).getByRole("button", {
      name: "tactics.adjust tactics.responsibilities",
    });

    fireEvent.click(instructionAdjust);
    expect(within(pane).getAllByRole("combobox")).toHaveLength(9);
    fireEvent.click(
      within(pane).getByRole("button", {
        name: "tactics.done tactics.teamInstructions",
      }),
    );
    expect(within(pane).queryAllByRole("combobox")).toEqual([]);

    fireEvent.click(responsibilityAdjust);
    expect(within(pane).getAllByRole("combobox")).toHaveLength(4);
  });

  it("replaces the resting cards with selected-player facts, role and swap", () => {
    renderSetup();
    selectPitchPlayer("Shape Mid");
    const pane = detailsPane();

    expect(within(pane).getByText("Shape Mid")).toBeInTheDocument();
    expect(within(pane).getByText("tactics.deployedSlot")).toBeInTheDocument();
    expect(within(pane).getByText("Left Midfielder")).toBeInTheDocument();
    expect(within(pane).getByText("tactics.naturalPosition")).toBeInTheDocument();
    expect(within(pane).getByText("Striker")).toBeInTheDocument();
    expect(within(pane).getByText("common.condition")).toBeInTheDocument();
    expect(within(pane).getByText("100%")).toBeInTheDocument();
    expect(
      within(pane).getByRole("combobox", {
        name: "tactics.playerRoleLabel",
      }),
    ).toBeInTheDocument();
    expect(
      within(pane).getByRole("button", { name: /Bench One/ }),
    ).toBeInTheDocument();
  });

  it("dispatches a bench swap from the selected player's pane", async () => {
    const initial = snapshot();
    const swapped = postSwapSnapshot(initial);
    matchServiceMocks.applyMatchCommand.mockResolvedValue(swapped);
    renderSetup({ initialSnapshot: initial });

    selectPitchPlayer("Home Mid 3");
    fireEvent.click(
      within(detailsPane()).getByRole("button", { name: /Bench One/ }),
    );

    await waitFor(() => {
      expect(matchServiceMocks.applyMatchCommand).toHaveBeenCalledWith({
        PreMatchSwap: {
          side: "Home",
          player_off_id: "h-m3",
          player_on_id: "h-b1",
        },
      });
    });
  });
});

describe("pre-match player roles reach the running match", () => {
  it("dispatches an unchanged-XI role and renders the acknowledged snapshot", async () => {
    const initial = snapshot();
    const acknowledged = snapshotWithHomeRole(initial, "h-m2", "Carrilero");
    matchServiceMocks.applyMatchCommand.mockResolvedValue(acknowledged);
    const { onUpdateSnapshot } = renderSetup({ initialSnapshot: initial });

    selectPitchPlayer("Home Mid 2");
    chooseFromSelect("tactics.playerRoleLabel", "BoxToBox");

    await waitFor(() => {
      expect(matchServiceMocks.applyMatchCommand).toHaveBeenCalledWith({
        ChangePlayerRole: {
          side: "Home",
          player_id: "h-m2",
          role: "BoxToBox",
        },
      });
    });
    // Pre-match edits the live match only; saved defaults remain the tactics screen's job.
    expect(squadServiceMocks.setPlayerRole).not.toHaveBeenCalled();
    expect(onUpdateSnapshot).toHaveBeenCalledWith(acknowledged);
    expect(
      screen.getByRole("combobox", { name: "tactics.playerRoleLabel" }),
    ).toHaveTextContent("Carrilero");
  });

  it("uses the changed formation's deployed slot roles and still dispatches", async () => {
    const initial = snapshot();
    const changedFormation: MatchSnapshot = {
      ...initial,
      home_team: { ...initial.home_team, formation: "4-3-3" },
    };
    const acknowledged = snapshotWithHomeRole(
      changedFormation,
      "h-m1",
      "DeepLyingPlaymaker",
    );
    matchServiceMocks.applyMatchCommand.mockImplementation(
      async (command: MatchCommand) =>
        "ChangeFormation" in command ? changedFormation : acknowledged,
    );
    const { onUpdateSnapshot } = renderSetup({ initialSnapshot: initial });

    chooseFromSelect("tactics.formation", "4-3-3");
    await waitFor(() => {
      expect(onUpdateSnapshot).toHaveBeenCalledWith(changedFormation);
    });

    selectPitchPlayer("Shape Mid");
    const rolePicker = screen.getByRole("combobox", {
      name: "tactics.playerRoleLabel",
    });
    fireEvent.click(rolePicker);
    const roleOptions = screen
      .getAllByRole("option")
      .map((option) => option.textContent);

    // Slot 5 changes from LeftMidfielder to DefensiveMidfielder in 4-3-3;
    // the player's natural Striker position must not leak into this option set.
    expect(roleOptions).toContain("AnchorMan");
    expect(roleOptions).not.toContain("InsideForward");
    expect(roleOptions).not.toContain("Poacher");
    fireEvent.click(screen.getByRole("option", { name: "AnchorMan" }));

    await waitFor(() => {
      expect(matchServiceMocks.applyMatchCommand).toHaveBeenNthCalledWith(2, {
        ChangePlayerRole: {
          side: "Home",
          player_id: "h-m1",
          role: "AnchorMan",
        },
      });
    });
  });

  it("lets an incoming player in a PreMatchSwap snapshot receive a role", async () => {
    const swapped = postSwapSnapshot(snapshot());
    const acknowledged = snapshotWithHomeRole(swapped, "h-b1", "BoxToBox");
    matchServiceMocks.applyMatchCommand.mockResolvedValue(acknowledged);
    const { onUpdateSnapshot } = renderSetup({ initialSnapshot: swapped });

    // The fixture starts from the authoritative snapshot returned by PreMatchSwap:
    // the incoming player occupies slot 7 but is absent from the saved XI.
    selectPitchPlayer("Bench One");
    chooseFromSelect("tactics.playerRoleLabel", "Carrilero");

    await waitFor(() => {
      expect(matchServiceMocks.applyMatchCommand).toHaveBeenCalledWith({
        ChangePlayerRole: {
          side: "Home",
          player_id: "h-b1",
          role: "Carrilero",
        },
      });
    });
    expect(squadServiceMocks.setPlayerRole).not.toHaveBeenCalled();
    expect(onUpdateSnapshot).toHaveBeenCalledWith(acknowledged);
  });
});

describe("pre-match commands answer to the match, one at a time", () => {
  it("sends a team instruction to the match rather than to the saved team", async () => {
    const initial = snapshot();
    const acknowledged: MatchSnapshot = {
      ...initial,
      home_team: {
        ...initial.home_team,
        tactics: { ...PHASE, build_up_style: "Long" },
      },
    };
    matchServiceMocks.applyMatchTactics.mockResolvedValue(acknowledged);
    const { onUpdateSnapshot } = renderSetup({ initialSnapshot: initial });

    fireEvent.click(
      within(detailsPane()).getByRole("button", {
        name: "tactics.adjust tactics.teamInstructions",
      }),
    );
    chooseFromSelect("tactics.phaseSettings.buildUpStyle", "tactics.phaseSettings.buildUpStyle_Long");

    await waitFor(() => {
      expect(matchServiceMocks.applyMatchTactics).toHaveBeenCalledTimes(1);
    });

    const sent = matchServiceMocks.applyMatchTactics.mock.calls[0]?.[0] as {
      lineup_changes: unknown[];
      side: string;
      tactics: { build_up_style: string };
    };

    expect(sent.side).toBe("Home");
    expect(sent.tactics.build_up_style).toBe("Long");
    // Nothing else is being changed here, and an empty list is what keeps a
    // dial off the substitution budget.
    expect(sent.lineup_changes).toEqual([]);
    // The engine copied the saved phase when the match was built, so writing
    // the saved team would change a default and leave this match alone.
    expect(squadServiceMocks.setTacticsPhase).not.toHaveBeenCalled();
    expect(onUpdateSnapshot).toHaveBeenCalledWith(acknowledged);
  });

  it("will not let a role be chosen against a shape that is still in flight", async () => {
    const initial = snapshot();
    const deferred: { release?: () => void } = {};
    matchServiceMocks.applyMatchCommand.mockImplementation(
      () =>
        new Promise((resolve) => {
          deferred.release = () => resolve(initial);
        }),
    );
    renderSetup({ initialSnapshot: initial });

    selectPitchPlayer("Home Mid 2");
    chooseFromSelect("tactics.formation", "4-3-3");

    await waitFor(() => {
      expect(matchServiceMocks.applyMatchCommand).toHaveBeenCalledTimes(1);
    });

    // The pitch is still drawing the old shape. A role chosen now is a role
    // for a slot that may not survive — and whichever command reaches the
    // engine second, the mismatch is discarded in silence.
    expect(
      screen.getByRole("combobox", { name: "tactics.playerRoleLabel" }),
    ).toBeDisabled();
    expect(matchServiceMocks.applyMatchCommand).toHaveBeenCalledTimes(1);

    deferred.release?.();
  });

  it("keeps the player selected and says so when a swap is refused", async () => {
    matchServiceMocks.applyMatchCommand.mockRejectedValue(new Error("refused"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    renderSetup();

    selectPitchPlayer("Home Mid 3");
    fireEvent.click(
      within(detailsPane()).getByRole("button", { name: /Bench One/ }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "match.swapRejected",
      );
    });

    // The pane stays open on the player the manager was working with. Closing
    // it took away the context and the focus that was inside it, and left them
    // to find the player again to try a second time.
    expect(
      within(detailsPane()).getByText("Home Mid 3"),
    ).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
