import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import type {
  EnginePlayerData,
  MatchSnapshot,
  MatchTacticsChangeSet,
  TacticsConfig,
} from "./types";
import MatchLive from "./MatchLive";

const matchServiceMocks = vi.hoisted(() => ({
  applyMatchCommand: vi.fn(),
  applyMatchTactics: vi.fn(),
  getMatchSnapshot: vi.fn(),
  stepLiveMatch: vi.fn(),
}));

vi.mock("../../services/matchService", () => ({
  applyMatchCommand: matchServiceMocks.applyMatchCommand,
  applyMatchTactics: matchServiceMocks.applyMatchTactics,
  getMatchSnapshot: matchServiceMocks.getMatchSnapshot,
  stepLiveMatch: matchServiceMocks.stepLiveMatch,
}));

vi.mock("../../utils/backendI18n", () => ({
  resolveBackendError: (error: unknown) =>
    error === "be.error.liveMatch.staleLineupSlot"
      ? "That slot has changed since you opened this panel."
      : String(error),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      const values =
        typeof options === "object" && options !== null
          ? (options as Record<string, unknown>)
          : {};
      if (key === "match.manageTeam") return "Manage team";
      if (key === "match.pendingChanges") return "Pending changes";
      if (key === "match.applyPendingChanges") return "Apply changes";
      if (key === "match.noPendingChanges") return "No pending changes";
      if (key === "match.pendingSubstitution") {
        return `${String(values.playerOff)} off, ${String(values.playerOn)} on`;
      }
      if (key === "match.pendingRoleChange") {
        return `${String(values.player)} changes role to ${String(values.role)}`;
      }
      if (key === "match.removePendingChange") {
        return `Remove ${String(values.change)}`;
      }
      if (key === "match.tooManyPendingSubstitutions") {
        return `Cannot queue another substitution: ${String(values.remaining)} remaining.`;
      }
      if (key === "tactics.playerRoleLabel") return "Role";
      if (key === "tactics.playerRoles.BoxToBox") return "Box-to-Box";
      if ("defaultValue" in values) return String(values.defaultValue);
      if (typeof options === "string") return options;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

const TACTICS: TacticsConfig = {
  pressing_intensity: "Medium",
  defensive_line: "Medium",
  width: "Normal",
  build_up_style: "Mixed",
  marking_style: "Zonal",
  tempo: "Direct",
  defensive_shape: "Normal",
  counter_press_duration: "None",
  break_speed: "Medium",
};

function enginePlayer(
  overrides: Partial<EnginePlayerData>,
): EnginePlayerData {
  return {
    id: "player",
    name: "Player",
    position: "Midfielder",
    condition: 90,
    pace: 65,
    stamina: 65,
    strength: 65,
    agility: 65,
    passing: 65,
    shooting: 65,
    tackling: 65,
    dribbling: 65,
    defending: 65,
    positioning: 65,
    vision: 65,
    decisions: 65,
    composure: 65,
    aggression: 50,
    teamwork: 65,
    leadership: 50,
    handling: 20,
    reflexes: 20,
    aerial: 60,
    ovr: 70,
    traits: [],
    role: "Standard",
    ...overrides,
  };
}

const homePlayers = [
  "Goalkeeper",
  "Defender",
  "Defender",
  "Defender",
  "Defender",
  "Midfielder",
  "Midfielder",
  "Midfielder",
  "Midfielder",
  "Forward",
  "Forward",
].map((position, slotIndex) =>
  enginePlayer({
    id: `starter-${slotIndex}`,
    name: `Starter ${slotIndex}`,
    position,
  }),
);

const awayPlayers = homePlayers.map((player, slotIndex) =>
  enginePlayer({
    ...player,
    id: `away-${slotIndex}`,
    name: `Away ${slotIndex}`,
  }),
);

const benchPlayers = [
  enginePlayer({
    id: "bench-lb",
    name: "Bench Left Back",
    position: "Defender",
  }),
  enginePlayer({
    id: "bench-cm",
    name: "Bench Central Midfielder",
    position: "Midfielder",
  }),
  enginePlayer({
    id: "bench-st",
    name: "Bench Striker",
    position: "Forward",
  }),
];

function snapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    phase: "SecondHalf",
    current_minute: 61,
    home_score: 1,
    away_score: 1,
    possession: "Home",
    ball_zone: "Middle",
    home_team: {
      id: "home",
      name: "Home FC",
      formation: "4-4-2",
      play_style: "Balanced",
      tactics: TACTICS,
      players: homePlayers,
    },
    away_team: {
      id: "away",
      name: "Away FC",
      formation: "4-4-2",
      play_style: "Balanced",
      tactics: TACTICS,
      players: awayPlayers,
    },
    home_bench: benchPlayers,
    away_bench: [],
    home_possession_pct: 50,
    away_possession_pct: 50,
    events: [],
    home_subs_made: 0,
    away_subs_made: 0,
    max_subs: 5,
    home_set_pieces: {
      free_kick_taker: "starter-6",
      corner_taker: "starter-8",
      penalty_taker: "starter-9",
      captain: "starter-0",
    },
    away_set_pieces: {
      free_kick_taker: null,
      corner_taker: null,
      penalty_taker: null,
      captain: null,
    },
    substitutions: [],
    allows_extra_time: false,
    home_yellows: {},
    away_yellows: {},
    sent_off: [],
    ...overrides,
  };
}

function storePlayer(
  player: EnginePlayerData,
  naturalPosition: string,
) {
  return {
    id: player.id,
    match_name: player.name,
    full_name: player.name,
    team_id: "home",
    position: naturalPosition,
    natural_position: naturalPosition,
    condition: player.condition,
    ovr: player.ovr,
    attributes: {
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
    },
    jersey_number: null,
  };
}

function gameState(): GameStateData {
  const naturalPositions = new Map([
    ["bench-lb", "LeftBack"],
    ["bench-cm", "CentralMidfielder"],
    ["bench-st", "Striker"],
  ]);
  return {
    clock: { current_date: "2026-08-20" },
    players: [...homePlayers, ...benchPlayers].map((player) =>
      storePlayer(
        player,
        naturalPositions.get(player.id) ?? player.position,
      ),
    ),
    teams: [
      {
        id: "home",
        name: "Home FC",
        short_name: "HOM",
        colors: { primary: "#10b981", secondary: "#1a3a6b" },
      },
      {
        id: "away",
        name: "Away FC",
        short_name: "AWY",
        colors: { primary: "#6366f1", secondary: "#1a3a6b" },
      },
    ],
  } as unknown as GameStateData;
}

function renderManagement(current = snapshot()) {
  const onSnapshotUpdate = vi.fn();
  render(
    <MatchLive
      gameState={gameState()}
      importantEvents={[]}
      isSpectator={false}
      matchdayIdentity={{ competitionName: "League", roundLabel: "Match Day" }}
      onFullTime={vi.fn()}
      onHalfTime={vi.fn()}
      onImportantEvent={vi.fn()}
      onSnapshotUpdate={onSnapshotUpdate}
      snapshot={current}
      userSide="Home"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Manage team/ }));
  return { onSnapshotUpdate };
}

