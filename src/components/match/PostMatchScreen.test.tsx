import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PostMatchScreen, { computeGoalSources } from "./PostMatchScreen";
import type { GameStateData } from "../../store/gameStore";
import type { MatchEvent } from "./types";
import { ThemeProvider } from "../../context/ThemeContext";

// The real `invoke` always returns a promise. A bare `vi.fn()` returns
// undefined, which is not what the component is written against — and a mock
// that cannot fail the way production does is worse than no mock.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve(matchStatsFixture)),
}));

const statsRow = (
  player_id: string,
  name: string,
  side: "Home" | "Away",
  overrides: Record<string, number> = {},
) => ({
  player_id,
  name,
  side,
  position: "Forward",
  rating: 7.2,
  minutes_played: 90,
  goals: 0,
  assists: 0,
  shots: 2,
  shots_on_target: 1,
  passes_completed: 30,
  passes_attempted: 35,
  tackles_won: 1,
  interceptions: 2,
  fouls_committed: 0,
  xg: 0.21,
  xa: 0.08,
  xt: 0.44,
  distance_km: 10.2,
  ...overrides,
});

const matchStatsFixture = {
  home_xg: 1.84,
  away_xg: 0.92,
  home_shots: 14,
  away_shots: 8,
  home_shots_on_target: 6,
  away_shots_on_target: 3,
  home_fouls: 11,
  away_fouls: 13,
  home_corners: 6,
  away_corners: 3,
  home_pass_accuracy: 84.2,
  away_pass_accuracy: 79.5,
  players: [
    statsRow("p1", "Haaland", "Home", { goals: 2, rating: 8.6 }),
    statsRow("p2", "Mbappe", "Away", { goals: 1, rating: 7.8 }),
  ],
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: dark)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "schedule.matchday") {
        return `Matchday ${params?.number}`;
      }
      if (key === "match.otherMatches") {
        return "Other Matches";
      }
      if (key === "match.otherMatchesToday") {
        return "Other Matches Today";
      }
      if (key === "match.otherMatchesUnavailable") {
        return "Other match context unavailable for this fixture yet.";
      }
      if (key === "match.viewDetails") {
        return "View details";
      }
      if (key === "match.matchDetails") {
        return "Match Details";
      }
      if (key === "common.close") {
        return "Close";
      }
      if (key === "match.roundSummaryUnavailable") {
        return "Round summary unavailable.";
      }
      if (key === "match.roundSummary") {
        return "Round Summary";
      }
      if (key === "home.leagueTable") {
        return "League Table";
      }
      if (key === "home.topScorers") {
        return "Top Scorers";
      }
      if (key === "home.noGoals") {
        return "No goals scored yet.";
      }
      if (key === "common.none") {
        return "None";
      }
      if (params?.team) {
        return `${key}:${params.team}`;
      }
      return key;
    },
  }),
}));

function makeSnapshot() {
  return {
    phase: "FullTime",
    current_minute: 90,
    home_score: 2,
    away_score: 1,
    possession: "Home" as const,
    ball_zone: "Midfield",
    home_team: {
      id: "team1",
      name: "Alpha FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [
        {
          id: "p1",
          name: "Alice",
          position: "Forward",
          ovr: 70,
          condition: 90,
          pace: 70,
          stamina: 70,
          strength: 70,
          agility: 70,
          passing: 70,
          shooting: 70,
          tackling: 40,
          dribbling: 70,
          defending: 40,
          positioning: 70,
          vision: 70,
          decisions: 70,
          composure: 70,
          aggression: 50,
          teamwork: 70,
          leadership: 60,
          handling: 20,
          reflexes: 20,
          aerial: 50,
          traits: [],
          role: "Standard",
        },
      ],
    },
    away_team: {
      id: "team2",
      name: "Beta FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [
        {
          id: "p2",
          name: "Bob",
          position: "Forward",
          ovr: 70,
          condition: 90,
          pace: 70,
          stamina: 70,
          strength: 70,
          agility: 70,
          passing: 70,
          shooting: 70,
          tackling: 40,
          dribbling: 70,
          defending: 40,
          positioning: 70,
          vision: 70,
          decisions: 70,
          composure: 70,
          aggression: 50,
          teamwork: 70,
          leadership: 60,
          handling: 20,
          reflexes: 20,
          aerial: 50,
          traits: [],
          role: "Standard",
        },
      ],
    },
    home_bench: [],
    away_bench: [],
    home_possession_pct: 52,
    away_possession_pct: 48,
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
    home_xg: 1.84,
    away_xg: 0.92,
  };
}

