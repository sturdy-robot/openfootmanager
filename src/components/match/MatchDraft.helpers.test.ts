import { describe, expect, it } from "vitest";

import {
  EMPTY_MATCH_DRAFT,
  buildMatchTacticsChangeSet,
  queueLineupChange,
  type MatchDraft,
} from "./MatchDraft.helpers";
import type {
  EnginePlayerData,
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

function player(
  id: string,
  position: string,
  role = "Standard",
): EnginePlayerData {
  return {
    id,
    name: id,
    position,
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
    role,
  } as EnginePlayerData;
}

/** A 4-4-2 XI in slot order, so slot `i` is formation slot `i`. */
function startingEleven(): EnginePlayerData[] {
  return [
    player("gk", "Goalkeeper"),
    player("d1", "Defender"),
    player("d2", "Defender"),
    player("d3", "Defender"),
    player("d4", "Defender"),
    player("m1", "Midfielder"),
    player("m2", "Midfielder"),
    player("m3", "Midfielder"),
    player("m4", "Midfielder"),
    player("f1", "Forward"),
    player("f2", "Forward"),
  ];
}

function snapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    phase: "SecondHalf",
    current_minute: 61,
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
      players: startingEleven(),
    },
    away_team: {
      id: "away",
      name: "Away FC",
      formation: "4-4-2",
      play_style: "Balanced",
      tactics: TACTICS,
      players: startingEleven(),
    },
    home_bench: [player("sub1", "Midfielder"), player("sub2", "Forward")],
    away_bench: [],
    home_possession_pct: 50,
    away_possession_pct: 50,
    events: [],
    home_subs_made: 0,
    away_subs_made: 0,
    max_subs: 5,
    home_set_pieces: {
      captain: "m2",
      corner_taker: "m1",
      free_kick_taker: "m2",
      penalty_taker: "f1",
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

describe("the duties a substitution takes with it", () => {
  it("hands the armband and every set-piece duty to the player coming on", () => {
    // Match creation fills all four duties for any non-empty XI, so this is the
    // ordinary case, not an edge one. The engine refuses an assignment for a
    // player who is no longer on the pitch — and refuses the whole set with it.
    const draft: MatchDraft = {
      ...EMPTY_MATCH_DRAFT,
      lineupChanges: [
        { incomingPlayerId: "sub1", outgoingPlayerId: "m2", slotIndex: 6 },
      ],
    };

    const changes = buildMatchTacticsChangeSet({
      draft,
      side: "Home",
      snapshot: snapshot(),
    });

    expect(changes.assignments).toEqual({
      captain: "sub1",
      corner_taker: "m1",
      free_kick_taker: "sub1",
      penalty_taker: "f1",
    });
  });

  it("leaves the duties alone when nobody is being substituted", () => {
    const changes = buildMatchTacticsChangeSet({
      draft: EMPTY_MATCH_DRAFT,
      side: "Home",
      snapshot: snapshot(),
    });

    expect(changes.assignments).toEqual(snapshot().home_set_pieces);
  });
});

describe("the roles a formation change carries", () => {
  it("keeps a role the new shape still allows", () => {
    const players = startingEleven();
    players[6] = player("m2", "Midfielder", "BoxToBox");

    const changes = buildMatchTacticsChangeSet({
      draft: { ...EMPTY_MATCH_DRAFT, formation: "4-3-3" },
      side: "Home",
      snapshot: snapshot({
        home_team: {
          ...snapshot().home_team,
          players,
        },
      }),
    });

    expect(changes.slot_roles[6]).toBe("BoxToBox");
  });

  it("drops a role the new shape has no slot for", () => {
    // Slot 5 is a left midfielder in 4-4-2 and a holding midfielder in 4-3-3.
    // The engine applies the formation before it validates a single role, so a
    // winger's role left on that slot would have the whole change set refused —
    // substitutions included.
    const players = startingEleven();
    players[5] = player("m1", "Midfielder", "InvertedWinger");

    const changes = buildMatchTacticsChangeSet({
      draft: { ...EMPTY_MATCH_DRAFT, formation: "4-3-3" },
      side: "Home",
      snapshot: snapshot({
        home_team: { ...snapshot().home_team, players },
      }),
    });

    expect(changes.slot_roles[5]).toBe("Standard");
  });

  it("leaves a role alone when the formation is untouched", () => {
    const players = startingEleven();
    players[5] = player("m1", "Midfielder", "InvertedWinger");

    const changes = buildMatchTacticsChangeSet({
      draft: EMPTY_MATCH_DRAFT,
      side: "Home",
      snapshot: snapshot({
        home_team: { ...snapshot().home_team, players },
      }),
    });

    expect(changes.slot_roles[5]).toBe("InvertedWinger");
  });
});

describe("queueing at the substitution limit", () => {
  it("still lets the manager change their mind about a slot already queued", () => {
    const current = snapshot({ home_subs_made: 4, max_subs: 5 });
    const first = queueLineupChange(EMPTY_MATCH_DRAFT, current, "Home", {
      incomingPlayerId: "sub1",
      outgoingPlayerId: "m2",
      slotIndex: 6,
    });

    // The queue now fills the allowance. Choosing a different replacement for
    // the same slot is a correction, not a sixth substitution.
    const corrected = queueLineupChange(first.draft, current, "Home", {
      incomingPlayerId: "sub2",
      outgoingPlayerId: "m2",
      slotIndex: 6,
    });

    expect(corrected.refusedRemaining).toBeUndefined();
    expect(corrected.draft.lineupChanges).toEqual([
      { incomingPlayerId: "sub2", outgoingPlayerId: "m2", slotIndex: 6 },
    ]);
  });

  it("still refuses a substitution in a slot that is not already queued", () => {
    const current = snapshot({ home_subs_made: 4, max_subs: 5 });
    const first = queueLineupChange(EMPTY_MATCH_DRAFT, current, "Home", {
      incomingPlayerId: "sub1",
      outgoingPlayerId: "m2",
      slotIndex: 6,
    });

    const overflow = queueLineupChange(first.draft, current, "Home", {
      incomingPlayerId: "sub2",
      outgoingPlayerId: "f1",
      slotIndex: 9,
    });

    expect(overflow.refusedRemaining).toBe(1);
    expect(overflow.draft.lineupChanges).toHaveLength(1);
  });
});
