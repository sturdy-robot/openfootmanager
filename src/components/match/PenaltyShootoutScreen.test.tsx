import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameStateData } from "../../store/gameStore";
import type { MatchEvent, MatchSnapshot } from "./types";
import PenaltyShootoutScreen, { KickRow } from "./PenaltyShootoutScreen";

const matchServiceMocks = vi.hoisted(() => ({
  getMatchSnapshot: vi.fn(),
  stepLiveMatch: vi.fn(),
}));

vi.mock("../../services/matchService", () => ({
  getMatchSnapshot: matchServiceMocks.getMatchSnapshot,
  stepLiveMatch: matchServiceMocks.stepLiveMatch,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const parameters = Object.entries(options ?? {});
      return parameters.length === 0
        ? key
        : `${key}(${parameters
            .map(([name, value]) => `${name}=${String(value)}`)
            .sort()
            .join(",")})`;
    },
  }),
}));

vi.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

function shootoutEvent(
  event_type: "ShootoutGoal" | "ShootoutMiss",
  side: "Home" | "Away",
  minute: number,
): MatchEvent {
  return {
    minute,
    event_type,
    side,
    zone: "PenaltyArea",
    player_id: null,
    secondary_player_id: null,
  };
}

const events = [
  shootoutEvent("ShootoutGoal", "Home", 121),
  shootoutEvent("ShootoutGoal", "Away", 122),
  shootoutEvent("ShootoutMiss", "Home", 123),
  shootoutEvent("ShootoutMiss", "Away", 124),
  shootoutEvent("ShootoutGoal", "Home", 125),
];

function snapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    phase: "PenaltyShootout",
    current_minute: 125,
    home_score: 1,
    away_score: 1,
    possession: "Home",
    ball_zone: "PenaltyArea",
    home_team: {
      id: "home",
      name: "Home FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [],
    },
    away_team: {
      id: "away",
      name: "Away FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [],
    },
    home_bench: [],
    away_bench: [],
    home_possession_pct: 50,
    away_possession_pct: 50,
    events,
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
    allows_extra_time: true,
    home_yellows: {},
    away_yellows: {},
    sent_off: [],
    penalty_shootout: {
      home_taken: 3,
      away_taken: 2,
      home_scored: 2,
      away_scored: 1,
      sudden_death: false,
    },
    revision: 4,
    ...overrides,
  };
}

function gameState(): GameStateData {
  return {
    teams: [
      {
        id: "home",
        name: "Home FC",
        short_name: "HOM",
        colors: { primary: "green", secondary: "white" },
      },
      {
        id: "away",
        name: "Away FC",
        short_name: "AWY",
        colors: { primary: "blue", secondary: "white" },
      },
    ],
  } as unknown as GameStateData;
}

function renderShootout(current: MatchSnapshot = snapshot()) {
  const onSnapshotUpdate = vi.fn();
  render(
    <PenaltyShootoutScreen
      matchdayIdentity={{
        competitionName: "National Cup",
        roundLabel: "Semi-final",
      }}
      snapshot={current}
      gameState={gameState()}
      userSide="Home"
      isSpectator={false}
      importantEvents={events}
      onSnapshotUpdate={onSnapshotUpdate}
      onImportantEvent={vi.fn()}
      onFullTime={vi.fn()}
    />,
  );
  return { onSnapshotUpdate };
}

