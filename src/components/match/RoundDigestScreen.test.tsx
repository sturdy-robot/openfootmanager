import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RoundDigestScreen from "./RoundDigestScreen";
import type { GameStateData } from "../../store/gameStore";
import type { MatchSnapshot, RoundSummary } from "./types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "schedule.matchday") return `Matchday ${params?.number}`;
      if (key === "match.assist") return `assist: ${params?.name}`;
      if (key === "match.subFor") return `for ${params?.name}`;
      return key;
    },
  }),
}));

vi.mock("../ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TeamLogo: ({ team }: { team: { name?: string; short_name?: string } }) => (
    <span>{team?.short_name ?? team?.name}</span>
  ),
  // The shared matchday shell owns the theme control now, so this mock has to
  // cover it even though the digest itself never renders one.
  ThemeToggle: () => <button type="button">theme</button>,
}));

vi.mock("./PostMatchHelpers", () => ({
  QuickStat: ({
    label,
    home,
    away,
  }: {
    label: string;
    home: string | number;
    away: string | number;
  }) => (
    <div>
      {label}: {home} – {away}
    </div>
  ),
}));

vi.mock("./helpers", () => ({
  getEventDisplay: () => ({ icon: "⚽", color: "text-green-500" }),
  makeTeamFallback: (name: string) => ({ name, short_name: name.slice(0, 3) }),
}));

