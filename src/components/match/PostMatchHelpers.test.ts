import { describe, expect, it } from "vitest";

import { buildPerformanceScores } from "./PostMatchHelpers.scores";
import type {
  EnginePlayerData,
  MatchEvent,
  MatchSnapshot,
  TacticsConfig,
} from "./types";

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

function player(id: string): EnginePlayerData {
  return {
    id,
    name: id,
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
  } as EnginePlayerData;
}

function event(overrides: Partial<MatchEvent>): MatchEvent {
  return {
    minute: 10,
    event_type: "Goal",
    side: "Home",
    zone: "Middle",
    player_id: null,
    secondary_player_id: null,
    ...overrides,
  } as MatchEvent;
}

function snapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    revision: 1,
    phase: "Finished",
    current_minute: 90,
    home_score: 0,
    away_score: 0,
    possession: "Home",
    ball_zone: "Middle",
    home_team: {
      id: "home",
      name: "Home FC",
      formation: "4-4-2",
      play_style: "Balanced",
      tactics: TACTICS,
      players: [player("h1"), player("h2"), player("h3")],
    },
    away_team: {
      id: "away",
      name: "Away FC",
      formation: "4-4-2",
      play_style: "Balanced",
      tactics: TACTICS,
      players: [player("a1")],
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
      captain: null,
      corner_taker: null,
      free_kick_taker: null,
      penalty_taker: null,
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
    ...overrides,
  } as MatchSnapshot;
}

describe("the performance score", () => {
  it("starts every player at the same place", () => {
    // It is derived from match events and nothing else. A player who did
    // nothing the engine recorded has done nothing to move their score, and
    // the number has to say that rather than imply a judgement.
    const scores = buildPerformanceScores(snapshot(), "Home");

    expect(scores.map((entry) => entry.score)).toEqual([6, 6, 6]);
  });

  it("credits the scorer and the assist from the same goal", () => {
    const scores = buildPerformanceScores(
      snapshot({
        events: [
          event({ player_id: "h1", secondary_player_id: "h2" }),
        ],
      }),
      "Home",
    );
    const byId = new Map(scores.map((entry) => [entry.playerId, entry.score]));

    expect(byId.get("h1")).toBeCloseTo(7.2, 5);
    expect(byId.get("h2")).toBeCloseTo(6.7, 5);
    expect(byId.get("h3")).toBe(6);
  });

  it("ignores what the other side did", () => {
    const scores = buildPerformanceScores(
      snapshot({
        events: [event({ side: "Away", player_id: "a1" })],
      }),
      "Home",
    );

    expect(scores.every((entry) => entry.score === 6)).toBe(true);
  });

  it("stays inside one and ten however lopsided the match", () => {
    const goals = Array.from({ length: 20 }, () =>
      event({ player_id: "h1" }),
    );
    const fouls = Array.from({ length: 60 }, () =>
      event({ event_type: "RedCard", player_id: "h2" }),
    );

    const scores = buildPerformanceScores(
      snapshot({ events: [...goals, ...fouls], home_score: 20 }),
      "Home",
    );
    const byId = new Map(scores.map((entry) => [entry.playerId, entry.score]));

    expect(byId.get("h1")).toBe(10);
    expect(byId.get("h2")).toBe(1);
  });

  it("lifts the whole side that won, and only that side", () => {
    const won = buildPerformanceScores(
      snapshot({ home_score: 2, away_score: 1 }),
      "Home",
    );
    const lost = buildPerformanceScores(
      snapshot({ home_score: 2, away_score: 1 }),
      "Away",
    );

    expect(won.every((entry) => entry.score === 6.5)).toBe(true);
    expect(lost.every((entry) => entry.score === 6)).toBe(true);
  });

  it("orders the side by score, best first", () => {
    const scores = buildPerformanceScores(
      snapshot({ events: [event({ player_id: "h3" })] }),
      "Home",
    );

    expect(scores[0].playerId).toBe("h3");
  });

  it("rounds to a tenth, because that is what is shown", () => {
    // Twenty completed passes are worth 0.02 each; without rounding the score
    // arrives as 6.400000000000001 and renders as a number nobody wrote.
    const passes = Array.from({ length: 20 }, () =>
      event({ event_type: "PassCompleted", player_id: "h1" }),
    );
    const scores = buildPerformanceScores(
      snapshot({ events: passes }),
      "Home",
    );
    const byId = new Map(scores.map((entry) => [entry.playerId, entry.score]));

    expect(byId.get("h1")).toBe(6.4);
  });
});
