import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import type {
  EnginePlayerData,
  MatchEvent,
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
      const translations: Record<string, string> = {
        "match.deliverTeamTalk": "Deliver Team Talk",
        "match.delivered": "Delivered",
        "match.firstHalfEvents": "First Half Events",
        "match.formation": "Formation",
        "match.halfTime": "Half Time",
        "match.ht": "HT",
        "match.makeSubstitution": "Make substitution",
        "match.pendingChanges": "Pending changes",
        "match.playStyle": "Play Style",
        "match.resumeMatch": "Resume Match",
        "match.substitutionsTitle": "Substitutions",
        "match.teamTalk": "Team Talk",
        "match.teamTalkOptions.aggressive.label": "Get Fired Up",
        "match.teamTalkOptions.assertive.label": "Demand More",
        "match.teamTalkOptions.calm.label": "Stay Calm",
        "match.teamTalkOptions.disappointed.label": "Show Disappointment",
        "match.teamTalkOptions.motivational.description":
          "Inspire the players to give their best.",
        "match.teamTalkOptions.motivational.label": "Motivate",
        "match.teamTalkOptions.praise.label": "Praise",
      };
      if (key in translations) return translations[key];
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

function renderBreak({
  importantEvents = [],
}: {
  importantEvents?: MatchEvent[];
} = {}) {
  const onResume = vi.fn();
  const onUpdateSnapshot = vi.fn();
  render(
    <HalfTimeBreak
      gameState={gameState()}
      importantEvents={importantEvents}
      isSpectator={false}
      matchdayIdentity={{ competitionName: "League", roundLabel: "Match Day" }}
      onResume={onResume}
      onUpdateSnapshot={onUpdateSnapshot}
      snapshot={snapshot()}
      userSide="Home"
    />,
  );
  return { onResume, onUpdateSnapshot };
}

const halfTimeSource = (() => {
  try {
    return readFileSync("src/components/match/HalfTimeBreak.tsx", "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
  } catch {
    return "";
  }
})();

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

  it("moves the match into the shell header without losing the break workflows", async () => {
    matchServiceMocks.applyTeamTalk.mockResolvedValue([
      {
        player_id: "starter-9",
        player_name: "Starter 9",
        old_morale: 70,
        new_morale: 75,
        delta: 5,
      },
    ]);
    renderBreak({
      importantEvents: [
        {
          minute: 31,
          event_type: "Goal",
          side: "Home",
          zone: "Box",
          player_id: "starter-9",
          secondary_player_id: null,
        },
      ],
    });

    // Recomposition must leave every half-time job available. Exercise the
    // stateful ones before checking where the scoreboard was composed.
    expect(
      screen.getByRole("heading", { name: "First Half Events" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Starter 9")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Team Talk" }),
    ).toBeInTheDocument();
    for (const option of [
      "Stay Calm",
      "Motivate",
      "Demand More",
      "Get Fired Up",
      "Praise",
      "Show Disappointment",
    ]) {
      expect(
        screen.getByRole("button", { name: new RegExp(option) }),
      ).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: /Motivate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Deliver Team Talk" }));
    expect(await screen.findByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Make substitution" }));
    expect(
      screen.getByRole("heading", { name: "Substitutions" }),
    ).toBeInTheDocument();

    const header = screen.getByRole("banner", {
      name: "League · Match Day",
    });
    const identityOutsideHeader = ["Home FC", "Half Time", "Away FC"].flatMap(
      (text) =>
        screen
          .getAllByText(text, { exact: true })
          .filter((node) => !header.contains(node))
          .map(() => text),
    );
    const missingScoresFromHeader = ["0", "1"].filter(
      (text) => within(header).queryByText(text, { exact: true }) === null,
    );
    expect(
      { identityOutsideHeader, missingScoresFromHeader },
      "the shell header must own both teams, the score, and the phase",
    ).toEqual({ identityOutsideHeader: [], missingScoresFromHeader: [] });
  });

  it("keeps Resume in the shell header and invokes it exactly once", () => {
    const { onResume } = renderBreak();
    const header = screen.getByRole("banner", {
      name: "League · Match Day",
    });
    const resume = screen.getByRole("button", { name: "Resume Match" });

    fireEvent.click(resume);

    expect(onResume).toHaveBeenCalledOnce();
    expect(
      header.contains(resume),
      "Resume must be composed into the shell header instead of overlaying the body",
    ).toBe(true);
  });

  it("offers formation and play style as two comboboxes instead of fourteen buttons", () => {
    renderBreak();

    const controlState = {
      formationCombobox: Boolean(
        screen.queryByRole("combobox", { name: "Formation" }),
      ),
      formationButton: Boolean(
        screen.queryByRole("button", { name: "4-3-3" }),
      ),
      playStyleCombobox: Boolean(
        screen.queryByRole("combobox", { name: "Play Style" }),
      ),
    };

    expect(
      controlState,
      "half-time must expose two compact choices and remove the formation chip wall",
    ).toEqual({
      formationCombobox: true,
      formationButton: false,
      playStyleCombobox: true,
    });
  });

  it.each([
    {
      controlName: "Formation",
      expectedChange: { formation: "4-3-3", play_style: "Balanced" },
      optionName: "4-3-3",
    },
    {
      controlName: "Play Style",
      expectedChange: { formation: "4-4-2", play_style: "Attacking" },
      optionName: "Attacking",
    },
  ])(
    "sends a $controlName choice as one change set, not a bare command",
    async ({ controlName, expectedChange, optionName }) => {
      // Half time is when a manager makes several changes at once, so neither
      // compact control may fall back to an immediately applied bare command.
      matchServiceMocks.applyMatchTactics.mockResolvedValue(snapshot());
      const { onUpdateSnapshot } = renderBreak();

      const control = screen.queryByRole("combobox", { name: controlName });
      expect(
        control,
        `${controlName} must be reachable as a combobox before its choice can be applied`,
      ).not.toBeNull();
      fireEvent.click(control as HTMLElement);
      fireEvent.click(screen.getByRole("option", { name: optionName }));

      await vi.waitFor(() => {
        expect(matchServiceMocks.applyMatchTactics).toHaveBeenCalledTimes(1);
      });
      expect(matchServiceMocks.applyMatchCommand).not.toHaveBeenCalled();
      const changes = matchServiceMocks.applyMatchTactics.mock
        .calls[0][0] as MatchTacticsChangeSet;
      expect(changes).toMatchObject(expectedChange);
      expect(changes.lineup_changes).toEqual([]);
      expect(onUpdateSnapshot).toHaveBeenCalledOnce();
    },
  );

  it("bounds all three body columns and removes the unbounded body scroller", () => {
    const classNames = [...halfTimeSource.matchAll(/className="([^"]*)"/g)].map(
      (match) => match[1],
    );
    const hasToken = (className: string, token: string) =>
      className.split(/\s+/).some((candidate) => candidate === token);
    const hasResponsiveToken = (className: string, token: string) =>
      className
        .split(/\s+/)
        .some(
          (candidate) =>
            candidate === token || candidate.endsWith(`:${token}`),
        );

    const unboundedPageScrollers = classNames.filter(
      (className) =>
        hasToken(className, "flex-1") &&
        (hasToken(className, "overflow-auto") ||
          hasToken(className, "overflow-y-auto")) &&
        !hasResponsiveToken(className, "min-h-0"),
    );
    const boundedScrollingPanes = classNames.filter(
      (className) =>
        hasResponsiveToken(className, "min-h-0") &&
        (hasResponsiveToken(className, "overflow-auto") ||
          hasResponsiveToken(className, "overflow-y-auto")),
    );
    const violations = [
      ...unboundedPageScrollers.map(
        (className) => `unbounded page-level scroller: ${className}`,
      ),
      ...(boundedScrollingPanes.length >= 3
        ? []
        : [
            `expected three bounded scrolling columns, found ${boundedScrollingPanes.length}`,
          ]),
    ];

    expect(
      violations,
      "the half-time body must be a fixed frame whose three panes own scrolling",
    ).toEqual([]);
  });
});