function makeGameState() {
  return {
    clock: {
      current_date: "2026-08-01",
      start_date: "2026-08-01",
    },
    manager: {
      id: "mgr1",
      first_name: "Alex",
      last_name: "Manager",
      date_of_birth: "1980-01-01",
      nationality: "GB",
      reputation: 50,
      satisfaction: 50,
      fan_approval: 50,
      team_id: "team1",
      career_stats: {
        matches_managed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        trophies: 0,
        best_finish: null,
      },
      career_history: [],
    },
    teams: [
      {
        id: "team1",
        name: "Alpha FC",
        short_name: "ALP",
        country: "England",
        city: "Alpha",
        stadium_name: "Alpha Park",
        stadium_capacity: 20000,
        finance: 1000000,
        manager_id: "mgr1",
        reputation: 50,
        wage_budget: 100000,
        transfer_budget: 500000,
        season_income: 0,
        season_expenses: 0,
        formation: "4-4-2",
        play_style: "Balanced",
        training_focus: "Physical",
        training_intensity: "Medium",
        training_schedule: "Balanced",
        founded_year: 1900,
        colors: { primary: "#00ff00", secondary: "#ffffff" },
        starting_xi_ids: [],
        match_roles: {
          captain: null,
          vice_captain: null,
          penalty_taker: null,
          free_kick_taker: null,
          corner_taker: null,
        },
        form: ["W", "W", "D"],
        history: [],
      },
      {
        id: "team2",
        name: "Beta FC",
        short_name: "BET",
        country: "England",
        city: "Beta",
        stadium_name: "Beta Park",
        stadium_capacity: 20000,
        finance: 1000000,
        manager_id: null,
        reputation: 50,
        wage_budget: 100000,
        transfer_budget: 500000,
        season_income: 0,
        season_expenses: 0,
        formation: "4-4-2",
        play_style: "Balanced",
        training_focus: "Physical",
        training_intensity: "Medium",
        training_schedule: "Balanced",
        founded_year: 1900,
        colors: { primary: "#0000ff", secondary: "#ffffff" },
        starting_xi_ids: [],
        match_roles: {
          captain: null,
          vice_captain: null,
          penalty_taker: null,
          free_kick_taker: null,
          corner_taker: null,
        },
        form: ["L", "D", "W"],
        history: [],
      },
    ],
    players: [
      {
        id: "p1",
        match_name: "Alice",
        full_name: "Alice Forward",
        date_of_birth: "2000-01-01",
        nationality: "GB",
        position: "Forward",
        natural_position: "Forward",
        alternate_positions: [],
        training_focus: null,
        attributes: {
          pace: 70,
          stamina: 70,
          strength: 70,
          agility: 70,
          passing: 70,
          shooting: 70,
          tackling: 40,
          dribbling: 70,
          defending: 40,
          positioning: 70,
          vision: 70,
          decisions: 70,
          composure: 70,
          aggression: 50,
          teamwork: 70,
          leadership: 60,
          handling: 20,
          reflexes: 20,
          aerial: 50,
        },
        condition: 90,
        morale: 70,
        injury: null,
        team_id: "team1",
        contract_end: null,
        wage: 10000,
        market_value: 1000000,
        stats: {
          appearances: 0,
          goals: 0,
          assists: 0,
          clean_sheets: 0,
          avg_rating: 0,
          minutes_played: 0,
          yellow_cards: 0,
          red_cards: 0,
        },
        form: [],
        personality: null,
        morale_core: {
          base: 70,
          confidence: 70,
          manager_trust: 70,
          happiness: 70,
          pending_promise: null,
          unresolved_issue: null,
          last_playing_time_concern: null,
        },
      },
      {
        id: "p2",
        match_name: "Bob",
        full_name: "Bob Forward",
        date_of_birth: "2000-01-01",
        nationality: "GB",
        position: "Forward",
        natural_position: "Forward",
        alternate_positions: [],
        training_focus: null,
        attributes: {
          pace: 70,
          stamina: 70,
          strength: 70,
          agility: 70,
          passing: 70,
          shooting: 70,
          tackling: 40,
          dribbling: 70,
          defending: 40,
          positioning: 70,
          vision: 70,
          decisions: 70,
          composure: 70,
          aggression: 50,
          teamwork: 70,
          leadership: 60,
          handling: 20,
          reflexes: 20,
          aerial: 50,
        },
        condition: 90,
        morale: 70,
        injury: null,
        team_id: "team2",
        contract_end: null,
        wage: 10000,
        market_value: 1000000,
        stats: {
          appearances: 0,
          goals: 0,
          assists: 0,
          clean_sheets: 0,
          avg_rating: 0,
          minutes_played: 0,
          yellow_cards: 0,
          red_cards: 0,
        },
        form: [],
        personality: null,
        morale_core: {
          base: 70,
          confidence: 70,
          manager_trust: 70,
          happiness: 70,
          pending_promise: null,
          unresolved_issue: null,
          last_playing_time_concern: null,
        },
      },
    ],
    staff: [],
    messages: [],
    news: [],
    league: null,
    scouting_assignments: [],
    board_objectives: [],
  } as unknown as GameStateData;
}

