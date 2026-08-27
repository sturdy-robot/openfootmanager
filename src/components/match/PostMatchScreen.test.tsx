import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PostMatchScreen, { computeGoalSources } from "./PostMatchScreen";
import type { GameStateData } from "../../store/gameStore";
import type { MatchEvent } from "./types";
import { ThemeProvider } from "../../context/ThemeContext";

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
    revision: 0,
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

function renderManagerPostMatch(
  callbacks: { onContinue?: () => void; onFinish?: () => void } = {},
): void {
  render(
    <ThemeProvider>
      <PostMatchScreen
        matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
        snapshot={makeSnapshot()}
        gameState={makeGameState()}
        userSide="Home"
        isSpectator={false}
        importantEvents={[]}
        onContinue={callbacks.onContinue ?? (() => {})}
        onFinish={callbacks.onFinish ?? (() => {})}
      />
    </ThemeProvider>,
  );
}

describe("PostMatchScreen bounded frame structure", function (): void {
  const source = readFileSync(
    "src/components/match/PostMatchScreen.tsx",
    "utf-8",
  ).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const staticClassNames = [...source.matchAll(/className="([^"]*)"/g)].map(
    (match) => match[1].split(/\s+/),
  );

  it("bounds the post-match column through every shrinking flex link", function (): void {
    const shellBodyClasses = source
      .match(/<MatchdayShell[^>]*>\s*<[a-z][\w-]*\s+className="([^"]*)"/)?.[1]
      .split(/\s+/) ?? [];

    expect(
      shellBodyClasses,
      "the shell body needs a full-height min-h-0 flex column to bound its descendants",
    ).toEqual(expect.arrayContaining(["flex", "h-full", "min-h-0", "flex-col"]));
  });

  it("allows the tab panel scroller to shrink inside the bounded column", function (): void {
    const tabScrollerClasses =
      staticClassNames.find(
        (classes) => classes.includes("flex-1") && classes.includes("overflow-auto"),
      ) ?? [];

    expect(
      tabScrollerClasses,
      "the flexing tab-panel scroll container needs min-h-0 before overflow-auto can contain it",
    ).toEqual(expect.arrayContaining(["min-h-0", "flex-1", "overflow-auto"]));
  });
});

describe("PostMatchScreen", function (): void {
  it("puts the manager exit actions in the shell footer without changing their callbacks", function (): void {
    const onContinue = vi.fn();
    const onFinish = vi.fn();
    renderManagerPostMatch({ onContinue, onFinish });

    const footer = screen.getByRole("contentinfo");
    const skip = within(footer).getByRole("button", { name: "match.skip" });
    const continueButton = within(footer).getByRole("button", {
      name: "match.continue",
    });

    fireEvent.click(skip);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();

    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("puts only the spectator exit action in the shell footer and keeps its callback", function (): void {
    const onContinue = vi.fn();
    const onFinish = vi.fn();
    render(
      <ThemeProvider>
        <PostMatchScreen
          matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={makeSnapshot()}
          gameState={makeGameState()}
          userSide={null}
          isSpectator={true}
          importantEvents={[]}
          onContinue={onContinue}
          onFinish={onFinish}
        />
      </ThemeProvider>,
    );

    const footer = screen.getByRole("contentinfo");
    const dashboard = within(footer).getByRole("button", {
      name: "match.continueDashboard",
    });
    expect(within(footer).queryByRole("button", { name: "match.skip" })).toBeNull();
    expect(within(footer).queryByRole("button", { name: "match.continue" })).toBeNull();

    fireEvent.click(dashboard);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("labels the tablist and links every tab to a panel labelled by that tab", function (): void {
    renderManagerPostMatch();

    const tablist = screen.getByRole("tablist");
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    const tabNames = [
      "match.postMatchTeamTalk",
      "match.matchReport",
      "match.performanceScoresTab",
      "match.tacticsTab",
    ];

    expect(within(tablist).getAllByRole("tab")).toHaveLength(4);
    for (const name of tabNames) {
      const tab = within(tablist).getByRole("tab", { name });
      const controlledPanel = panels.find(
        (panel) => panel.id === tab.getAttribute("aria-controls"),
      );
      expect(controlledPanel, `${name} must control an existing tabpanel`).toBeDefined();
      expect(controlledPanel).toHaveAttribute("aria-labelledby", tab.id);
    }
    // Named for the whole report, not for one of its own tabs: "Match report,
    // tab list" containing "Match report, tab" tells a screen-reader user less
    // than it seems to.
    expect(tablist).toHaveAccessibleName("match.reportSections");
  });

  it("keeps the result, score, and all four panels while roving keyboard focus with selection", function (): void {
    renderManagerPostMatch();

    expect(screen.getByText("match.victory")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);

    const teamTalkTab = screen.getByRole("tab", {
      name: "match.postMatchTeamTalk",
    });
    const matchReportTab = screen.getByRole("tab", { name: "match.matchReport" });
    const performanceScoresTab = screen.getByRole("tab", {
      name: "match.performanceScoresTab",
    });
    const tacticsTab = screen.getByRole("tab", { name: "match.tacticsTab" });

    expect(screen.getByText("match.addressPlayers")).toBeVisible();
    fireEvent.click(matchReportTab);
    expect(screen.getByText("match.scorers")).toBeVisible();
    fireEvent.click(performanceScoresTab);
    expect(screen.getByText("match.performanceScores:Alpha FC")).toBeVisible();
    expect(screen.getAllByText("match.performanceScoreExplainer")[0]).toBeVisible();
    fireEvent.click(tacticsTab);
    expect(screen.getByText("match.goalSources")).toBeVisible();

    expect(tacticsTab).toHaveAttribute("aria-selected", "true");
    expect(tacticsTab.tabIndex).toBe(0);
    for (const inactiveTab of [teamTalkTab, matchReportTab, performanceScoresTab]) {
      expect(inactiveTab).toHaveAttribute("aria-selected", "false");
      expect(inactiveTab.tabIndex).toBe(-1);
    }
  });

  it("renders the Team Talk tab by default for a manager", function (): void {
    render(
      <ThemeProvider>
        <PostMatchScreen
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={makeSnapshot()}
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
    expect(screen.getByText("match.performanceScoresTab")).toBeInTheDocument();
  });

  it("switches to Match Report tab and shows scorers section", function (): void {
    render(
      <ThemeProvider>
        <PostMatchScreen
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={makeSnapshot()}
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
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={makeSnapshot()}
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
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={makeSnapshot()}
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
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={makeSnapshot()}
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
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={snapshot}
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
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={snapshot}
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
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={snapshot}
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
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
          snapshot={makeSnapshot()}
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

describe("PostMatchScreen tab keyboard", function (): void {
  it("moves between report sections with the arrow keys", function (): void {
    // A roving tabindex takes the unselected tabs out of the tab order. That
    // is only an improvement if the arrows put them back within reach —
    // otherwise three of the four sections cannot be reached at all without a
    // pointer, which is worse than the plain buttons that were here before.
    renderManagerPostMatch();

    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabs[1], { key: "End" });
    expect(tabs[tabs.length - 1]).toHaveFocus();

    fireEvent.keyDown(tabs[tabs.length - 1], { key: "ArrowRight" });
    expect(tabs[0], "the ends of a tab list are not walls").toHaveFocus();

    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(tabs[tabs.length - 1]).toHaveFocus();
  });

  it("leaves a key that means nothing here alone", function (): void {
    renderManagerPostMatch();

    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "a" });

    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });
});
