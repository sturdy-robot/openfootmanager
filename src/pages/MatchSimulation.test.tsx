import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MatchSimulation from "./MatchSimulation";

const navigateMock = vi.fn();
const setGameStateMock = vi.fn();
let locationState: unknown = null;
let gameStoreState: {
  gameState: Record<string, unknown> | null;
  setGameState: typeof setGameStateMock;
};

const matchServiceMocks = vi.hoisted(() => ({
  finishLiveMatch: vi.fn(),
  getMatchSnapshot: vi.fn(),
  startLiveMatch: vi.fn(),
}));

vi.mock("../services/matchService", () => ({
  finishLiveMatch: matchServiceMocks.finishLiveMatch,
  getMatchSnapshot: matchServiceMocks.getMatchSnapshot,
  startLiveMatch: matchServiceMocks.startLiveMatch,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: locationState }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | Record<string, unknown>) => {
      if (key === "common.matchday" && typeof options === "object") {
        return `Matchday ${options.n}`;
      }
      if (key === "season.friendly") return "Friendly";
      if (key === "season.preseasonTournament") return "Pre-season Tournament";
      if (key === "match.matchDay") return "Match Day";
      if (key === "nations.br") return "Brazil";
      if (key === "competitionNames.firstDivision") {
        return "Brazil First Division";
      }
      return typeof options === "string" ? options : key;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("../store/gameStore", () => ({
  useGameStore: () => gameStoreState,
}));

vi.mock("../store/settingsStore", () => ({
  useSettingsStore: () => ({
    settings: { match_speed: "normal" },
  }),
}));

vi.mock("../components/match/PreMatchSetup", () => ({
  default: ({
    snapshot,
    matchdayIdentity,
    onStart,
  }: {
    snapshot: { home_team: { name: string } };
    matchdayIdentity?: { competitionName: string | null; roundLabel: string };
    onStart?: () => void;
  }) => (
    <section aria-label="Pre-match" data-testid="prematch">
      {snapshot.home_team.name}
      {matchdayIdentity && (
        <output aria-label="Matchday identity">
          {[matchdayIdentity.competitionName, matchdayIdentity.roundLabel]
            .filter(Boolean)
            .join(" · ")}
        </output>
      )}
      <button data-testid="prematch-start" onClick={onStart}>
        Start
      </button>
    </section>
  ),
}));

vi.mock("../components/match/MatchLive", () => ({
  default: ({
    snapshot,
    matchdayIdentity,
    preferredSpeed,
    onPreferredSpeedChange,
    onHalfTime,
    onFullTime,
    onPenaltyShootout,
  }: {
    snapshot: { home_team: { name: string } };
    matchdayIdentity?: { competitionName: string | null; roundLabel: string };
    preferredSpeed?: string;
    onPreferredSpeedChange?: (speed: string) => void;
    onHalfTime?: (phase: "HalfTime" | "ExtraTimeHalfTime") => void;
    onFullTime?: () => void;
    onPenaltyShootout?: () => void;
  }) => (
    <section aria-label="Live match" data-testid="match-live-container" data-preferred-speed={preferredSpeed ?? "normal"}>
      {snapshot.home_team.name}
      {matchdayIdentity && (
        <output aria-label="Matchday identity">
          {[matchdayIdentity.competitionName, matchdayIdentity.roundLabel]
            .filter(Boolean)
            .join(" · ")}
        </output>
      )}
      <button data-testid="match-live" onClick={onFullTime}>Full Time</button>
      <button data-testid="match-trigger-halftime" onClick={() => onHalfTime?.("HalfTime")}>Half Time</button>
      <button type="button" onClick={() => onHalfTime?.("ExtraTimeHalfTime")}>Extra-time half-time</button>
      <button type="button" onClick={onPenaltyShootout}>Penalty shootout</button>
      <button data-testid="match-trigger-speed-fast" onClick={() => onPreferredSpeedChange?.("fast")}>Fast</button>
    </section>
  ),
}));

vi.mock("../components/match/HalfTimeBreak", () => ({
  default: ({
    matchdayIdentity,
    onResume,
  }: {
    matchdayIdentity?: { competitionName: string | null; roundLabel: string };
    onResume?: () => void;
  }) => (
    <section aria-label="Half-time" data-testid="halftime">
      {matchdayIdentity && (
        <output aria-label="Matchday identity">
          {[matchdayIdentity.competitionName, matchdayIdentity.roundLabel]
            .filter(Boolean)
            .join(" · ")}
        </output>
      )}
      <button data-testid="halftime-resume" onClick={onResume}>Resume</button>
    </section>
  ),
}));

vi.mock("../components/match/PostMatchScreen", () => ({
  default: ({
    matchdayIdentity,
    onContinue,
    onFinish,
  }: {
    matchdayIdentity?: { competitionName: string | null; roundLabel: string };
    onContinue?: () => void;
    onFinish?: () => void;
  }) => (
    <section aria-label="Post-match">
      {matchdayIdentity && (
        <output aria-label="Matchday identity">
          {[matchdayIdentity.competitionName, matchdayIdentity.roundLabel]
            .filter(Boolean)
            .join(" · ")}
        </output>
      )}
      <button data-testid="postmatch-continue" onClick={onContinue}>
        Continue
      </button>
      <button data-testid="postmatch-finish" onClick={onFinish}>
        Finish Match
      </button>
    </section>
  ),
}));

vi.mock("../components/match/RoundDigestScreen", () => ({
  default: ({
    matchdayIdentity,
    roundSummary,
    isLeagueFixture,
    onPressConference,
    onFinish,
  }: {
    matchdayIdentity?: { competitionName: string | null; roundLabel: string };
    roundSummary?: unknown;
    isLeagueFixture?: boolean;
    onPressConference?: () => void;
    onFinish?: () => void;
  }) => (
    <section aria-label="Round digest">
      {matchdayIdentity && (
        <output aria-label="Matchday identity">
          {[matchdayIdentity.competitionName, matchdayIdentity.roundLabel]
            .filter(Boolean)
            .join(" · ")}
        </output>
      )}
      <div data-testid="digest-round-summary">
        {roundSummary ? JSON.stringify(roundSummary) : "null"}
      </div>
      <div data-testid="digest-is-league">
        {isLeagueFixture ? "true" : "false"}
      </div>
      <button data-testid="digest-press" onClick={onPressConference}>
        Press Conference
      </button>
      <button data-testid="digest-finish" onClick={onFinish}>
        Skip
      </button>
    </section>
  ),
}));

vi.mock("../components/match/PressConference", () => ({
  default: ({
    matchdayIdentity,
  }: {
    matchdayIdentity?: { competitionName: string | null; roundLabel: string };
  }) => (
    <section aria-label="Press conference" data-testid="press">
      {matchdayIdentity && (
        <output aria-label="Matchday identity">
          {[matchdayIdentity.competitionName, matchdayIdentity.roundLabel]
            .filter(Boolean)
            .join(" · ")}
        </output>
      )}
    </section>
  ),
}));

vi.mock("../components/match/PenaltyShootoutScreen", () => ({
  default: ({
    importantEvents,
    matchdayIdentity,
  }: {
    importantEvents: unknown[];
    matchdayIdentity?: { competitionName: string | null; roundLabel: string };
  }) => (
    <section aria-label="Penalty shootout">
      {matchdayIdentity && (
        <output aria-label="Matchday identity">
          {[matchdayIdentity.competitionName, matchdayIdentity.roundLabel]
            .filter(Boolean)
            .join(" · ")}
        </output>
      )}
      <p>{importantEvents.length} events</p>
    </section>
  ),
}));

function makeEnginePlayer(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "p1",
    name: "Player One",
    position: "Goalkeeper",
    condition: 100,
    pace: 50,
    stamina: 50,
    strength: 50,
    agility: 50,
    passing: 50,
    shooting: 50,
    tackling: 50,
    dribbling: 50,
    defending: 50,
    positioning: 50,
    vision: 50,
    decisions: 50,
    composure: 50,
    aggression: 50,
    teamwork: 50,
    leadership: 50,
    handling: 50,
    reflexes: 50,
    aerial: 50,
    traits: [],
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    phase: "PreKickOff",
    current_minute: 0,
    home_score: 0,
    away_score: 0,
    possession: "Home",
    ball_zone: "Midfield",
    home_team: {
      id: "home1",
      name: "Home FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [makeEnginePlayer({ id: "home-p1", name: "Home Keeper" })],
    },
    away_team: {
      id: "away1",
      name: "Away FC",
      formation: "4-4-2",
      play_style: "Balanced",
      players: [makeEnginePlayer({ id: "away-p1", name: "Away Keeper" })],
    },
    home_bench: [],
    away_bench: [],
    home_possession_pct: 50,
    away_possession_pct: 50,
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

function makeGameState(): Record<string, unknown> {
  return {
    clock: {
      current_date: "2026-08-01",
      start_date: "2026-08-01",
    },
    manager: {
      id: "mgr1",
      first_name: "Test",
      last_name: "Manager",
      date_of_birth: "1980-01-01",
      nationality: "GB",
      reputation: 50,
      satisfaction: 50,
      fan_approval: 50,
      team_id: "home1",
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
        id: "home1",
        name: "Home FC",
        short_name: "HOM",
        country: "England",
        city: "Home City",
        stadium_name: "Home Ground",
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
        id: "away1",
        name: "Away FC",
        short_name: "AWY",
        country: "England",
        city: "Away City",
        stadium_name: "Away Ground",
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
    ],
    players: [],
    staff: [],
    messages: [],
    news: [],
    league: null,
    scouting_assignments: [],
    board_objectives: [],
  };
}

function makeGameStateWithFriendly() {
  const base = makeGameState();
  return {
    ...base,
    league: {
      id: "league1",
      name: "Test League",
      fixtures: [
        {
          id: "fix1",
          competition: "Friendly",
          home_team_id: "home1",
          away_team_id: "away1",
          date: "2026-08-01",
          status: "Scheduled",
          result: null,
          round: 1,
          matchday: null,
        },
      ],
      standings: [],
      top_scorers: [],
    },
  };
}

function makeGameStateWithCompetition() {
  const base = makeGameState();
  const league = {
    id: "brazil-1",
    name: "Stored Division Name",
    name_key: "competitionNames.firstDivision",
    season: 2026,
    country_id: "BR",
    fixtures: [
      {
        id: "fix-12",
        competition_id: "brazil-1",
        competition: "League",
        home_team_id: "home1",
        away_team_id: "away1",
        date: "2026-08-19",
        status: "Scheduled",
        result: null,
        matchday: 12,
      },
    ],
    standings: [],
  };

  return {
    ...base,
    competitions: [league],
    league,
  };
}

describe("MatchSimulation", function (): void {
  beforeEach(function resetState(): void {
    matchServiceMocks.finishLiveMatch.mockReset();
    matchServiceMocks.getMatchSnapshot.mockReset();
    matchServiceMocks.startLiveMatch.mockReset();
    navigateMock.mockReset();
    setGameStateMock.mockReset();
    locationState = null;
    gameStoreState = {
      gameState: makeGameState(),
      setGameState: setGameStateMock,
    };
  });

  it("renders the current live snapshot when get_match_snapshot succeeds", async function (): Promise<void> {
    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(makeSnapshot());

    render(<MatchSimulation />);

    await waitFor(function (): void {
      expect(matchServiceMocks.getMatchSnapshot).toHaveBeenCalledWith();
    });

    await waitFor(function (): void {
      expect(screen.getByTestId("prematch")).toHaveTextContent("Home FC");
    });
  });

  it("restores the live match session when no snapshot exists but fixture index is provided", async function (): Promise<void> {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => { });
    try {
      locationState = {
        fixtureIndex: 4,
        mode: "live",
        snapshot: makeSnapshot({
          home_team: {
            id: "home1",
            name: "Boot Snapshot FC",
            formation: "4-4-2",
            play_style: "Balanced",
            players: [makeEnginePlayer({ id: "boot-p1", name: "Boot Keeper" })],
          },
        }),
      };

      matchServiceMocks.getMatchSnapshot.mockRejectedValueOnce(
        new Error("No active live match"),
      );
      matchServiceMocks.startLiveMatch.mockResolvedValueOnce(
        makeSnapshot({
          home_team: {
            id: "home1",
            name: "Restored FC",
            formation: "4-4-2",
            play_style: "Balanced",
            players: [
              makeEnginePlayer({ id: "restore-p1", name: "Restore Keeper" }),
            ],
          },
        }),
      );

      render(<MatchSimulation />);

      await waitFor(function (): void {
        expect(matchServiceMocks.startLiveMatch).toHaveBeenCalledWith({
          allowsExtraTime: false,
          fixtureIndex: 4,
          mode: "live",
          homeTeamId: "home1",
          awayTeamId: "away1",
        });
      });

      expect(screen.getByTestId("prematch")).toHaveTextContent("Restored FC");
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it("moves spectators straight into the live match stage", async function (): Promise<void> {
    locationState = {
      mode: "spectator",
      snapshot: makeSnapshot(),
    };

    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(makeSnapshot());

    render(<MatchSimulation />);

    await waitFor(function (): void {
      expect(screen.getByTestId("match-live-container")).toHaveTextContent("Home FC");
    });
  });

  it("navigates away from postmatch after the finalized game has been stored", async function (): Promise<void> {
    locationState = {
      mode: "spectator",
      snapshot: makeSnapshot(),
    };

    const finishedGame = makeGameState();
    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(makeSnapshot());
    matchServiceMocks.finishLiveMatch.mockResolvedValueOnce({
      game: finishedGame,
      round_summary: {
        matchday: 1,
        is_complete: true,
        pending_fixture_count: 0,
        completed_results: [],
        standings_delta: [],
        notable_upset: null,
        top_scorer_delta: [],
      },
    });

    render(<MatchSimulation />);

    await waitFor(function (): void {
      expect(screen.getByTestId("match-live-container")).toHaveTextContent("Home FC");
    });

    fireEvent.click(screen.getByTestId("match-live"));

    await waitFor(function (): void {
      expect(matchServiceMocks.finishLiveMatch).toHaveBeenCalledWith();
      expect(screen.getByTestId("postmatch-finish")).toBeInTheDocument();
    });

    expect(setGameStateMock).toHaveBeenCalledWith(finishedGame);

    fireEvent.click(screen.getByTestId("postmatch-finish"));

    await waitFor(function (): void {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("finalizes the match on full time and passes the round summary into the digest screen", async function (): Promise<void> {
    locationState = {
      mode: "live",
      snapshot: makeSnapshot(),
    };

    const finishedGame = makeGameState();
    const roundSummary = {
      matchday: 1,
      is_complete: true,
      pending_fixture_count: 0,
      completed_results: [],
      standings_delta: [],
      notable_upset: null,
      top_scorer_delta: [],
    };
    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(makeSnapshot());
    matchServiceMocks.finishLiveMatch.mockResolvedValueOnce({
      game: finishedGame,
      round_summary: roundSummary,
    });

    render(<MatchSimulation />);

    // Manager sees prematch; advance to live match
    await waitFor(function (): void {
      expect(screen.getByTestId("prematch-start")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("prematch-start"));

    await waitFor(function (): void {
      expect(screen.getByTestId("match-live-container")).toHaveTextContent("Home FC");
    });

    fireEvent.click(screen.getByTestId("match-live"));

    await waitFor(function (): void {
      expect(matchServiceMocks.finishLiveMatch).toHaveBeenCalledWith();
      expect(screen.getByTestId("postmatch-finish")).toBeInTheDocument();
    });

    expect(setGameStateMock).toHaveBeenCalledWith(finishedGame);

    // Manager clicks Continue → goes to digest
    fireEvent.click(screen.getByTestId("postmatch-continue"));

    await waitFor(function (): void {
      expect(screen.getByTestId("digest-round-summary")).toBeInTheDocument();
    });

    expect(screen.getByTestId("digest-round-summary")).toHaveTextContent(
      '"matchday":1',
    );

    fireEvent.click(screen.getByTestId("digest-finish"));

    await waitFor(function (): void {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("routes a manager's friendly through digest with isLeagueFixture=false", async function (): Promise<void> {
    locationState = {
      mode: "live",
      fixtureIndex: 0,
      snapshot: makeSnapshot(),
    };

    gameStoreState = {
      gameState: makeGameStateWithFriendly(),
      setGameState: setGameStateMock,
    };

    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(makeSnapshot());
    matchServiceMocks.finishLiveMatch.mockResolvedValueOnce({
      game: makeGameState(),
      round_summary: null,
    });

    render(<MatchSimulation />);

    // Manager sees prematch; click Start to advance to first_half
    await waitFor(function (): void {
      expect(screen.getByTestId("prematch-start")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("prematch-start"));

    await waitFor(function (): void {
      expect(screen.getByTestId("match-live")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("match-live"));

    await waitFor(function (): void {
      expect(screen.getByTestId("postmatch-continue")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("postmatch-continue"));

    await waitFor(function (): void {
      expect(screen.getByTestId("digest-is-league")).toHaveTextContent("false");
    });
  });

  it("preserves user-selected match speed from first half into second half", async function (): Promise<void> {
    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(makeSnapshot());

    render(<MatchSimulation />);

    // Advance to the first-half live match view.
    await waitFor(function (): void {
      expect(screen.getByTestId("prematch-start")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("prematch-start"));

    await waitFor(function (): void {
      expect(screen.getByTestId("match-live-container")).toBeInTheDocument();
    });

    // Initial preferred speed comes from settings ("normal").
    expect(screen.getByTestId("match-live-container")).toHaveAttribute(
      "data-preferred-speed",
      "normal",
    );

    // User selects fast speed during first half.
    fireEvent.click(screen.getByTestId("match-trigger-speed-fast"));

    // Trigger half-time transition.
    fireEvent.click(screen.getByTestId("match-trigger-halftime"));

    await waitFor(function (): void {
      expect(screen.getByTestId("halftime")).toBeInTheDocument();
    });

    // Resume from half-time — advances to second_half stage.
    fireEvent.click(screen.getByTestId("halftime-resume"));

    // The remounted MatchLive for second half must carry the user's preferred speed.
    await waitFor(function (): void {
      expect(screen.getByTestId("match-live-container")).toHaveAttribute(
        "data-preferred-speed",
        "fast",
      );
    });
  });

  it("keeps localized competition and round identity through all five manager stages", async function (): Promise<void> {
    locationState = {
      mode: "live",
      fixtureIndex: 0,
      snapshot: makeSnapshot(),
    };
    gameStoreState = {
      gameState: makeGameStateWithCompetition(),
      setGameState: setGameStateMock,
    };
    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(makeSnapshot());
    matchServiceMocks.finishLiveMatch.mockResolvedValueOnce({
      game: makeGameStateWithCompetition(),
      round_summary: {
        matchday: 12,
        is_complete: true,
        pending_fixture_count: 0,
        completed_results: [],
        standings_delta: [],
        notable_upset: null,
        top_scorer_delta: [],
      },
    });

    render(<MatchSimulation />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Pre-match" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Matchday identity" })).toHaveTextContent(
      "Brazil First Division · Matchday 12",
    );

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Live match" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Matchday identity" })).toHaveTextContent(
      "Brazil First Division · Matchday 12",
    );

    fireEvent.click(screen.getByRole("button", { name: "Full Time" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Post-match" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Matchday identity" })).toHaveTextContent(
      "Brazil First Division · Matchday 12",
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Round digest" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Matchday identity" })).toHaveTextContent(
      "Brazil First Division · Matchday 12",
    );

    fireEvent.click(screen.getByRole("button", { name: "Press Conference" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Press conference" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Matchday identity" })).toHaveTextContent(
      "Brazil First Division · Matchday 12",
    );
  });

  it("shows competition and round identity when a spectator skips pre-match", async function (): Promise<void> {
    locationState = {
      mode: "spectator",
      fixtureIndex: 0,
      snapshot: makeSnapshot(),
    };
    gameStoreState = {
      gameState: makeGameStateWithCompetition(),
      setGameState: setGameStateMock,
    };
    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(makeSnapshot());

    render(<MatchSimulation />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Live match" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Matchday identity" })).toHaveTextContent(
      "Brazil First Division · Matchday 12",
    );
  });

  it("shows only the fixture label for a friendly with no competition to name", async function (): Promise<void> {
    locationState = {
      mode: "live",
      fixtureIndex: 0,
      snapshot: makeSnapshot(),
    };
    gameStoreState = {
      gameState: makeGameStateWithFriendly(),
      setGameState: setGameStateMock,
    };
    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(makeSnapshot());

    render(<MatchSimulation />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Pre-match" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Matchday identity" })).toHaveTextContent(
      "Friendly",
    );
    expect(screen.getByRole("status", { name: "Matchday identity" })).not.toHaveTextContent(
      "Test League",
    );
  });

  it("keeps the identity through extra time and reaches an empty penalty shootout", async function (): Promise<void> {
    locationState = {
      mode: "live",
      fixtureIndex: 0,
      snapshot: makeSnapshot({ allows_extra_time: true, events: [] }),
    };
    gameStoreState = {
      gameState: makeGameStateWithCompetition(),
      setGameState: setGameStateMock,
    };
    matchServiceMocks.getMatchSnapshot.mockResolvedValueOnce(
      makeSnapshot({ allows_extra_time: true, events: [] }),
    );

    render(<MatchSimulation />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Pre-match" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Live match" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Extra-time half-time" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Half-time" })).toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Matchday identity" })).toHaveTextContent(
      "Brazil First Division · Matchday 12",
    );

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Live match" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Penalty shootout" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Penalty shootout" })).toHaveTextContent(
        "0 events",
      );
    });
    expect(screen.getByRole("status", { name: "Matchday identity" })).toHaveTextContent(
      "Brazil First Division · Matchday 12",
    );
  });
});