function queueSubstitution(slotIndex: number, benchId: string): void {
  fireEvent.click(screen.getByTestId(`sub-panel-off-starter-${slotIndex}`));
  fireEvent.click(screen.getByTestId(`sub-panel-bench-${benchId}`));
}

function pendingChanges(): HTMLElement {
  return screen.getByRole("region", { name: "Pending changes" });
}

function chooseFromSelect(selectName: string, optionName: string): void {
  fireEvent.click(screen.getByRole("combobox", { name: selectName }));
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

beforeEach(() => {
  matchServiceMocks.applyMatchCommand.mockReset();
  matchServiceMocks.applyMatchTactics.mockReset();
  matchServiceMocks.getMatchSnapshot.mockReset();
  matchServiceMocks.stepLiveMatch.mockReset();
  matchServiceMocks.stepLiveMatch.mockResolvedValue([]);
});

describe("atomic in-match management", () => {
  it("submits three queued substitutions in one tactics call and no command calls", async () => {
    const next = snapshot({ current_minute: 62, home_subs_made: 3 });
    matchServiceMocks.applyMatchTactics.mockResolvedValue(next);
    const { onSnapshotUpdate } = renderManagement();

    queueSubstitution(5, "bench-lb");
    queueSubstitution(6, "bench-cm");
    queueSubstitution(9, "bench-st");
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    await vi.waitFor(() => {
      expect(matchServiceMocks.applyMatchTactics).toHaveBeenCalledTimes(1);
    });
    const changes = matchServiceMocks.applyMatchTactics.mock
      .calls[0][0] as MatchTacticsChangeSet;
    expect(changes).toEqual({
      side: "Home",
      formation: "4-4-2",
      play_style: "Balanced",
      tactics: TACTICS,
      slot_roles: Array(11).fill("Standard"),
      lineup_changes: [
        {
          slot_index: 5,
          expected_outgoing_player_id: "starter-5",
          incoming_player_id: "bench-lb",
        },
        {
          slot_index: 6,
          expected_outgoing_player_id: "starter-6",
          incoming_player_id: "bench-cm",
        },
        {
          slot_index: 9,
          expected_outgoing_player_id: "starter-9",
          incoming_player_id: "bench-st",
        },
      ],
      // The armband and the set-piece duties follow the substitution. Every
      // duty is filled when the match is built, so sending them unchanged sent
      // a free-kick taker who was no longer on the pitch — which the engine
      // refuses, taking the three substitutions with it.
      assignments: {
        captain: "starter-0",
        corner_taker: "starter-8",
        free_kick_taker: "bench-cm",
        penalty_taker: "bench-st",
      },
    });
    expect(matchServiceMocks.applyMatchCommand).not.toHaveBeenCalled();
    expect(onSnapshotUpdate).toHaveBeenCalledOnce();
    expect(onSnapshotUpdate).toHaveBeenCalledWith(next);
  });

  it("removes queued changes and submits nothing after the queue is emptied", () => {
    renderManagement();
    queueSubstitution(5, "bench-lb");
    queueSubstitution(6, "bench-cm");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Starter 5 off, Bench Left Back on",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Starter 6 off, Bench Central Midfielder on",
      }),
    );

    expect(pendingChanges()).toHaveTextContent("No pending changes");
    expect(
      screen.getByRole("button", { name: "Apply changes" }),
    ).toBeDisabled();
    expect(matchServiceMocks.applyMatchTactics).not.toHaveBeenCalled();
    expect(matchServiceMocks.applyMatchCommand).not.toHaveBeenCalled();
  });

  it("keeps a rejected queue open, explains the refusal, and allows a retry", async () => {
    const next = snapshot({ current_minute: 62, home_subs_made: 1 });
    matchServiceMocks.applyMatchTactics
      .mockRejectedValueOnce("be.error.liveMatch.staleLineupSlot")
      .mockResolvedValueOnce(next);
    const { onSnapshotUpdate } = renderManagement();
    queueSubstitution(5, "bench-lb");

    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(
      await screen.findByText(
        "That slot has changed since you opened this panel.",
      ),
    ).toBeInTheDocument();
    expect(pendingChanges()).toHaveTextContent(
      "Starter 5 off, Bench Left Back on",
    );
    expect(onSnapshotUpdate).not.toHaveBeenCalled();
    expect(matchServiceMocks.applyMatchCommand).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Starter 5 off, Bench Left Back on",
      }),
    );
    queueSubstitution(6, "bench-cm");
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    await vi.waitFor(() => {
      expect(matchServiceMocks.applyMatchTactics).toHaveBeenCalledTimes(2);
    });
    expect(onSnapshotUpdate).toHaveBeenCalledOnce();
    expect(onSnapshotUpdate).toHaveBeenCalledWith(next);
  });

  it("refuses a locally known substitution overflow before a round trip", () => {
    renderManagement(snapshot({ home_subs_made: 4, max_subs: 5 }));
    queueSubstitution(5, "bench-lb");
    queueSubstitution(6, "bench-cm");

    expect(
      screen.getByText("Cannot queue another substitution: 1 remaining."),
    ).toBeInTheDocument();
    expect(pendingChanges()).toHaveTextContent(
      "Starter 5 off, Bench Left Back on",
    );
    expect(pendingChanges()).not.toHaveTextContent(
      "Starter 6 off, Bench Central Midfielder on",
    );
    expect(matchServiceMocks.applyMatchTactics).not.toHaveBeenCalled();
    expect(matchServiceMocks.applyMatchCommand).not.toHaveBeenCalled();
  });

  it("names a left-back from store data instead of the engine's Defender bucket", () => {
    renderManagement();

    const leftBack = screen.getByTestId("sub-panel-bench-bench-lb");
    expect(within(leftBack).getByText("LB")).toBeInTheDocument();
    expect(within(leftBack).queryByText("DEF")).not.toBeInTheDocument();
  });

  it("sends a selected in-match role in slot_roles rather than its own command", async () => {
    matchServiceMocks.applyMatchTactics.mockResolvedValue(snapshot());
    renderManagement();

    fireEvent.click(screen.getByTestId("sub-panel-off-starter-6"));
    chooseFromSelect("Role", "Box-to-Box");
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    await vi.waitFor(() => {
      expect(matchServiceMocks.applyMatchTactics).toHaveBeenCalledOnce();
    });
    const changes = matchServiceMocks.applyMatchTactics.mock
      .calls[0][0] as MatchTacticsChangeSet;
    expect(changes.slot_roles).toHaveLength(11);
    expect(changes.slot_roles[6]).toBe("BoxToBox");
    expect(changes.lineup_changes).toEqual([]);
    expect(matchServiceMocks.applyMatchCommand).not.toHaveBeenCalledWith({
      ChangePlayerRole: {
        side: "Home",
        player_id: "starter-6",
        role: "BoxToBox",
      },
    });
  });

  it("describes every queued action in a named review region", () => {
    renderManagement();
    queueSubstitution(5, "bench-lb");

    const queue = pendingChanges();
    const summary = within(queue).getByText(
      "Starter 5 off, Bench Left Back on",
    );
    expect(summary).toBeInTheDocument();
    expect(
      within(queue).getByRole("button", {
        name: "Remove Starter 5 off, Bench Left Back on",
      }),
    ).toBeInTheDocument();
  });
});

