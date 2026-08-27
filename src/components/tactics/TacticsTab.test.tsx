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
import type { CustomTacticData } from "../../services/tacticsService";
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
      if (key.startsWith("pitchToken.accessibleName")) {
        const options = fallback as Record<string, unknown> | undefined;
        // The duties segment appears when a player wears the armband or takes
        // the set pieces; the same mock answers both keys.
        const duties = options?.duties ? ` · ${String(options.duties)}` : "";
        return `${String(options?.name)} · ${String(options?.condition)} · ${String(options?.fit)}${duties}`;
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

/*
  The tactic library lives in the save now, so the tab reads and writes it
  through the backend. This stands in for one career's worth of it.
*/
let savedTactics: CustomTacticData[] = [];

vi.mock("../../services/tacticsService", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/tacticsService")
  >("../../services/tacticsService");
  return {
    ...actual,
    deleteCustomTactic: vi.fn(async (id: string) => {
      savedTactics = savedTactics.filter((tactic) => tactic.id !== id);
      return savedTactics;
    }),
    listCustomTactics: vi.fn(async () => savedTactics),
    saveCustomTactic: vi.fn(async (tactic: CustomTacticData) => {
      const index = savedTactics.findIndex((saved) => saved.id === tactic.id);
      savedTactics =
        index >= 0
          ? savedTactics.map((saved, at) => (at === index ? tactic : saved))
          : [...savedTactics, tactic];
      return savedTactics;
    }),
  };
});

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
    savedTactics = [];
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
    expect(screen.getAllByText(/tactics\.availableSquad/).length).toBeGreaterThan(
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

  it("keeps a custom tactic across remounts, because it is in the save", async () => {
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
    await waitFor(() => {
      expect(savedTactics).toHaveLength(1);
    });

    unmount();

    render(
      <TacticsTab
        gameState={gameState}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "tactics.chooseTactic" }),
    );

    expect(
      await screen.findByRole("option", { name: /tactics.copyOfTactic/i }),
    ).toBeInTheDocument();
  });

  it("keeps a manager's tactics when they move to another club", async () => {
    // The old storage key included the team id, so a mid-career move silently
    // emptied the library (#390). The library belongs to the career.
    const beforeMove = makeGameState();
    const { unmount } = render(
      <TacticsTab
        gameState={beforeMove}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tactics.duplicateTactic" }),
    );
    await waitFor(() => {
      expect(savedTactics).toHaveLength(1);
    });
    unmount();

    const afterMove = makeGameState();
    afterMove.manager.team_id = "team2";
    afterMove.teams = [makeTeam({ id: "team2", manager_id: afterMove.manager.id })];
    afterMove.players = afterMove.players.map((player) => ({
      ...player,
      team_id: "team2",
    }));

    render(
      <TacticsTab
        gameState={afterMove}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "tactics.chooseTactic" }),
    );

    expect(
      await screen.findByRole("option", { name: /tactics.copyOfTactic/i }),
    ).toBeInTheDocument();
  });

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
    // The screen says it once visibly and once to a screen reader — one voice,
    // two presentations.
    expect(await screen.findAllByText("tactics.applyError")).toHaveLength(2);
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

    // Step 8b-1 moves the two-player comparison from the modal into the details pane.
    fireEvent.click(pitchPlayer("f1"));
    fireEvent.click(pitchPlayer("m1"));

    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });
    // Step 8b-1 requires the localized comparison content to live inside the inspector.
    expect(within(pane).getByText("common.positions.Forward")).toBeInTheDocument();
    // Step 8b-1 keeps raw position prose out of the inline inspector comparison.
    expect(within(pane).queryByText("Forward")).not.toBeInTheDocument();
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

    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });
    // Step 8b-1 gives a single selected player an inspector state before comparison.
    expect(within(pane).getByText("tactics.selectedPlayer")).toBeInTheDocument();

    fireEvent.click(pitchPlayer("d2"));

    expect(squadServiceMocks.setStartingXi).not.toHaveBeenCalled();
    // Step 8b-1 moves the comparison into the persistent details pane.
    expect(within(pane).getByText("tactics.comparePlayer")).toBeInTheDocument();

    fireEvent.click(
      // Step 8b-1 moves swap confirmation from the modal into the inspector.
      within(pane).getByRole("button", { name: "tactics.confirmSwap" }),
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
    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });
    // Step 8b-1 makes the first pitch click populate the single-player inspector.
    expect(within(pane).getByText("tactics.selectedPlayer")).toBeInTheDocument();

    fireEvent.click(pitchPlayer("d2"));

    expect(onSelectPlayer).not.toHaveBeenCalled();
    expect(squadServiceMocks.setStartingXi).not.toHaveBeenCalled();
    // Step 8b-1 makes the second pitch click replace that state with inline comparison.
    expect(within(pane).getByText("tactics.comparePlayer")).toBeInTheDocument();

    fireEvent.click(
      // Step 8b-1 keeps the swap action in the details pane instead of an overlay.
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

    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });
    // Step 8b-1 places the comparison heading inside the details pane.
    expect(within(pane).getByText("tactics.comparePlayer")).toBeInTheDocument();
    // Step 8b-1 places the compared player's summary inside the details pane.
    expect(within(pane).getAllByText("Player m1").length).toBeGreaterThan(0);
    // Step 8b-1 places the compared attributes inside the details pane.
    expect(
      within(pane).getAllByText("common.attributes.vision").length,
    ).toBeGreaterThan(0);
    // Step 8b-1 places swap confirmation inside the details pane.
    expect(
      within(pane).getByRole("button", { name: "tactics.confirmSwap" }),
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
    // Step 8b-1 replaces the modal-only flow with a first-selection inspector state.
    expect(
      within(
        screen.getByRole("region", { name: "tactics.detailsPane" }),
      ).getByText("tactics.selectedPlayer"),
    ).toBeInTheDocument();
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
  // Issue #272: the left panel and the inspector role picker must follow the
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

  it("offers inspector roles for the deployed slot, not the natural position", () => {
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

    fireEvent.click(pitchPlayer("m4"));
    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });
    // Step 8b-1 moves the deployed-slot role picker from the pitch token to the inspector.
    fireEvent.click(within(pane).getByRole("combobox"));

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

    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });
    // Step 8b-1 keeps the illegal-swap guard on the inspector's confirmation control.
    expect(
      within(pane).getByRole("button", { name: "tactics.confirmSwap" }),
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

  it("persists default set piece and team role assignments from the responsibility editor", async () => {
    render(
      <TacticsTab
        gameState={makeGameState()}
        onSelectPlayer={vi.fn()}
        onGameUpdate={vi.fn()}
      />,
    );

    const pane = screen.getByRole("region", { name: "tactics.detailsPane" });
    // Step 8b-1 puts responsibility controls behind their section's Adjust action.
    fireEvent.click(
      // Step 8b-1 review: the two section controls are told apart by the section
      // they name, not by their position in the DOM.
      within(pane).getByRole("button", {
        name: "tactics.adjust tactics.responsibilities",
      }),
    );
    // Step 8b-1 keeps the existing auto-assignment action inside that editor.
    fireEvent.click(
      within(pane).getByRole("button", {
        name: "tactics.autoSelectAssignments",
      }),
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