beforeEach(() => {
  vi.useFakeTimers();
  matchServiceMocks.getMatchSnapshot.mockReset();
  matchServiceMocks.stepLiveMatch.mockReset();
  matchServiceMocks.stepLiveMatch.mockResolvedValue({
    base_revision: 4,
    revision: 5,
    minutes: [],
    delta: {
      phase: "PenaltyShootout",
      current_minute: 126,
      home_score: 1,
      away_score: 1,
      possession: "Away",
      ball_zone: "PenaltyArea",
      home_possession_pct: 50,
      away_possession_pct: 50,
      conditions: [],
    },
    snapshot: null,
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("KickRow", function (): void {
  it("shows future cells for untaken kicks", function (): void {
    render(<KickRow label="Home" taken={0} scored={0} maxRounds={5} />);
    const cells = screen.getAllByText("?");
    expect(cells).toHaveLength(5);
  });

  it("renders goals as ⚽ and misses as ✗", function (): void {
    // 3 taken: first two scored, third missed
    render(<KickRow label="Home" taken={3} scored={2} maxRounds={5} />);
    expect(screen.getAllByText("⚽")).toHaveLength(2);
    expect(screen.getAllByText("✗")).toHaveLength(1);
    expect(screen.getAllByText("?")).toHaveLength(2);
  });

  it("does not mark a miss as a goal (isGoal = i < scored only)", function (): void {
    // taken=2, scored=1 — i=0 is a goal, i=1 is a miss
    render(<KickRow label="Away" taken={2} scored={1} maxRounds={5} />);
    expect(screen.getAllByText("⚽")).toHaveLength(1);
    expect(screen.getAllByText("✗")).toHaveLength(1);
    expect(screen.getAllByText("?")).toHaveLength(3);
  });

  it("expands cells beyond maxRounds when taken exceeds it", function (): void {
    render(<KickRow label="Home" taken={7} scored={4} maxRounds={5} />);
    expect(screen.getAllByText("⚽")).toHaveLength(4);
    expect(screen.getAllByText("✗")).toHaveLength(3);
    expect(screen.queryAllByText("?")).toHaveLength(0);
  });

  it("draws each kick in the order recorded by the shootout events", function (): void {
    const eventDrivenProps = {
      label: "Home FC",
      side: "Home" as const,
      events,
      // The counts deliberately describe the same totals while hiding the
      // scored-missed-scored order that the event log preserves.
      taken: 3,
      scored: 2,
      maxRounds: 5,
    };
    render(<KickRow {...eventDrivenProps} />);

    expect(
      screen
        .queryAllByRole("img", { name: /team=Home FC/ })
        .map((cell) => cell.getAttribute("aria-label")),
    ).toEqual([
      "match.shootout.kickScored(n=1,team=Home FC)",
      "match.shootout.kickMissed(n=2,team=Home FC)",
      "match.shootout.kickScored(n=3,team=Home FC)",
      "match.shootout.kickPending(n=4,team=Home FC)",
      "match.shootout.kickPending(n=5,team=Home FC)",
    ]);
  });

  it("gives scored, missed, and future kick cells a text alternative", function (): void {
    const eventDrivenProps = {
      label: "Home FC",
      side: "Home" as const,
      events: events.slice(0, 3),
      taken: 2,
      scored: 1,
      maxRounds: 3,
    };
    render(<KickRow {...eventDrivenProps} />);

    expect({
      scored:
        screen.queryByRole("img", {
          name: "match.shootout.kickScored(n=1,team=Home FC)",
        }) !== null,
      missed:
        screen.queryByRole("img", {
          name: "match.shootout.kickMissed(n=2,team=Home FC)",
        }) !== null,
      pending:
        screen.queryByRole("img", {
          name: "match.shootout.kickPending(n=3,team=Home FC)",
        }) !== null,
    }).toEqual({ scored: true, missed: true, pending: true });
  });
});

describe("PenaltyShootoutScreen matchday shell", () => {
  it("puts the teams, running score, and round in the header without losing the kick feed", () => {
    renderShootout();

    const header = screen.getByRole("banner", {
      name: "National Cup · Semi-final",
    });
    const headerText = header.textContent ?? "";
    const shellText = header.parentElement?.textContent ?? "";

    expect({
      headerHomeTeam: headerText.includes("Home FC"),
      headerAwayTeam: headerText.includes("Away FC"),
      headerHomeScore: headerText.includes("2"),
      headerAwayScore: headerText.includes("1"),
      headerRound: headerText.includes("match.shootout.round(n=3)"),
      feedHomeGoal: /121'.*Home FC/.test(shellText),
      feedAwayGoal: /122'.*Away FC/.test(shellText),
      feedHomeMiss: /123'.*Home FC/.test(shellText),
      feedAwayMiss: /124'.*Away FC/.test(shellText),
      feedLaterHomeGoal: /125'.*Home FC/.test(shellText),
    }).toEqual({
      headerHomeTeam: true,
      headerAwayTeam: true,
      headerHomeScore: true,
      headerAwayScore: true,
      headerRound: true,
      feedHomeGoal: true,
      feedAwayGoal: true,
      feedHomeMiss: true,
      feedAwayMiss: true,
      feedLaterHomeGoal: true,
    });
  });

  it("plays and pauses from the shell header", () => {
    renderShootout();
    const header = screen.getByRole("banner", {
      name: "National Cup · Semi-final",
    });
    const pause = within(header).queryByRole("button", { name: "match.pause" });

    expect(pause).toBeInTheDocument();
    if (!pause) return;
    fireEvent.click(pause);
    const play = within(header).getByRole("button", { name: "match.live" });
    fireEvent.click(play);
    expect(
      within(header).getByRole("button", { name: "match.pause" }),
    ).toBeInTheDocument();
  });

  it("runs the next kick at fast speed from the shell header", async () => {
    renderShootout();
    const header = screen.getByRole("banner", {
      name: "National Cup · Semi-final",
    });
    const fast = within(header).queryByRole("button", { name: "match.fast" });

    expect(fast).toBeInTheDocument();
    if (!fast) return;
    fireEvent.click(fast);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(matchServiceMocks.stepLiveMatch).toHaveBeenCalledWith(1);
  });

  it("steps exactly one kick from the shell header", () => {
    renderShootout();
    const header = screen.getByRole("banner", {
      name: "National Cup · Semi-final",
    });
    const step = within(header).queryByRole("button", {
      name: "match.shootout.stepKick",
    });

    expect(step).toBeInTheDocument();
    if (!step) return;
    fireEvent.click(step);
    expect(matchServiceMocks.stepLiveMatch).toHaveBeenCalledWith(1);
  });
});
