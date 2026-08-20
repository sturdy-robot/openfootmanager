import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import type { EnginePlayerData, MatchSnapshot } from "./types";
import MatchLive from "./MatchLive";

/**
 * The live screen's subject is the match, and the match was the one thing it
 * did not show.
 *
 * Two thirds of the width went to a tabbed panel and a sidebar that repeated
 * it, the transport sat in a rail of its own, the minute was printed twice,
 * and fourteen chips offered every formation and every play style at once.
 * Issue #410 asks for the pitch: both sides, where they are standing, no ball
 * animation.
 */

const matchServiceMocks = vi.hoisted(() => ({
  applyMatchCommand: vi.fn(),
  getMatchSnapshot: vi.fn(),
  stepLiveMatch: vi.fn(),
}));

vi.mock("../../services/matchService", () => ({
  applyMatchCommand: matchServiceMocks.applyMatchCommand,
  getMatchSnapshot: matchServiceMocks.getMatchSnapshot,
  stepLiveMatch: matchServiceMocks.stepLiveMatch,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      if (opts && typeof opts === "object") {
        const values = opts as Record<string, unknown>;
        if ("defaultValue" in values) {
          return String(values.defaultValue);
        }
        const entries = Object.entries(values);
        if (entries.length > 0) {
          return `${key}(${entries
            .map(([name, value]) => `${name}=${String(value)}`)
            .sort()
            .join(",")})`;
        }
      }
      if (typeof opts === "string") {
        return opts;
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
    condition: 90,
    pace: 60,
    stamina: 60,
    strength: 60,
    agility: 60,
    passing: 60,
    shooting: 60,
    tackling: 60,
    dribbling: 60,
    defending: 60,
    positioning: 60,
    vision: 60,
    decisions: 60,
    composure: 60,
    aggression: 60,
    teamwork: 60,
    leadership: 60,
    handling: 60,
    reflexes: 60,
    aerial: 60,
    ovr: 70,
    traits: [],
    role: "Standard",
    ...overrides,
  };
}

function eleven(prefix: string, label: string): EnginePlayerData[] {
  const shape = [
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
  ];
  return shape.map((position, index) =>
    enginePlayer({
      id: `${prefix}-${index}`,
      name: `${label} ${index}`,
      position,
    }),
  );
}

const homeXI = eleven("h", "Home");
const awayXI = eleven("a", "Away");

function snapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    phase: "FirstHalf",
    current_minute: 23,
    home_score: 1,
    away_score: 0,
    possession: "Home",
    ball_zone: "Middle",
    home_team: {
      id: "home1",
      name: "Home FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: homeXI,
    },
    away_team: {
      id: "away1",
      name: "Away FC",
      formation: "4-3-3",
      play_style: "Counter",
      players: awayXI,
    },
    home_bench: [enginePlayer({ id: "h-sub", name: "Home Sub" })],
    away_bench: [],
    home_possession_pct: 58,
    away_possession_pct: 42,
    events: [],
    home_subs_made: 0,
    away_subs_made: 0,
    max_subs: 5,
    home_set_pieces: {
      free_kick_taker: null,
      corner_taker: null,
      penalty_taker: null,
      captain: null,
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

function gameState(): GameStateData {
  return {
    clock: { current_date: "2026-08-01" },
    players: [],
    teams: [
      {
        id: "home1",
        name: "Home FC",
        short_name: "HOM",
        colors: { primary: "#10b981", secondary: "#1a3a6b" },
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

function renderLive(current: MatchSnapshot = snapshot()) {
  const onSnapshotUpdate = vi.fn();
  render(
    <MatchLive
      matchdayIdentity={{ competitionName: "League", roundLabel: "Match Day" }}
      snapshot={current}
      gameState={gameState()}
      userSide="Home"
      isSpectator={false}
      importantEvents={[]}
      onSnapshotUpdate={onSnapshotUpdate}
      onImportantEvent={vi.fn()}
      onHalfTime={vi.fn()}
      onFullTime={vi.fn()}
    />,
  );
  return { onSnapshotUpdate };
}

const source = (() => {
  try {
    return readFileSync("src/components/match/MatchLive.tsx", "utf-8");
  } catch {
    return "";
  }
})();

beforeEach(() => {
  vi.useFakeTimers();
  matchServiceMocks.applyMatchCommand.mockReset();
  matchServiceMocks.getMatchSnapshot.mockReset();
  matchServiceMocks.stepLiveMatch.mockReset();
  matchServiceMocks.stepLiveMatch.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the live match centre", () => {
  it("puts both sides on the pitch", () => {
    renderLive();

    const home = screen.getByRole("region", { name: /Home FC/ });
    const away = screen.getByRole("region", { name: /Away FC/ });

    expect(home).not.toBe(away);
    // Eleven against eleven, where they are standing — which is what #410
    // asked for and what the screen has never shown.
    for (const player of homeXI) {
      expect(within(home).getByText(player.name)).toBeInTheDocument();
    }
    for (const player of awayXI) {
      expect(within(away).getByText(player.name)).toBeInTheDocument();
    }
  });

  it("turns the away side round so both are attacking the right way", () => {
    renderLive();

    // The two sides do not both attack upwards. A board drawn identically for
    // each is a diagram of two home teams.
    expect(source).toMatch(/orientation=\{?"mirrored"/);
  });

  it("does not animate a ball", () => {
    renderLive();

    // Issue #410 is explicit: static positions, no ball animation. The one
    // pulse on this screen is the live indicator beside the clock.
    expect(source).not.toMatch(/ball.*animate|animate.*ball/i);
    expect(document.querySelectorAll('[class*="animate-"]').length).toBeLessThan(
      2,
    );
  });

  it("says the minute once", () => {
    renderLive();

    // It was printed twice: once under the phase and once beside a clock icon
    // in the corner.
    expect(screen.getAllByText(/^23'$/)).toHaveLength(1);
  });

  it("keeps the transport with the clock, not in a rail of its own", () => {
    renderLive();

    const header = screen.getByRole("banner");

    for (const label of [
      "match.pause",
      "match.slow",
      "match.normal",
      "match.fast",
      "match.max",
    ]) {
      expect(
        within(header).getByRole("button", { name: label }),
        label,
      ).toBeInTheDocument();
    }
    // The speed rail's heading goes with it — the controls are chrome now, and
    // chrome does not need a section title.
    expect(screen.queryByText("match.simSpeed")).toBeNull();
  });

  it("drops the sidebar that repeated the events tab", () => {
    renderLive();

    // Key Events listed the same feed as the Events tab, three metres to the
    // left of it.
    expect(screen.queryByText("match.keyEvents")).toBeNull();
    expect(
      screen.getByRole("tab", { name: /match\.events/ }),
    ).toBeInTheDocument();
  });

  it("offers the shape and the style as two controls, not fourteen chips", () => {
    renderLive();

    expect(
      screen.getByRole("combobox", { name: "match.formation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "match.playStyle" }),
    ).toBeInTheDocument();
    // Eight formations and six styles, all present at once, is not a decision
    // anyone makes at speed.
    expect(screen.queryByRole("button", { name: "4-3-3" })).toBeNull();
  });

  it("changes the shape through the match, not the save", async () => {
    const next = snapshot({ current_minute: 24 });
    matchServiceMocks.applyMatchCommand.mockResolvedValue(next);
    const { onSnapshotUpdate } = renderLive();

    fireEvent.click(screen.getByRole("combobox", { name: "match.formation" }));
    fireEvent.click(screen.getByRole("option", { name: "4-3-3" }));

    await vi.waitFor(() => {
      expect(matchServiceMocks.applyMatchCommand).toHaveBeenCalledWith({
        ChangeFormation: { side: "Home", formation: "4-3-3" },
      });
    });
    expect(onSnapshotUpdate).toHaveBeenCalledWith(next);
  });

  it("marks a sent-off player rather than losing them off the board", () => {
    renderLive(snapshot({ sent_off: ["h-4"] }));

    const home = screen.getByRole("region", { name: /Home FC/ });
    const token = within(home).getByText("Home 4").closest("[aria-label]");

    // Removing them from the array would slide every later player into the
    // wrong slot; the board has to say what happened instead.
    expect(token?.getAttribute("aria-label")).toMatch(/sentOff|RedCard/i);
  });

  it("shows a booking on the player who has it", () => {
    renderLive(snapshot({ home_yellows: { "h-6": 1 } }));

    const home = screen.getByRole("region", { name: /Home FC/ });
    const token = within(home).getByText("Home 6").closest("[aria-label]");

    expect(token?.getAttribute("aria-label")).toMatch(/yellow/i);
  });

  it("leaves the rating slot empty until an engine has one to put in it", () => {
    renderLive();

    const home = screen.getByRole("region", { name: /Home FC/ });

    // The dark-data contract: reserved layout that renders nothing. No 6.0
    // baseline, no dash, no skeleton pretending to load — a number on screen
    // is a claim, and this engine has not made one.
    expect(within(home).queryByText(/^\d\.\d$/)).toBeNull();
    expect(within(home).queryByText("—")).toBeNull();
  });
});