describe("PostMatchScreen", function (): void {
  it("renders the Team Talk tab by default for a manager", function (): void {
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={makeSnapshot()}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide="Home"
          isSpectator={false}
          importantEvents={[]}
          onContinue={() => {}}
          onFinish={() => {}}
        />
      </ThemeProvider>,
    );

    expect(
      screen.getAllByText("match.postMatchTeamTalk").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("match.matchReport")).toBeInTheDocument();
    expect(screen.getByText("match.playerRatings")).toBeInTheDocument();
  });

  it("switches to Match Report tab and shows scorers section", function (): void {
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={makeSnapshot()}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide="Home"
          isSpectator={false}
          importantEvents={[]}
          onContinue={() => {}}
          onFinish={() => {}}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText("match.matchReport"));

    expect(screen.getByText("match.scorers")).toBeInTheDocument();
    expect(screen.getByText("match.quickStats")).toBeInTheDocument();
  });

  it("renders Match Report tab by default for a spectator", function (): void {
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={makeSnapshot()}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide={null}
          isSpectator={true}
          importantEvents={[]}
          onContinue={() => {}}
          onFinish={() => {}}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("match.scorers")).toBeInTheDocument();
  });

  it("calls onContinue when manager clicks Continue", function (): void {
    const onContinue = vi.fn();
    const onFinish = vi.fn();
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={makeSnapshot()}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide="Home"
          isSpectator={false}
          importantEvents={[]}
          onContinue={onContinue}
          onFinish={onFinish}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText("match.continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("calls onFinish when spectator clicks Continue to Dashboard", function (): void {
    const onContinue = vi.fn();
    const onFinish = vi.fn();
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={makeSnapshot()}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide={null}
          isSpectator={true}
          importantEvents={[]}
          onContinue={onContinue}
          onFinish={onFinish}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText("match.continueDashboard"));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("resolves a level score via the shootout and shows the pens score", function (): void {
    // Regression: shootout kicks used to be folded into the match score, so a
    // 1-1 tie won on penalties displayed as 5-4 and the verdict came from the
    // inflated score. Now the score stays level and the shootout decides.
    const snapshot = {
      ...makeSnapshot(),
      home_score: 1,
      away_score: 1,
      penalty_shootout: {
        home_taken: 6,
        away_taken: 6,
        home_scored: 5,
        away_scored: 4,
        sudden_death: true,
      },
    };
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={snapshot}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide="Home"
          isSpectator={false}
          importantEvents={[]}
          onContinue={() => {}}
          onFinish={() => {}}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("match.victory")).toBeInTheDocument();
    expect(screen.queryByText("match.draw")).not.toBeInTheDocument();
    expect(screen.getByText(/match\.pen 5–4/)).toBeInTheDocument();
  });

  it("keeps a level score without a shootout as a draw", function (): void {
    const snapshot = {
      ...makeSnapshot(),
      home_score: 1,
      away_score: 1,
    };
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={snapshot}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide="Home"
          isSpectator={false}
          importantEvents={[]}
          onContinue={() => {}}
          onFinish={() => {}}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("match.draw")).toBeInTheDocument();
    expect(screen.queryByText("match.victory")).not.toBeInTheDocument();
    expect(screen.queryByText(/match\.pen \d/)).not.toBeInTheDocument();
  });

  it("shows a defeat verdict when the user loses the shootout", function (): void {
    const snapshot = {
      ...makeSnapshot(),
      home_score: 1,
      away_score: 1,
      penalty_shootout: {
        home_taken: 5,
        away_taken: 5,
        home_scored: 3,
        away_scored: 4,
        sudden_death: false,
      },
    };
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={snapshot}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide="Home"
          isSpectator={false}
          importantEvents={[]}
          onContinue={() => {}}
          onFinish={() => {}}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("match.defeat")).toBeInTheDocument();
  });

  it("calls onFinish when manager clicks Skip", function (): void {
    const onContinue = vi.fn();
    const onFinish = vi.fn();
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={makeSnapshot()}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide="Home"
          isSpectator={false}
          importantEvents={[]}
          onContinue={onContinue}
          onFinish={onFinish}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText("match.skip"));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// computeGoalSources unit tests
// ---------------------------------------------------------------------------

function makeEvent(
  event_type: string,
  side: "Home" | "Away",
  zone = "Midfield",
): MatchEvent {
  return { minute: 1, event_type, side, zone, player_id: null, secondary_player_id: null };
}

describe("computeGoalSources", function (): void {
  it("counts open-play goals", function (): void {
    const events: MatchEvent[] = [makeEvent("Goal", "Home")];
    expect(computeGoalSources(events, "Home")).toEqual({
      openPlay: 1, corners: 0, freekicks: 0, penalties: 0,
    });
  });

  it("counts corner goals for the correct side only", function (): void {
    // Away earns a corner, but Home scores — should be open play for Home, not corner
    const events: MatchEvent[] = [
      makeEvent("Corner", "Away"),
      makeEvent("Goal", "Home"),
    ];
    expect(computeGoalSources(events, "Home")).toEqual({
      openPlay: 1, corners: 0, freekicks: 0, penalties: 0,
    });
    // Away scoring after their own corner is a corner goal
    const events2: MatchEvent[] = [
      makeEvent("Corner", "Away"),
      makeEvent("Goal", "Away"),
    ];
    expect(computeGoalSources(events2, "Away")).toEqual({
      openPlay: 0, corners: 1, freekicks: 0, penalties: 0,
    });
  });

  it("only counts attacking-third free kicks as set-piece windows", function (): void {
    // Home FK in HomeDefense (their own third) should NOT open a set-piece window
    const defensive = makeEvent("FreeKick", "Home", "HomeDefense");
    const goal = makeEvent("Goal", "Home");
    expect(computeGoalSources([defensive, goal], "Home")).toEqual({
      openPlay: 1, corners: 0, freekicks: 0, penalties: 0,
    });
    // Home FK in AwayDefense (their attacking third) SHOULD open a window
    const attacking = makeEvent("FreeKick", "Home", "AwayDefense");
    expect(computeGoalSources([attacking, goal], "Home")).toEqual({
      openPlay: 0, corners: 0, freekicks: 1, penalties: 0,
    });
  });

  it("clears the set-piece window on defensive events", function (): void {
    const events: MatchEvent[] = [
      makeEvent("Corner", "Home"),
      makeEvent("Clearance", "Away"),
      makeEvent("Goal", "Home"),
    ];
    expect(computeGoalSources(events, "Home")).toEqual({
      openPlay: 1, corners: 0, freekicks: 0, penalties: 0,
    });
  });

  it("counts penalty goals", function (): void {
    const events: MatchEvent[] = [makeEvent("PenaltyGoal", "Home")];
    expect(computeGoalSources(events, "Home")).toEqual({
      openPlay: 0, corners: 0, freekicks: 0, penalties: 1,
    });
  });
});

describe("PostMatchScreen player ratings", () => {
  const showRatings = async () => {
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={makeSnapshot()}
          matchStats={matchStatsFixture}
          gameState={makeGameState()}
          userSide="Home"
          isSpectator={false}
          importantEvents={[]}
          onContinue={() => {}}
          onFinish={() => {}}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "match.playerRatings" }));
    // Queried by role on purpose: the point of this panel is that it is a
    // table with named columns, and a text query would still pass if it were
    // reverted to a grid of divs.
    // eslint-disable-next-line no-console
    return await screen.findByRole("table", { name: /match\.ratings.*Alpha/ });
  };

  it("shows the rating the engine computed, not one derived in the browser", async () => {
    const table = await showRatings();
    // 8.6 comes from the fixture, i.e. from the backend. The panel this
    // replaced recomputed ratings from the event log and could not have
    // produced it — and the engine's is the number that moves squad morale.
    const row = within(table).getByRole("rowheader", { name: /Haaland/ });
    expect(within(row.closest("tr")!).getByText("8.6")).toBeInTheDocument();
  });

  it("gives every column a header a screen reader can read", async () => {
    const table = await showRatings();
    for (const name of [
      "match.statTable.player",
      "match.statTable.rating",
      "match.statTable.goalsShort",
      "match.statTable.xg",
      "match.statTable.xa",
      "match.statTable.distance",
    ]) {
      expect(
        within(table).getByRole("columnheader", { name }),
      ).toBeInTheDocument();
    }
  });

  it("shows expected goals and assists per player", async () => {
    const table = await showRatings();
    const row = within(table).getByRole("rowheader", { name: /Haaland/ }).closest("tr")!;
    expect(within(row).getByText("0.21")).toBeInTheDocument();
    expect(within(row).getByText("0.08")).toBeInTheDocument();
  });

  it("marks distance covered as an estimate", async () => {
    await showRatings();
    // Derived from role and stamina; it must never read as measured.
    expect(
      screen.getAllByText("match.statTable.distanceFootnote").length,
    ).toBeGreaterThan(0);
  });

  it("keeps a player who is no longer in the eleven", async () => {
    // The backend resolves names and sides, so someone substituted off still
    // has a row — a join against the current XI would silently drop him.
    await showRatings();
    const away = screen.getByRole("table", { name: /match\.ratings.*Beta/ });
    expect(
      within(away).getByRole("rowheader", { name: /Mbappe/ }),
    ).toBeInTheDocument();
  });

  it("never asks the backend, because by now there is nothing to ask", async () => {
    // The regression this guards. Finishing the match consumes the live
    // session — `MatchSimulation` calls `finish_live_match` before this screen
    // mounts — so a component that fetched its own statistics here got
    // `noActiveLiveMatch` every time and told the user the match it had just
    // played was unavailable. The figures ride along on the finalize response
    // instead, and this asserts no request is made at all.
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();
    await showRatings();
    expect(invoke).not.toHaveBeenCalledWith("get_match_stats");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says it is loading rather than claiming the stats are gone", () => {
    // `undefined` is the window between the final whistle and the finalize
    // call returning. Collapsing it with `null` told the user their statistics
    // no longer existed, seconds after they had played the match.
    render(
      <ThemeProvider>
        <PostMatchScreen
          snapshot={makeSnapshot()}
          matchStats={undefined}
          gameState={makeGameState()}
          userSide="Home"
          isSpectator={false}
          importantEvents={[]}
          onContinue={() => {}}
          onFinish={() => {}}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "match.playerRatings" }));
    expect(screen.getByText("match.statTable.loading")).toBeInTheDocument();
    expect(
      screen.queryByText("match.statTable.unavailable"),
    ).not.toBeInTheDocument();
  });
});
