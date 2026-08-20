import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import type {
  TacticsPhaseSettings,
  TeamMatchRolesData,
} from "../../store/types";
import TacticsTab from "./TacticsTab";
import { makeGameState } from "./tacticsTestFixtures";

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
    t: (key: string, options?: string | Record<string, unknown>) => {
      if (key === "pitchToken.accessibleName") {
        const values = options as Record<string, unknown> | undefined;
        return `${String(values?.name)} · ${String(values?.condition)} · ${String(values?.fit)}`;
      }
      if (key === "pitchToken.conditionValue") {
        const values = options as Record<string, unknown> | undefined;
        return `Condition ${String(values?.condition)}%`;
      }
      return key;
    },
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

const STARTING_XI_IDS = [
  "gk1",
  "d1",
  "d2",
  "d3",
  "d4",
  "m1",
  "m2",
  "m3",
  "m4",
  "f1",
  "f2",
] as const;

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

const MATCH_ROLES: TeamMatchRolesData = {
  captain: "gk1",
  vice_captain: "d1",
  penalty_taker: "f1",
  free_kick_taker: "m1",
  corner_taker: "m4",
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

const RESPONSIBILITY_TEXT = [
  ["preMatch.captain", "GK1"],
  ["tactics.viceCaptain", "D1"],
  ["preMatch.penaltyTaker", "F1"],
  ["preMatch.freeKickTaker", "M1"],
  ["preMatch.cornerTaker", "M4"],
] as const;

function makeInspectorGameState(): GameStateData {
  const gameState = makeGameState();
  const team = gameState.teams[0];
  if (!team) {
    throw new Error("tactics fixture must provide the managed team");
  }

  gameState.players = gameState.players.map((player) =>
    player.id === "m4"
      ? { ...player, position: "Striker", natural_position: "Striker" }
      : player,
  );
  gameState.teams = [
    {
      ...team,
      match_roles: MATCH_ROLES,
      slot_roles: STARTING_XI_IDS.map(() => "Standard" as const),
      tactics_phase: PHASE,
    },
  ];
  return gameState;
}

function renderTactics(gameState: GameStateData = makeInspectorGameState()) {
  const onSelectPlayer = vi.fn();
  render(
    <TacticsTab
      gameState={gameState}
      onGameUpdate={vi.fn()}
      onSelectPlayer={onSelectPlayer}
    />,
  );
  return { onSelectPlayer };
}

function inspector(): HTMLElement {
  return screen.getByRole("region", { name: "tactics.detailsPane" });
}

function pitchPlayer(playerId: string): HTMLElement {
  return screen.getByRole("button", {
    name: new RegExp(`^${playerId.toUpperCase()} · `),
  });
}

const SECTION_TITLE_KEYS = [
  "tactics.teamInstructions",
  "tactics.responsibilities",
] as const;

/**
 * Open one section's editor, addressing it the way a screen reader user would.
 * Both controls say "Adjust"; only the section they name tells them apart.
 */
function openEditor(index: 0 | 1): HTMLElement {
  const pane = inspector();
  for (const titleKey of SECTION_TITLE_KEYS) {
    expect(
      within(pane).getByRole("button", { name: `tactics.adjust ${titleKey}` }),
    ).toBeInTheDocument();
  }
  fireEvent.click(
    within(pane).getByRole("button", {
      name: `tactics.adjust ${SECTION_TITLE_KEYS[index]}`,
    }),
  );
  return pane;
}

function doneControl(pane: HTMLElement, index: 0 | 1): HTMLElement {
  return within(pane).getByRole("button", {
    name: `tactics.done ${SECTION_TITLE_KEYS[index]}`,
  });
}

function responsibilityEditor(
  pane: HTMLElement,
  label: string,
): HTMLElement | null {
  const combobox = within(pane).queryByRole("combobox", { name: label });
  if (combobox) {
    return combobox;
  }

  return within(pane).queryByRole("button", {
    name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  });
}

describe("Tactics contextual inspector", () => {
  beforeEach(() => {
    localStorage.clear();
    const gameState = makeInspectorGameState();
    Object.values(squadServiceMocks).forEach((mock) => {
      mock.mockReset();
    });
    squadServiceMocks.applyTeamTactics.mockResolvedValue(gameState);
    squadServiceMocks.getSquad.mockResolvedValue(
      gameState.players.filter((player) => player.team_id === "team1"),
    );
    squadServiceMocks.setFormation.mockResolvedValue(gameState);
    squadServiceMocks.setPlayerRole.mockResolvedValue(gameState);
    squadServiceMocks.setPlayStyle.mockResolvedValue(gameState);
    squadServiceMocks.setStartingXi.mockResolvedValue(gameState);
    squadServiceMocks.setTacticsPhase.mockResolvedValue(gameState);
    squadServiceMocks.setTeamMatchRoles.mockResolvedValue(gameState);
  });

  describe("with no player selected", () => {
    it("keeps the named details pane and explains its resting context", () => {
      renderTactics();

      expect(
        within(inspector()).getByText("tactics.nothingSelectedHint"),
      ).toBeInTheDocument();
    });

    it("shows every phase and responsibility as text with no combobox at rest", () => {
      renderTactics();
      const pane = inspector();

      for (const [field, value] of PHASE_TEXT) {
        expect(
          within(pane).getByText(`tactics.phaseSettings.${field}`),
        ).toBeInTheDocument();
        expect(
          within(pane).getByText(`tactics.phaseSettings.${field}_${value}`),
        ).toBeInTheDocument();
      }
      for (const [label, playerName] of RESPONSIBILITY_TEXT) {
        expect(within(pane).getByText(label)).toBeInTheDocument();
        expect(within(pane).getByText(playerName)).toBeInTheDocument();
      }

      expect(within(pane).queryAllByRole("combobox")).toEqual([]);
      expect(
        within(pane).getByText("tactics.teamInstructions"),
      ).toBeInTheDocument();
      expect(
        within(pane).getByText("tactics.responsibilities"),
      ).toBeInTheDocument();
      for (const [, playerName] of RESPONSIBILITY_TEXT) {
        expect(
          within(pane)
            .getByText(playerName)
            .closest("button, input, select, [role='combobox']"),
        ).toBeNull();
      }
    });

    it("edits only team instructions and returns to their read view", () => {
      renderTactics();
      const pane = openEditor(0);

      expect(within(pane).getAllByRole("combobox")).toHaveLength(9);
      for (const [label] of RESPONSIBILITY_TEXT) {
        expect(responsibilityEditor(pane, label)).toBeNull();
      }

      fireEvent.click(doneControl(pane, 0));
      expect(within(pane).queryAllByRole("combobox")).toEqual([]);
    });

    it("edits only responsibilities and returns to their read view", () => {
      renderTactics();
      const pane = openEditor(1);

      for (const [label] of RESPONSIBILITY_TEXT) {
        expect(responsibilityEditor(pane, label), label).not.toBeNull();
      }
      for (const [, value] of PHASE_TEXT) {
        for (const combobox of within(pane).queryAllByRole("combobox")) {
          expect(combobox).not.toHaveTextContent(
            new RegExp(`tactics\\.phaseSettings\\..*_${value}$`),
          );
        }
      }

      fireEvent.click(doneControl(pane, 1));
      for (const [label] of RESPONSIBILITY_TEXT) {
        expect(responsibilityEditor(pane, label), label).toBeNull();
      }
    });

    it("keeps phase edits staged until Apply", async () => {
      renderTactics();
      const pane = openEditor(0);
      const buildUpStyle = within(pane).getAllByRole("combobox")[0];

      fireEvent.click(buildUpStyle);
      fireEvent.click(
        screen.getByRole("option", {
          name: "tactics.phaseSettings.buildUpStyle_Long",
        }),
      );

      expect(squadServiceMocks.setTacticsPhase).not.toHaveBeenCalled();
      expect(squadServiceMocks.applyTeamTactics).not.toHaveBeenCalled();

      fireEvent.click(
        screen.getByRole("button", { name: "tactics.applyChanges" }),
      );
      await waitFor(() => {
        expect(squadServiceMocks.applyTeamTactics).toHaveBeenCalledWith(
          expect.objectContaining({
            tactics_phase: expect.objectContaining({
              build_up_style: "Long",
            }),
          }),
        );
      });
    });

    it("persists a responsibility immediately without staging it", async () => {
      renderTactics();
      const pane = openEditor(1);
      const captain = responsibilityEditor(pane, "preMatch.captain");
      expect(captain, "captain editor must be reachable").not.toBeNull();
      fireEvent.click(captain as HTMLElement);

      const option =
        screen.queryByRole("option", { name: /D2/ }) ??
        within(pane)
          .getAllByRole("button")
          .find((button) => button.textContent?.trim().startsWith("D2"));
      expect(option, "D2 must be offered for captain").toBeDefined();
      fireEvent.click(option as HTMLElement);

      await waitFor(() => {
        expect(squadServiceMocks.setTeamMatchRoles).toHaveBeenCalledWith(
          expect.objectContaining({ captain: "d2" }),
        );
      });
      expect(squadServiceMocks.applyTeamTactics).not.toHaveBeenCalled();
      expect(squadServiceMocks.setTacticsPhase).not.toHaveBeenCalled();
    });
  });

  describe("with one player selected", () => {
    it("states the deployed slot separately from the immutable natural position", () => {
      renderTactics();
      fireEvent.click(pitchPlayer("m4"));
      const pane = inspector();

      expect(within(pane).getByText("Player m4")).toBeInTheDocument();
      expect(
        within(pane).getByText("tactics.deployedSlot"),
      ).toBeInTheDocument();
      expect(
        within(pane).getByText("common.positions.RightMidfielder"),
      ).toBeInTheDocument();
      expect(
        within(pane).getByText("tactics.naturalPosition"),
      ).toBeInTheDocument();
      expect(
        within(pane).getByText("common.positions.Striker"),
      ).toBeInTheDocument();
    });

    it("offers and persists roles for the deployed slot rather than the natural position", async () => {
      renderTactics();
      fireEvent.click(pitchPlayer("m4"));
      const pane = inspector();

      expect(within(pane).getAllByRole("combobox")).toHaveLength(1);
      fireEvent.click(within(pane).getByRole("combobox"));
      expect(
        screen.getByRole("option", {
          name: "tactics.playerRoles.InvertedWinger",
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("option", { name: "tactics.playerRoles.Poacher" }),
      ).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("option", {
          name: "tactics.playerRoles.InvertedWinger",
        }),
      );
      await waitFor(() => {
        expect(squadServiceMocks.setPlayerRole).toHaveBeenCalledWith(
          "m4",
          "InvertedWinger",
        );
      });
    });

    it("removes the role picker while a different formation is staged", () => {
      renderTactics();
      fireEvent.click(pitchPlayer("m4"));
      const pane = inspector();

      expect(within(pane).getAllByRole("combobox")).toHaveLength(1);
      fireEvent.click(
        screen.getByRole("combobox", { name: "tactics.formation" }),
      );
      fireEvent.click(screen.getByRole("option", { name: "4-3-3" }));

      expect(within(pane).queryAllByRole("combobox")).toEqual([]);
    });

    it("withholds the role picker while the XI on screen is only a suggestion", () => {
      // With nothing saved, the board draws a best-guess XI. `set_player_role`
      // validates against the stored list and refuses a player who is not in
      // it, so a picker here would be a control that silently cannot work.
      const gameState = makeInspectorGameState();
      gameState.teams = [{ ...gameState.teams[0], starting_xi_ids: [] }];
      renderTactics(gameState);

      fireEvent.click(pitchPlayer("m4"));

      expect(within(inspector()).queryAllByRole("combobox")).toEqual([]);
      expect(
        within(inspector()).getByText("tactics.deployedSlot"),
      ).toBeInTheDocument();
    });

    it("shows condition and the existing focus panel's key attribute groups", () => {
      renderTactics();
      fireEvent.click(pitchPlayer("d1"));
      const pane = inspector();

      expect(within(pane).getByText("common.condition")).toBeInTheDocument();
      expect(within(pane).getByText("100%")).toBeInTheDocument();
      for (const attribute of ["pace", "tackling", "vision"] as const) {
        expect(
          within(pane).getByText(`common.attributes.${attribute}`),
        ).toBeInTheDocument();
      }
    });

    it("calls through from Assign best fit", async () => {
      renderTactics();
      fireEvent.click(pitchPlayer("m4"));
      const pane = inspector();

      fireEvent.click(
        within(pane).getByRole("button", { name: "tactics.assignBestFit" }),
      );

      await waitFor(() => {
        expect(squadServiceMocks.setStartingXi).toHaveBeenCalledTimes(1);
      });
      expect(squadServiceMocks.setStartingXi.mock.calls[0]?.[0]).toContain(
        "m4",
      );
    });

    it("calls through from Open profile", () => {
      const { onSelectPlayer } = renderTactics();
      fireEvent.click(pitchPlayer("m4"));

      fireEvent.click(
        within(inspector()).getByRole("button", {
          name: "tactics.openProfile",
        }),
      );

      expect(onSelectPlayer).toHaveBeenCalledWith("m4");
    });
  });

  describe("with two players selected", () => {
    it("renders the comparison inside the named details pane", () => {
      renderTactics();
      fireEvent.click(pitchPlayer("d1"));
      fireEvent.click(pitchPlayer("m1"));
      const pane = inspector();

      expect(
        within(pane).getByText("tactics.comparePlayer"),
      ).toBeInTheDocument();
      expect(within(pane).getByText("Player d1")).toBeInTheDocument();
      expect(within(pane).getByText("Player m1")).toBeInTheDocument();
    });

    it("does not reintroduce the comparison backdrop", () => {
      renderTactics();
      fireEvent.click(pitchPlayer("d1"));
      fireEvent.click(pitchPlayer("m1"));

      expect(document.querySelector(".fixed.inset-0.z-40")).toBeNull();
    });

    it("confirms a legal swap from inside the pane", async () => {
      renderTactics();
      fireEvent.click(pitchPlayer("d1"));
      fireEvent.click(pitchPlayer("d2"));
      const pane = inspector();

      fireEvent.click(
        within(pane).getByRole("button", { name: "tactics.confirmSwap" }),
      );

      await waitFor(() => {
        expect(squadServiceMocks.setStartingXi).toHaveBeenCalledWith([
          "gk1",
          "d2",
          "d1",
          "d3",
          "d4",
          "m1",
          "m2",
          "m3",
          "m4",
          "f1",
          "f2",
        ]);
      });
    });

    it("keeps confirmation unavailable for an illegal swap", () => {
      const gameState = makeInspectorGameState();
      gameState.players = gameState.players.map((player) =>
        player.id === "d5"
          ? {
              ...player,
              injury: { name: "Hamstring strain", days_remaining: 7 },
            }
          : player,
      );
      squadServiceMocks.getSquad.mockResolvedValue(
        gameState.players.filter((player) => player.team_id === "team1"),
      );
      renderTactics(gameState);

      fireEvent.click(screen.getByTestId("pitch-bench-player-d5"));
      fireEvent.click(pitchPlayer("d2"));

      expect(
        within(inspector()).getByRole("button", {
          name: "tactics.confirmSwap",
        }),
      ).toBeDisabled();
    });
  });

  it("uses real pitch-slot buttons with no nested focusable control", () => {
    renderTactics();
    const board = screen.getByRole("region", { name: "tactics.startingXI" });

    const slots = STARTING_XI_IDS.map((playerId) =>
      within(board).getByRole("button", {
        name: new RegExp(`^${playerId.toUpperCase()} · `),
      }),
    );
    expect(slots).toHaveLength(11);
    for (const slot of slots) {
      expect(slot.tagName).toBe("BUTTON");
      expect(
        slot.querySelector("button, input, select, [tabindex]"),
      ).toBeNull();
    }
  });
});