function makeSnapshot(): MatchSnapshot {
  return {
    phase: "FullTime",
    current_minute: 90,
    home_score: 2,
    away_score: 1,
    possession: "Home",
    ball_zone: "Midfield",
    home_team: {
      id: "team1",
      name: "Alpha FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [],
    },
    away_team: {
      id: "team2",
      name: "Beta FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [],
    },
    home_bench: [],
    away_bench: [],
    home_possession_pct: 55,
    away_possession_pct: 45,
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

function makeGameState(): GameStateData {
  return {
    clock: { current_date: "2026-08-10", start_date: "2026-08-01" },
    manager: {
      id: "mgr1",
      first_name: "Test",
      last_name: "Manager",
      date_of_birth: "1980-01-01",
      nationality: "GB",
      reputation: 50,
      satisfaction: 50,
      fan_approval: 50,
      team_id: "team1",
      career_stats: {
        matches_managed: 1,
        wins: 1,
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
        training_focus: "General",
        training_intensity: "Balanced",
        training_schedule: "Balanced",
        founded_year: 1900,
        colors: { primary: "#00ff00", secondary: "#ffffff" },
        starting_xi_ids: [],
        form: [],
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
        training_focus: "General",
        training_intensity: "Balanced",
        training_schedule: "Balanced",
        founded_year: 1900,
        colors: { primary: "#0000ff", secondary: "#ffffff" },
        starting_xi_ids: [],
        form: [],
        history: [],
      },
      {
        id: "team3",
        name: "Gamma FC",
        short_name: "GAM",
        country: "England",
        city: "Gamma",
        stadium_name: "Gamma Park",
        stadium_capacity: 20000,
        finance: 1000000,
        manager_id: null,
        reputation: 60,
        wage_budget: 100000,
        transfer_budget: 500000,
        season_income: 0,
        season_expenses: 0,
        formation: "4-4-2",
        play_style: "Balanced",
        training_focus: "General",
        training_intensity: "Balanced",
        training_schedule: "Balanced",
        founded_year: 1900,
        colors: { primary: "#ff0000", secondary: "#ffffff" },
        starting_xi_ids: [],
        form: [],
        history: [],
      },
    ],
    players: [],
    staff: [],
    messages: [],
    news: [],
    league: {
      id: "league1",
      name: "Test League",
      fixtures: [
        {
          id: "fix2",
          competition: "League" as const,
          home_team_id: "team3",
          away_team_id: "team2",
          date: "2026-08-10",
          status: "Completed" as const,
          result: {
            home_goals: 3,
            away_goals: 0,
            home_scorers: [],
            away_scorers: [],
            report: null,
          },
          round: 1,
          matchday: 1,
        },
      ],
    },
    scouting_assignments: [],
    board_objectives: [],
  } as unknown as GameStateData;
}

function makeRoundSummary(): RoundSummary {
  return {
    matchday: 1,
    is_complete: true,
    pending_fixture_count: 0,
    completed_results: [
      {
        fixture_id: "fix1",
        home_team_id: "team1",
        home_team_name: "Alpha FC",
        away_team_id: "team2",
        away_team_name: "Beta FC",
        home_goals: 2,
        away_goals: 1,
      },
      {
        fixture_id: "fix2",
        home_team_id: "team3",
        home_team_name: "Gamma FC",
        away_team_id: "team2",
        away_team_name: "Beta FC",
        home_goals: 3,
        away_goals: 0,
      },
    ],
    standings_delta: [
      {
        team_id: "team1",
        team_name: "Alpha FC",
        previous_position: 3,
        current_position: 1,
        points: 3,
        points_delta: 3,
      },
      {
        team_id: "team3",
        team_name: "Gamma FC",
        previous_position: 1,
        current_position: 2,
        points: 3,
        points_delta: 3,
      },
    ],
    top_scorer_delta: [
      {
        player_id: "p1",
        player_name: "Alice",
        team_id: "team1",
        previous_rank: 2,
        current_rank: 1,
        previous_goals: 0,
        current_goals: 1,
      },
    ],
    notable_upset: null,
  };
}

const defaultProps = {
  snapshot: makeSnapshot(),
  gameState: makeGameState(),
  currentFixture: {
    id: "fix1",
    competition: "League" as const,
    home_team_id: "team1",
    away_team_id: "team2",
    date: "2026-08-10",
    status: "Completed" as const,
    result: {
      home_goals: 2,
      away_goals: 1,
      home_scorers: [],
      away_scorers: [],
      report: null,
    },
    round: 1,
    matchday: 1,
  },
  userSide: "Home" as const,
  isLeagueFixture: true,
  roundSummary: makeRoundSummary(),
  onPressConference: vi.fn(),
  onFinish: vi.fn(),
};

const roundDigestSource = readFileSync(
  "src/components/match/RoundDigestScreen.tsx",
  "utf-8",
).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const roundDigestStaticClassNames = [
  ...roundDigestSource.matchAll(/className="([^"]*)"/g),
].map((match) => match[1].split(/\s+/));

describe("RoundDigestScreen bounded frame structure", function () {
  it("bounds the digest body through every shrinking flex link", function () {
    const boundedBodyClasses =
      roundDigestStaticClassNames.find(
        (classes) =>
          classes.includes("flex") &&
          classes.includes("h-full") &&
          classes.includes("min-h-0") &&
          classes.includes("flex-col"),
      ) ?? [];

    expect(
      boundedBodyClasses,
      "the shell body needs a full-height min-h-0 flex column to bound its descendants",
    ).toEqual(
      expect.arrayContaining(["flex", "h-full", "min-h-0", "flex-col"]),
    );
  });

  it("lets the digest content scroll inside its bounded pane", function () {
    const digestScrollerClasses =
      roundDigestStaticClassNames.find(
        (classes) =>
          classes.includes("flex-1") &&
          (classes.includes("overflow-auto") ||
            classes.includes("overflow-y-auto")),
      ) ?? [];

    expect(
      digestScrollerClasses,
      "the flexing digest scroller needs min-h-0 before overflow can contain the fixture list",
    ).toEqual(expect.arrayContaining(["min-h-0", "flex-1"]));
  });
});

describe("RoundDigestScreen", function () {
  it("names the league digest once in the shell header without losing either round fixture", function () {
    render(
      <RoundDigestScreen
        matchdayIdentity={{
          competitionName: "Test League",
          roundLabel: "Matchday 1",
        }}
        {...defaultProps}
      />,
    );

    const banner = screen.getByRole("banner", {
      name: "Test League · Matchday 1",
    });
    const shell = banner.parentElement;
    expect(shell).not.toBeNull();
    expect(shell).toHaveTextContent(
      /Alpha FC[\s\S]*2\s*–\s*1[\s\S]*Beta FC/,
    );
    expect(shell).toHaveTextContent("Gamma FC 3 – 0 Beta FC");

    const summaryHeadings = screen.getAllByRole("heading", {
      name: "match.roundSummary",
    });
    expect(summaryHeadings).toHaveLength(1);
    expect(
      banner,
      "the round-summary heading belongs to MatchdayShell's named header",
    ).toContainElement(summaryHeadings[0]);
  });

  it("names a friendly digest once in the shell header and keeps its empty state", function () {
    const gameState = makeGameState();
    gameState.league!.fixtures = [];

    render(
      <RoundDigestScreen
        matchdayIdentity={{ competitionName: null, roundLabel: "Friendly" }}
        {...defaultProps}
        gameState={gameState}
        isLeagueFixture={false}
        roundSummary={null}
      />,
    );

    const banner = screen.getByRole("banner", { name: "Friendly" });
    expect(banner.parentElement).toHaveTextContent(
      "match.otherMatchesUnavailable",
    );
    const friendlyHeadings = screen.getAllByRole("heading", {
      name: "match.otherMatches",
    });
    expect(
      friendlyHeadings,
      "the friendly stage name must not be repeated in the digest body",
    ).toHaveLength(1);
    expect(banner).toContainElement(friendlyHeadings[0]);
  });

  it("keeps the league-round empty state while naming the stage in the shell header", function () {
    const summary = makeRoundSummary();
    summary.completed_results = summary.completed_results.slice(0, 1);

    render(
      <RoundDigestScreen
        matchdayIdentity={{
          competitionName: "Test League",
          roundLabel: "Matchday 1",
        }}
        {...defaultProps}
        roundSummary={summary}
      />,
    );

    const banner = screen.getByRole("banner", {
      name: "Test League · Matchday 1",
    });
    expect(banner.parentElement).toHaveTextContent(
      "match.roundSummaryUnavailable",
    );
    expect(
      banner,
      "the round-summary heading belongs to MatchdayShell's named header",
    ).toContainElement(
      screen.getByRole("heading", { name: "match.roundSummary" }),
    );
  });

  it("renders the hero result card with score and win badge", function () {
    render(<RoundDigestScreen
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }} {...defaultProps} />);

    expect(screen.getByText("match.yourResult")).toBeInTheDocument();
    expect(screen.getByText("match.victory")).toBeInTheDocument();
    expect(screen.getAllByText("Alpha FC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beta FC").length).toBeGreaterThan(0);
  });

  it("renders the standings and top scorers for a league fixture", function () {
    render(<RoundDigestScreen
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }} {...defaultProps} />);

    expect(screen.getByText("tournaments.leagueTable")).toBeInTheDocument();
    expect(screen.getByText("tournaments.topScorers")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("does not render standings or top scorers for a friendly", function () {
    render(
      <RoundDigestScreen
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
        {...defaultProps}
        isLeagueFixture={false}
        roundSummary={null}
      />,
    );

    expect(
      screen.queryByText("tournaments.leagueTable"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("tournaments.topScorers"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("match.otherMatches").length).toBeGreaterThan(0);
  });

  it("renders position context with points when standings are available", function () {
    render(<RoundDigestScreen
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }} {...defaultProps} />);

    expect(screen.getByText(/match\.pts/)).toBeInTheDocument();
  });

  it("renders the notable upset card when one is present", function () {
    const summary = {
      ...makeRoundSummary(),
      notable_upset: {
        fixture_id: "fix3",
        favorite_team_id: "team3",
        favorite_team_name: "Gamma FC",
        favorite_strength: 80,
        underdog_team_id: "team2",
        underdog_team_name: "Beta FC",
        underdog_strength: 40,
        strength_gap: 40,
        home_goals: 1,
        away_goals: 0,
      },
    };

    render(<RoundDigestScreen
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }} {...defaultProps} roundSummary={summary} />);

    expect(screen.getByText("match.notableUpset")).toBeInTheDocument();
    expect(screen.getAllByText(/Beta FC/).length).toBeGreaterThan(0);
  });

  it("puts both actions in the shell footer without changing their callbacks", function () {
    const onPressConference = vi.fn();
    const onFinish = vi.fn();
    render(
      <RoundDigestScreen
        matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
        {...defaultProps}
        onPressConference={onPressConference}
        onFinish={onFinish}
      />,
    );

    const footer = screen.queryByRole("contentinfo");
    expect(
      footer,
      "the digest actions must be composed into MatchdayShell's footer slot",
    ).not.toBeNull();
    const skip = within(footer as HTMLElement).getByRole("button", {
      name: "match.skip",
    });
    const pressConference = within(footer as HTMLElement).getByRole("button", {
      name: "match.pressConference",
    });

    fireEvent.click(skip);
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onPressConference).not.toHaveBeenCalled();

    fireEvent.click(pressConference);
    expect(onPressConference).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("opens and closes the other-match details modal", function () {
    const gameStateWithReport = {
      ...makeGameState(),
      league: {
        ...makeGameState().league!,
        fixtures: [
          {
            id: "fix2",
            competition: "League" as const,
            home_team_id: "team3",
            away_team_id: "team2",
            date: "2026-08-10",
            status: "Completed" as const,
            result: {
              home_goals: 3,
              away_goals: 0,
              home_scorers: [],
              away_scorers: [],
              report: {
                events: [],
                home_stats: {
                  possession_pct: 60,
                  shots: 10,
                  shots_on_target: 5,
                  fouls: 8,
                  corners: 4,
                  yellow_cards: 1,
                },
                away_stats: {
                  possession_pct: 40,
                  shots: 5,
                  shots_on_target: 2,
                  fouls: 12,
                  corners: 2,
                  yellow_cards: 2,
                },
              },
            },
            round: 1,
            matchday: 1,
          },
        ],
      },
    } as unknown as GameStateData;

    render(
      <RoundDigestScreen
      matchdayIdentity={{ competitionName: null, roundLabel: "Match Day" }}
        {...defaultProps}
        gameState={gameStateWithReport}
      />,
    );

    fireEvent.click(screen.getByText("match.viewDetails"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("match.matchDetails")).toBeInTheDocument();

    fireEvent.click(screen.getByText("common.close"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
