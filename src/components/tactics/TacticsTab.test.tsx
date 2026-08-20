import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameStateData } from "../../store/gameStore";
import TacticsTab from "./TacticsTab";
import {
  makeGameState,
  makePlayer,
  makeTeam,
} from "./tacticsTestFixtures";

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
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (key === "pitchToken.accessibleName") {
        const options = fallback as Record<string, unknown> | undefined;
        return `${String(options?.name)} · ${String(options?.condition)} · ${String(options?.fit)}`;
      }
      if (key === "pitchToken.conditionValue") {
        const options = fallback as Record<string, unknown> | undefined;
        return `Condition ${String(options?.condition)}%`;
      }
      if (key === "playerProfile.daysRemaining") {
        return `${String((fallback as Record<string, unknown> | undefined)?.count ?? "")} days remaining`;
      }
      if (key === "playerProfile.injuryDaysShort") {
        return `${String((fallback as Record<string, unknown> | undefined)?.count ?? "")}d`;
      }
      if (key.startsWith("common.injuries.")) {
        return String((fallback as Record<string, unknown> | undefined)?.defaultValue ?? key);
      }
      return typeof fallback === "string" ? fallback : key;
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

const createDataTransfer = () => {
  const data = new Map<string, string>();
  return {
    effectAllowed: "move",
    dropEffect: "move",
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
    getData: (type: string) => data.get(type) ?? "",
  };
};

/**
 * The pitch slot holding a given player.
 *
 * The shared board names each slot from the token inside it, so this finds the
 * control by its accessible name — `match_name` is the uppercased id.
 */
function pitchPlayer(playerId: string): HTMLElement {
  return screen.getByRole("button", {
    name: new RegExp(`^${playerId.toUpperCase()} · `),
  });
}

