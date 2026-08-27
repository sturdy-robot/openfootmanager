import { describe, expect, it } from "vitest";

import { applyMatchStep } from "./MatchStepReducer.helpers";
import type {
  EnginePlayerData,
  MatchEvent,
  MatchSnapshot,
  MatchStepResponse,
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

function player(id: string, condition = 90): EnginePlayerData {
  return {
    id,
    name: id,
    position: "Midfielder",
    condition,
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

function event(minute: number, type = "Goal"): MatchEvent {
  return {
    minute,
    event_type: type,
    side: "Home",
    zone: "Middle",
  } as MatchEvent;
}

function snapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    revision: 10,
    phase: "FirstHalf",
    current_minute: 20,
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
      players: [player("h1"), player("h2")],
    },
    away_team: {
      id: "away",
      name: "Away FC",
      formation: "4-4-2",
      play_style: "Balanced",
      tactics: TACTICS,
      players: [player("a1"), player("a2")],
    },
    home_bench: [],
    away_bench: [],
    home_possession_pct: 50,
    away_possession_pct: 50,
    events: [event(3)],
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

function response(
  overrides: Partial<MatchStepResponse> = {},
): MatchStepResponse {
  return {
    base_revision: 10,
    revision: 11,
    minutes: [
      {
        minute: 21,
        phase: "FirstHalf",
        events: [],
        home_score: 0,
        away_score: 0,
        possession: "Home",
        ball_zone: "Middle",
        is_finished: false,
      },
    ],
    delta: {
      phase: "FirstHalf",
      current_minute: 21,
      home_score: 0,
      away_score: 0,
      possession: "Home",
      ball_zone: "Middle",
      home_possession_pct: 50,
      away_possession_pct: 50,
      conditions: [
        { player_id: "h1", condition: 90 },
        { player_id: "h2", condition: 90 },
        { player_id: "a1", condition: 90 },
        { player_id: "a2", condition: 90 },
      ],
    },
    snapshot: null,
    ...overrides,
  } as MatchStepResponse;
}

function applied(
  current: MatchSnapshot,
  step: MatchStepResponse,
): MatchSnapshot {
  const outcome = applyMatchStep(current, step);
  if (outcome.kind !== "applied") {
    throw new Error(`expected the step to apply, got ${outcome.kind}`);
  }
  return outcome.snapshot;
}

describe("applying a step to the snapshot the client holds", () => {
  it("carries the delta onto the next snapshot", () => {
    const next = applied(
      snapshot(),
      response({
        delta: {
          ...response().delta,
          current_minute: 24,
          home_score: 1,
          possession: "Away",
          ball_zone: "AwayBox",
          home_possession_pct: 61,
          away_possession_pct: 39,
        },
      }),
    );

    expect(next.current_minute).toBe(24);
    expect(next.home_score).toBe(1);
    expect(next.possession).toBe("Away");
    expect(next.ball_zone).toBe("AwayBox");
    expect(next.home_possession_pct).toBe(61);
    expect(next.revision).toBe(11);
  });

  it("appends the minutes' events in order and keeps the ones already held", () => {
    const next = applied(
      snapshot(),
      response({
        minutes: [
          { ...response().minutes[0], minute: 21, events: [event(21)] },
          { ...response().minutes[0], minute: 22, events: [event(22)] },
        ],
      }),
    );

    expect(next.events.map((entry) => entry.minute)).toEqual([3, 21, 22]);
  });

  it("leaves the whole match alone where nothing changed", () => {
    // The point of the protocol: an unchanged sub-object keeps its identity, so
    // a panel that only reads it has something to compare against.
    const current = snapshot();
    const next = applied(current, response());

    expect(next.events).toBe(current.events);
    expect(next.home_team.players[0]).toBe(current.home_team.players[0]);
    expect(next.away_team).toBe(current.away_team);
    expect(next.home_bench).toBe(current.home_bench);
    expect(next.substitutions).toBe(current.substitutions);
  });

  it("renews only the player whose condition moved, and only their side", () => {
    const current = snapshot();
    const next = applied(
      current,
      response({
        delta: {
          ...response().delta,
          conditions: [
            { player_id: "h1", condition: 84 },
            { player_id: "h2", condition: 90 },
            { player_id: "a1", condition: 90 },
            { player_id: "a2", condition: 90 },
          ],
        },
      }),
    );

    expect(next.home_team.players[0].condition).toBe(84);
    expect(next.home_team.players[0]).not.toBe(current.home_team.players[0]);
    expect(next.home_team.players[1]).toBe(current.home_team.players[1]);
    expect(next.home_team).not.toBe(current.home_team);
    expect(next.away_team).toBe(current.away_team);
  });

  it("takes an inlined snapshot whole, without also appending the minutes", () => {
    // A tick that inlines a snapshot is one where something structural moved,
    // and the snapshot's event log already contains that minute's events.
    const inlined = snapshot({
      revision: 11,
      current_minute: 21,
      events: [event(3), event(21)],
      home_subs_made: 1,
    });

    const next = applied(
      snapshot(),
      response({
        minutes: [{ ...response().minutes[0], events: [event(21)] }],
        snapshot: inlined,
      }),
    );

    expect(next).toBe(inlined);
    expect(next.events.map((entry) => entry.minute)).toEqual([3, 21]);
  });
});

describe("when the client and the engine disagree", () => {
  it("takes an inlined snapshot even when it is behind, rather than refetching", () => {
    // The response already carries the whole authoritative match. Asking for
    // another copy of it would be a round trip to fetch what is in hand.
    const inlined = snapshot({ revision: 11, current_minute: 30 });

    const outcome = applyMatchStep(
      snapshot({ revision: 7 }),
      response({ base_revision: 10, revision: 11, snapshot: inlined }),
    );

    expect(outcome).toEqual({ kind: "applied", snapshot: inlined });
  });

  it("asks for a resync rather than guessing", () => {
    const outcome = applyMatchStep(
      snapshot({ revision: 7 }),
      response({ base_revision: 10, revision: 11 }),
    );

    expect(outcome.kind).toBe("desynced");
  });

  it("drops a response that is not ahead of what it already holds", () => {
    // Two requests can be answered out of order; applying the older one twice
    // would rewind the clock and re-append its events.
    const outcome = applyMatchStep(
      snapshot({ revision: 12 }),
      response({ base_revision: 12, revision: 11 }),
    );

    expect(outcome.kind).toBe("ignored");
  });
});
