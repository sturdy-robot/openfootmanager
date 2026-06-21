/**
 * Shared test fixture factories for QA testing.
 *
 * These produce minimal but structurally valid objects matching the types the
 * backend returns. Use the `overrides` parameter to customise individual fields
 * without repeating boilerplate in every test file.
 */

import type {
  GameStateData,
  ManagerData,
  PlayerData,
  StaffData,
  TeamData,
} from "../store/types";

// ─── Manager ────────────────────────────────────────────────────────────────

export function makeManager(overrides: Partial<ManagerData> = {}): ManagerData {
  return {
    id: "mgr_user",
    first_name: "QA",
    last_name: "Manager",
    date_of_birth: "1975-01-01",
    nationality: "ENG",
    reputation: 500,
    satisfaction: 50,
    fan_approval: 50,
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

// ─── Team ────────────────────────────────────────────────────────────────────

export function makeTeam(overrides: Partial<TeamData> = {}): TeamData {
  return {
    id: "team-1",
    name: "QA United",
    short_name: "QAU",
    country: "England",
    city: "London",
    stadium_name: "QA Stadium",
    stadium_capacity: 30000,
    finance: 5000000,
    manager_id: "mgr_user",
    reputation: 500,
    wage_budget: 100000,
    transfer_budget: 5000000,
    season_income: 0,
    season_expenses: 0,
    formation: "4-4-2",
    play_style: "Balanced",
    training_focus: "Balanced",
    training_intensity: "Normal",
    training_schedule: "Balanced",
    founded_year: 1900,
    colors: { primary: "#FF0000", secondary: "#FFFFFF" },
    starting_xi_ids: [],
    form: [],
    history: [],
    ...overrides,
  };
}

// ─── Player ──────────────────────────────────────────────────────────────────

const BASE_ATTRIBUTES = {
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
};

const BASE_STATS = {
  appearances: 0,
  goals: 0,
  assists: 0,
  clean_sheets: 0,
  yellow_cards: 0,
  red_cards: 0,
  avg_rating: 0,
  minutes_played: 0,
};

export function makePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    id: "player-1",
    match_name: "Q. Player",
    full_name: "QA Player",
    date_of_birth: "2000-01-01",
    nationality: "ENG",
    position: "Midfielder",
    natural_position: "Midfielder",
    alternate_positions: [],
    training_focus: null,
    attributes: { ...BASE_ATTRIBUTES },
    condition: 100,
    morale: 100,
    injury: null,
    team_id: "team-1",
    retired: false,
    contract_end: "2027-06-30",
    wage: 5000,
    market_value: 500000,
    stats: { ...BASE_STATS },
    career: [],
    transfer_listed: false,
    loan_listed: false,
    transfer_offers: [],
    traits: [],
    ...overrides,
  };
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export function makeStaff(overrides: Partial<StaffData> = {}): StaffData {
  return {
    id: "staff-1",
    first_name: "QA",
    last_name: "Coach",
    date_of_birth: "1970-01-01",
    nationality: "ENG",
    role: "Coach",
    attributes: {
      coaching: 60,
      judging_ability: 60,
      judging_potential: 60,
      physiotherapy: 30,
    },
    team_id: "team-1",
    specialization: null,
    wage: 3000,
    contract_end: "2027-06-30",
    ...overrides,
  };
}

// ─── GameStateData ───────────────────────────────────────────────────────────

export function makeGameState(
  overrides: Partial<GameStateData> = {},
): GameStateData {
  return {
    clock: { current_date: "2026-08-01T00:00:00Z", start_date: "2026-08-01T00:00:00Z" },
    manager: makeManager(),
    teams: [makeTeam()],
    players: [],
    staff: [],
    messages: [],
    news: [],
    league: null,
    scouting_assignments: [],
    board_objectives: [],
    ...overrides,
  };
}