describe("TacticsTab", () => {
  beforeEach(() => {
    localStorage.clear();
    const defaultGameState = makeGameState();
    const defaultRoster = defaultGameState.players.filter(
      (p) => p.team_id === "team1",
    );
    Object.values(squadServiceMocks).forEach((mock) => mock.mockReset());
    squadServiceMocks.applyTeamTactics.mockResolvedValue(defaultGameState);
    squadServiceMocks.getSquad.mockResolvedValue(defaultRoster);
    squadServiceMocks.setFormation.mockResolvedValue(defaultGameState);
    squadServiceMocks.setPlayerRole.mockResolvedValue(defaultGameState);
    squadServiceMocks.setPlayStyle.mockResolvedValue(defaultGameState);
    squadServiceMocks.setStartingXi.mockResolvedValue(defaultGameState);
    squadServiceMocks.setTacticsPhase.mockResolvedValue(defaultGameState);
    squadServiceMocks.setTeamMatchRoles.mockResolvedValue(defaultGameState);
  });

  it("renders the top tactical controls plus bench player in the left panel", () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("tactics.presetTactics")).toBeInTheDocument();
    expect(screen.getByText("tactics.formation")).toBeInTheDocument();
    expect(screen.getByText("tactics.playStyle")).toBeInTheDocument();
    expect(screen.getAllByText(/preMatch\.substitutes/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByTestId("bench-player-d5")).toBeInTheDocument();
    expect(screen.getByTestId("pitch-bench-player-d5")).toBeInTheDocument();
  });

  it("shows the compact tactics toolbar across the top of the lineup workspace", () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("tactics.presetTactics")).toBeInTheDocument();
    expect(screen.getByText("tactics.activePreset")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tactics.chooseTactic" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "tactics.formation" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "tactics.playStyle" })).toBeInTheDocument();
  });

  it("falls back to a custom current setup when no preset matches the active tactic", () => {
    const gameState = makeGameState();
    gameState.teams = [
      makeTeam({
        formation: "4-4-2",
        play_style: "Counter",
        starting_xi_ids: [
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
        ],
      }),
    ];

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "tactics.chooseTactic" }),
    ).toHaveTextContent("tactics.customTactic");
    expect(
      screen.getByRole("button", { name: "tactics.chooseTactic" }),
    ).not.toHaveTextContent("balanced-control");
  });

  it("stages a preset locally and applies it as a single change", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.chooseTactic" }),
    );
    fireEvent.click(screen.getByRole("option", { name: /high-press/i }));

    // Choosing a tactic is a decision, not a save. Nothing may reach the
    // backend until the manager says so.
    expect(squadServiceMocks.applyTeamTactics).not.toHaveBeenCalled();
    expect(squadServiceMocks.setFormation).not.toHaveBeenCalled();
    expect(squadServiceMocks.setPlayStyle).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.applyChanges" }),
    );

    await waitFor(() => {
      expect(squadServiceMocks.applyTeamTactics).toHaveBeenCalledTimes(1);
    });
    expect(squadServiceMocks.applyTeamTactics.mock.calls[0]?.[0]).toMatchObject({
      formation: "3-4-3",
      play_style: "HighPress",
    });
  });

  it("shows injured bench players with injury details in the left panel", () => {
    const gameState = makeGameState();
    const injuredBenchPlayer = gameState.players.find(
      (player) => player.id === "d5",
    );
    if (injuredBenchPlayer) {
      injuredBenchPlayer.injury = {
        name: "Ankle sprain",
        days_remaining: 6,
      };
    }

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Ankle sprain")).toBeInTheDocument();
    expect(screen.getByText("6d")).toBeInTheDocument();
  });

  it("keeps youth academy players out of first-team tactics selection", async () => {
    const gameState = makeGameState();
    gameState.players.push(
      makePlayer("y1", "Forward", {
        full_name: "Academy Prospect",
        squad_role: "Youth",
      }),
    );
    // Override so get_squad returns the full roster including the youth player,
    // exercising the client-side isSeniorSquadPlayer filter.
    squadServiceMocks.getSquad.mockResolvedValue(
      gameState.players.filter((p) => p.team_id === "team1"),
    );

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Academy Prospect")).not.toBeInTheDocument();
    });
  });

  it("sends the correct starting xi order when a pitch-view bench defender is dropped onto a defensive slot", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    const benchPlayer = screen.getByTestId("pitch-bench-player-d5");
    const pitchSlot = pitchPlayer("d1");
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(benchPlayer, { dataTransfer });
    fireEvent.drop(pitchSlot, { dataTransfer });

    await waitFor(() => {
      expect(squadServiceMocks.setStartingXi).toHaveBeenCalledWith([
          "gk1",
          "d5",
          "d2",
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

  it("does not render drag handles in the lineup tables", () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(
      screen.queryByTestId("bench-player-drag-handle-d5"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("xi-player-drag-handle-d1"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("pitch-bench-player-d5")).toHaveAttribute(
      "draggable",
      "true",
    );
  });

  it("shows a bench player's natural position on the pitch bench cards when it differs from position", async () => {
    const gameState = makeGameState();
    gameState.players = gameState.players.map((player) =>
      player.id === "d5"
        ? {
          ...player,
          position: "Midfielder",
          natural_position: "Defender",
        }
        : player,
    );
    // Override so get_squad returns the modified players (d5 with Midfielder
    // position), ensuring the natural position display is tested post-fetch.
    squadServiceMocks.getSquad.mockResolvedValue(
      gameState.players.filter((p) => p.team_id === "team1"),
    );

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    const benchCard = await screen.findByTestId("pitch-bench-player-d5");

    expect(
      within(benchCard).getByText("common.posAbbr.Defender"),
    ).toBeInTheDocument();
    expect(
      within(benchCard).queryByText("common.posAbbr.Midfielder"),
    ).not.toBeInTheDocument();
  });

  it("can duplicate the current setup into a custom tactic shell", () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.duplicateTactic" }),
    );

    expect(
      screen.getByRole("button", { name: "tactics.updateTactic" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "tactics.chooseTactic" }),
    );
    expect(screen.getByRole("option", { name: /tactics.copyOfTactic/i })).toBeInTheDocument();
  });

  it("persists custom tactics across remounts", () => {
    const gameState = makeGameState();
    const { unmount } = render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.duplicateTactic" }),
    );

    unmount();

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.chooseTactic" }),
    );

    expect(
      screen.getByRole("option", { name: /tactics.copyOfTactic/i }),
    ).toBeInTheDocument();
  });

  it("does not leak custom tactics across manager or team storage scopes", () => {
    const originalState = makeGameState();
    const otherState = makeGameState();
    otherState.clock.start_date = "2026-09-01";
    otherState.manager.id = "mgr2";
    otherState.manager.team_id = "team2";
    otherState.teams = [makeTeam({ id: "team2", manager_id: "mgr2" })];
    otherState.players = otherState.players.map((player) => ({
      ...player,
      team_id: "team2",
    }));

    const { unmount } = render(
      <TacticsTab
        gameState={originalState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.duplicateTactic" }),
    );

    unmount();

    const secondRender = render(
      <TacticsTab
        gameState={otherState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.chooseTactic" }),
    );

    expect(
      screen.queryByRole("option", { name: /tactics.copyOfTactic/i }),
    ).not.toBeInTheDocument();

    secondRender.unmount();

    render(
      <TacticsTab
        gameState={originalState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.chooseTactic" }),
    );

    expect(
      screen.getByRole("option", { name: /tactics.copyOfTactic/i }),
    ).toBeInTheDocument();
  }, 15000);

  it("keeps a rejected draft staged so it can be applied again", async () => {
    const gameState = makeGameState();
    squadServiceMocks.applyTeamTactics.mockRejectedValue(new Error("boom"));
    squadServiceMocks.getSquad.mockResolvedValue(
      gameState.players.filter((p) => p.team_id === "team1"),
    );

    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.chooseTactic" }),
    );
    fireEvent.click(screen.getByRole("option", { name: /high-press/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "tactics.applyChanges" }),
    );

    await waitFor(() => {
      expect(squadServiceMocks.applyTeamTactics).toHaveBeenCalledTimes(1);
    });

    // The manager is told, and their work survives: a rejected apply that
    // silently discarded the draft would cost them every dial they had set.
    expect(await screen.findByText("tactics.applyError")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "tactics.applyChanges" }),
    ).toBeEnabled();
  });

  it("localizes the selected player position in the comparison panel", () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    // Modal requires two players — select f1 then m1 to open comparison
    fireEvent.click(pitchPlayer("f1"));
    fireEvent.click(pitchPlayer("m1"));

    expect(screen.getByText("common.positions.Forward")).toBeInTheDocument();
    expect(screen.queryByText("Forward")).not.toBeInTheDocument();
  });

  it("allows selecting a bench player from the pitch view and swapping them with a starter", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("pitch-bench-player-d5"));

    // Modal only opens after both players are selected
    expect(screen.queryByText("tactics.selectedPlayer")).not.toBeInTheDocument();

    fireEvent.click(pitchPlayer("d2"));

    expect(squadServiceMocks.setStartingXi).not.toHaveBeenCalled();
    expect(screen.getByText("tactics.comparePlayer")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.confirmSwap" }),
    );

    await waitFor(() => {
      expect(squadServiceMocks.setStartingXi).toHaveBeenCalledWith([
          "gk1",
          "d1",
          "d5",
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

  it("uses pitch clicks for selection and swap instead of opening the player profile", async () => {
    const onSelectPlayer = vi.fn();

    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={onSelectPlayer}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(pitchPlayer("d1"));

    expect(onSelectPlayer).not.toHaveBeenCalled();
    // Modal only opens after both players are selected
    expect(screen.queryByText("tactics.selectedPlayer")).not.toBeInTheDocument();

    fireEvent.click(pitchPlayer("d2"));

    expect(onSelectPlayer).not.toHaveBeenCalled();
    expect(squadServiceMocks.setStartingXi).not.toHaveBeenCalled();
    expect(screen.getByText("tactics.comparePlayer")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.confirmSwap" }),
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

  it("shows a comparison panel after selecting a second pitch player", () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(pitchPlayer("d1"));
    fireEvent.click(pitchPlayer("m1"));

    expect(screen.getByText("tactics.comparePlayer")).toBeInTheDocument();
    expect(screen.getAllByText("Player m1").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("common.attributes.vision").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "tactics.confirmSwap" }),
    ).toBeInTheDocument();
  });

  it("clicking a starter row in the left panel selects them for swap, not opening player profile", () => {
    const onSelectPlayer = vi.fn();

    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={onSelectPlayer}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("xi-player-d1"));

    expect(onSelectPlayer).not.toHaveBeenCalled();
    // Modal stays closed until a second player is selected
    expect(screen.queryByText("tactics.selectedPlayer")).not.toBeInTheDocument();
  });

  it("shows all starting XI players in the left panel list", () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    expect(screen.getByTestId("xi-player-d1")).toBeInTheDocument();
    expect(screen.getByTestId("xi-player-gk1")).toBeInTheDocument();
    expect(screen.getByTestId("xi-player-f1")).toBeInTheDocument();
  });

  // A natural striker occupying the right-midfield slot (index 8 in 4-4-2).
  // Issue #272: the left panel and the pitch role picker must follow the
  // deployed slot, which is also what the backend validates roles against.
  const makeOutOfPositionGameState = (): GameStateData => {
    const gameState = makeGameState();
    gameState.players = gameState.players.map((player) =>
      player.id === "m4"
        ? { ...player, position: "Striker", natural_position: "Striker" }
        : player,
    );
    return gameState;
  };

  it("shows the deployed slot position for a starter played out of his natural position", () => {
    const gameState = makeOutOfPositionGameState();
    squadServiceMocks.getSquad.mockResolvedValue(
      gameState.players.filter((p) => p.team_id === "team1"),
    );

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    const row = screen.getByTestId("xi-player-m4");
    expect(
      within(row).getByText("common.posAbbr.RightMidfielder"),
    ).toBeInTheDocument();
    expect(
      within(row).queryByText("common.posAbbr.Striker"),
    ).not.toBeInTheDocument();
  });

  it("offers pitch roles for the deployed slot, not the natural position", () => {
    const gameState = makeOutOfPositionGameState();
    squadServiceMocks.getSquad.mockResolvedValue(
      gameState.players.filter((p) => p.team_id === "team1"),
    );

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    const card = pitchPlayer("m4");
    fireEvent.click(within(card).getByRole("combobox"));

    // Right-midfield roles are on offer; striker-only roles are not.
    expect(
      screen.getByRole("option", { name: "InvertedWinger" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Poacher" }),
    ).not.toBeInTheDocument();
  });

  it("does not promote an injured bench player into the starting XI", async () => {
    const gameState = makeGameState();
    gameState.players = gameState.players.map((player) =>
      player.id === "d5"
        ? {
            ...player,
            injury: { name: "Hamstring strain", days_remaining: 7 },
          }
        : player,
    );

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("bench-player-d5"));

    expect(
      screen.queryByRole("button", { name: "tactics.promoteToLineup" }),
    ).not.toBeInTheDocument();
    expect(squadServiceMocks.setStartingXi).not.toHaveBeenCalled();
  });

  it("does not allow swapping an injured bench player into the starting XI", () => {
    const gameState = makeGameState();
    gameState.players = gameState.players.map((player) =>
      player.id === "d5"
        ? {
            ...player,
            injury: { name: "Hamstring strain", days_remaining: 7 },
          }
        : player,
    );

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("pitch-bench-player-d5"));
    fireEvent.click(pitchPlayer("d2"));

    expect(
      screen.getByRole("button", { name: "tactics.confirmSwap" }),
    ).toBeDisabled();
  });

  it("offers tactics context-menu actions to promote a bench player", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    const benchRow = screen.getByTestId("bench-player-d5");
    fireEvent.contextMenu(benchRow);
    fireEvent.click(
      screen.getByRole("menuitem", { name: "tactics.promoteToLineup" }),
    );

    await waitFor(() => {
      expect(squadServiceMocks.setStartingXi).toHaveBeenCalledWith([
          "gk1",
          "d5",
          "d2",
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

  it("offers pitch context-menu actions to move a starter to the bench", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.contextMenu(within(pitchPlayer("d1")).getByRole("group"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "tactics.moveToBench" }),
    );

    await waitFor(() => {
      expect(squadServiceMocks.setStartingXi).toHaveBeenCalledWith([
          "gk1",
          "d5",
          "d2",
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

  it("assigns captaincy from the tactics table context menu", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("xi-player-d1"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "tactics.makeCaptain" }),
    );

    await waitFor(() => {
      expect(squadServiceMocks.setTeamMatchRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          captain: "d1",
        }),
      );
    });
  });

  it("assigns captaincy from the pitch context menu", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.contextMenu(within(pitchPlayer("d1")).getByRole("group"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "tactics.makeCaptain" }),
    );

    await waitFor(() => {
      expect(squadServiceMocks.setTeamMatchRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          captain: "d1",
        }),
      );
    });
  });

  it("persists default set piece and team role assignments from the right panel", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.autoSelectAssignments" }),
    );

    await waitFor(() => {
      expect(squadServiceMocks.setTeamMatchRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          captain: expect.any(String),
          vice_captain: expect.any(String),
          penalty_taker: expect.any(String),
          free_kick_taker: expect.any(String),
          corner_taker: expect.any(String),
        }),
      );
    });
  });
});
