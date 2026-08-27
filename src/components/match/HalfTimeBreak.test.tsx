import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import type {
  EnginePlayerData,
  MatchSnapshot,
  MatchTacticsChangeSet,
  TacticsConfig,
} from "./types";
import HalfTimeBreak from "./HalfTimeBreak";

const matchServiceMocks = vi.hoisted(() => ({
  applyMatchCommand: vi.fn(),
  applyMatchTactics: vi.fn(),
  applyTeamTalk: vi.fn(),
}));

vi.mock("../../services/matchService", () => ({
  applyMatchCommand: matchServiceMocks.applyMatchCommand,
  applyMatchTactics: matchServiceMocks.applyMatchTactics,
  applyTeamTalk: matchServiceMocks.applyTeamTalk,
}));

vi.mock("../../utils/backendI18n", () => ({
  resolveBackendError: (error: unknown) => String(error),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      const values =
        typeof options === "object" && options !== null
          ? (options as Record<string, unknown>)
          : {};
      if (key === "match.makeSubstitution") return "Make substitution";
      if (key === "match.pendingChanges") return "Pending changes";
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

function enginePlayer(overrides: Partial<EnginePlayerData>): EnginePlayerData {
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

const benchPlayers = [
  enginePlayer({ id: "bench-lb", name: "Bench Left Back", position: "Defender" }),
  enginePlayer({
    id: "bench-cm",
    name: "Bench Central Midfielder",
    position: "Midfielder",
  }),
];

function snapshot(): MatchSnapshot {
  return {
    phase: "HalfTime",
    current_minute: 45,
    home_score: 0,
    away_score: 1,
    possession: "Away",
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
      players: homePlayers,
    },
    home_bench: benchPlayers,
    away_bench: [],
    home_possession_pct: 45,
    away_possession_pct: 55,
    events: [],
    home_subs_made: 0,
    away_subs_made: 0,
    max_subs: 5,
    home_set_pieces: {
      captain: "starter-0",
      corner_taker: "starter-8",
      free_kick_taker: "starter-6",
      penalty_taker: "starter-9",
    },
    away_set_pieces: {
      captain: null,
      corner_taker: null,
      free_kick_taker: null,
      penalty_taker: null,
    },
    substitutions: [],
    allows_extra_time: false,
    home_yellows: {},
    away_yellows: {},
    sent_off: [],
    revision: 0,
  } as MatchSnapshot;
}

function gameState(): GameStateData {
  const naturalPositions = new Map([
    ["bench-lb", "LeftBack"],
    ["bench-cm", "CentralMidfielder"],
  ]);
  return {
    clock: { current_date: "2026-08-20" },
    players: [...homePlayers, ...benchPlayers].map((player) => ({
      id: player.id,
      match_name: player.name,
      full_name: player.name,
      team_id: "home",
      position: naturalPositions.get(player.id) ?? player.position,
      natural_position: naturalPositions.get(player.id) ?? player.position,
      condition: player.condition,
      ovr: player.ovr,
      jersey_number: null,
    })),
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

function renderBreak() {
  const onUpdateSnapshot = vi.fn();
  render(
    <HalfTimeBreak
      gameState={gameState()}
      importantEvents={[]}
      isSpectator={false}
      matchdayIdentity={{ competitionName: "League", roundLabel: "Match Day" }}
      onResume={vi.fn()}
      onUpdateSnapshot={onUpdateSnapshot}
      snapshot={snapshot()}
      userSide="Home"
    />,
  );
  return { onUpdateSnapshot };
}

beforeEach(() => {
  matchServiceMocks.applyMatchCommand.mockReset();
  matchServiceMocks.applyMatchTactics.mockReset();
  matchServiceMocks.applyTeamTalk.mockReset();
});

describe("half time", () => {
  it("names a left-back on the bench instead of the engine's Defender bucket", () => {
    // Live play passed the store's exact positions into the panel and the break
    // did not, so the one screen built for making several changes at once was
    // the one still showing four coarse buckets (#371).
    renderBreak();
    fireEvent.click(screen.getByRole("button", { name: /Make substitution/ }));

    const leftBack = screen.getByTestId("sub-panel-bench-bench-lb");
    expect(within(leftBack).getByText("LB")).toBeInTheDocument();
    expect(within(leftBack).queryByText("DEF")).not.toBeInTheDocument();
  });

  it("sends a shape chosen at the break as one change set, not a bare command", async () => {
    // Half time is when a manager makes several changes at once, so a formation
    // committing on its own while the substitutions were still queued was the
    // exact split atomic management exists to close.
    matchServiceMocks.applyMatchTactics.mockResolvedValue(snapshot());
    const { onUpdateSnapshot } = renderBreak();

    fireEvent.click(screen.getByRole("button", { name: "4-3-3" }));

    await vi.waitFor(() => {
      expect(matchServiceMocks.applyMatchTactics).toHaveBeenCalledTimes(1);
    });
    expect(matchServiceMocks.applyMatchCommand).not.toHaveBeenCalled();
    const changes = matchServiceMocks.applyMatchTactics.mock
      .calls[0][0] as MatchTacticsChangeSet;
    expect(changes.formation).toBe("4-3-3");
    expect(changes.lineup_changes).toEqual([]);
    expect(onUpdateSnapshot).toHaveBeenCalledOnce();
  });
});
