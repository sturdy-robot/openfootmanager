import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ManagerData, NewsArticle, PlayerData, TeamData } from "../../store/gameStore";
import { NewsCover, PersonPortrait, TeamLogo } from "./EntityMedia";

function makeTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "London FC",
    short_name: "LFC",
    country: "GB",
    city: "London",
    stadium_name: "London Arena",
    stadium_capacity: 50000,
    finance: 0,
    manager_id: "manager-1",
    reputation: 70,
    wage_budget: 0,
    transfer_budget: 0,
    season_income: 0,
    season_expenses: 0,
    formation: "4-4-2",
    play_style: "Balanced",
    training_focus: "Physical",
    training_intensity: "Medium",
    training_schedule: "Balanced",
    founded_year: 1900,
    colors: { primary: "#10b981", secondary: "#0f172a" },
    starting_xi_ids: [],
    form: [],
    history: [],
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id: "player-1",
    match_name: "J. Doe",
    full_name: "John Doe",
    date_of_birth: "2000-01-01",
    nationality: "GB",
    position: "Midfielder",
    natural_position: "Midfielder",
    alternate_positions: [],
    attributes: {
      pace: 70,
      stamina: 70,
      strength: 70,
      agility: 70,
      passing: 70,
      shooting: 70,
      tackling: 70,
      dribbling: 70,
      defending: 70,
      positioning: 70,
      vision: 70,
      decisions: 70,
      composure: 70,
      aggression: 70,
      teamwork: 70,
      leadership: 70,
      handling: 20,
      reflexes: 20,
      aerial: 50,
    },
    condition: 100,
    morale: 100,
    injury: null,
    team_id: "team-1",
    retired: false,
    training_focus: null,
    contract_end: null,
    wage: 0,
    market_value: 0,
    stats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      clean_sheets: 0,
      yellow_cards: 0,
      red_cards: 0,
      avg_rating: 0,
      minutes_played: 0,
    },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: [],
    ...overrides,
  };
}

function makeManager(overrides: Partial<ManagerData> = {}): ManagerData {
  return {
    id: "manager-1",
    first_name: "Jane",
    last_name: "Smith",
    date_of_birth: "1980-01-01",
    nationality: "GB",
    reputation: 80,
    satisfaction: 60,
    fan_approval: 60,
    team_id: "team-1",
    career_stats: {
      matches_managed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      trophies: 0,
      best_finish: null,
    },
    career_history: [],
    ...overrides,
  };
}

describe("EntityMedia", () => {
  it("renders a generated team logo fallback", () => {
    render(<TeamLogo team={makeTeam()} testId="team-logo" className="h-16 w-16" />);

    expect(screen.getByTestId("team-logo")).toBeInTheDocument();
    expect(screen.getByLabelText("London FC")).toBeInTheDocument();
  });

  it("renders a generated person portrait fallback", () => {
    render(
      <PersonPortrait
        id="person-1"
        name="John Doe"
        className="h-16 w-16"
        testId="person-portrait"
      />,
    );

    expect(screen.getByTestId("person-portrait")).toBeInTheDocument();
    expect(screen.getByLabelText("John Doe")).toBeInTheDocument();
  });

  it("derives a match-report news cover from team context", () => {
    const article: NewsArticle = {
      id: "news-1",
      headline: "London FC 2-1 Paris FC",
      body: "A dramatic match report.",
      source: "OFM News",
      date: "2026-08-15",
      category: "MatchReport",
      team_ids: ["team-1", "team-2"],
      player_ids: [],
      match_score: {
        home_team_id: "team-1",
        away_team_id: "team-2",
        home_goals: 2,
        away_goals: 1,
      },
      read: false,
    };

    render(
      <NewsCover
        article={article}
        teams={[makeTeam(), makeTeam({ id: "team-2", name: "Paris FC", short_name: "PFC" })]}
        players={[]}
        managers={[]}
        testId="news-cover"
      />,
    );

    expect(screen.getByTestId("news-cover")).toBeInTheDocument();
    expect(screen.getByText("2–1")).toBeInTheDocument();
  });

  it("derives a player-led news cover from article player ids", () => {
    const article: NewsArticle = {
      id: "news-2",
      headline: "John Doe linked away",
      body: "Transfer talk intensifies.",
      source: "Transfer Desk",
      date: "2026-08-16",
      category: "TransferRumour",
      team_ids: ["team-1"],
      player_ids: ["player-1"],
      match_score: null,
      read: false,
    };

    render(
      <NewsCover
        article={article}
        teams={[makeTeam()]}
        players={[makePlayer()]}
        managers={[makeManager()]}
        testId="player-news-cover"
      />,
    );

    expect(screen.getByTestId("player-news-cover")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });
});