describe("what the review of step 11 found", () => {
  it("groups the bench by the exact position each player plays", () => {
    // #371 asked for the exact position, not the engine's four buckets — and
    // an unsorted list of eleven positions is still a list to be searched.
    renderManagement();

    const headings = screen
      .getAllByRole("columnheader")
      .map((heading) => heading.textContent);

    expect(headings).toContain("Left Back");
    expect(headings).toContain("Central Midfielder");
    expect(headings).toContain("Striker");
    expect(headings.indexOf("Left Back")).toBeLessThan(
      headings.indexOf("Central Midfielder"),
    );
    expect(headings.indexOf("Central Midfielder")).toBeLessThan(
      headings.indexOf("Striker"),
    );
  });

  it("still offers formation and play style once the substitutions are gone", () => {
    // A spent allowance stops substitutions and nothing else. Hiding the panel
    // took the shape, the play style and every slot role with it.
    renderManagement(snapshot({ home_subs_made: 5, max_subs: 5 }));

    expect(
      screen.getByRole("region", { name: "Pending changes" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("combobox", { name: "tactics.formation" }).length,
    ).toBeGreaterThan(0);
  });

  it("sends a change from the dugout bar as a change set, not a bare command", async () => {
    // `ChangeFormation` lands in the engine the moment it arrives, so leaving
    // it here left two ways to manage a match — one atomic, one not.
    matchServiceMocks.applyMatchTactics.mockResolvedValue(snapshot());
    render(
      <MatchLive
        gameState={gameState()}
        importantEvents={[]}
        isSpectator={false}
        matchdayIdentity={{ competitionName: "League", roundLabel: "Match Day" }}
        onFullTime={vi.fn()}
        onHalfTime={vi.fn()}
        onImportantEvent={vi.fn()}
        onSnapshotUpdate={vi.fn()}
        snapshot={snapshot()}
        userSide="Home"
      />,
    );

    chooseFromSelect("match.formation", "4-3-3");

    await vi.waitFor(() => {
      expect(matchServiceMocks.applyMatchTactics).toHaveBeenCalledTimes(1);
    });
    expect(matchServiceMocks.applyMatchCommand).not.toHaveBeenCalled();
    const changes = matchServiceMocks.applyMatchTactics.mock
      .calls[0][0] as MatchTacticsChangeSet;
    expect(changes.formation).toBe("4-3-3");
    expect(changes.lineup_changes).toEqual([]);
  });

  it("takes a queued substitution back out when the same replacement is chosen again", () => {
    renderManagement();
    queueSubstitution(5, "bench-lb");

    expect(pendingChanges()).toHaveTextContent(
      "Starter 5 off, Bench Left Back on",
    );

    fireEvent.click(screen.getByTestId("sub-panel-bench-bench-lb"));

    expect(pendingChanges()).toHaveTextContent("No pending changes");
  });
});
