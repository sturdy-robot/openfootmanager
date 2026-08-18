import { describe, expect, it } from "vitest";

import type { PlayerData, TeamMatchRolesData } from "../../store/gameStore";
import {
  buildUpdatedMatchRolesForAssignment,
  EMPTY_MATCH_ROLES,
  resolveEffectiveMatchRoles,
} from "./TacticsRoles.helpers";

const makePlayer = (
  id: string,
  position: string,
  attributeOverrides: Partial<PlayerData["attributes"]> = {},
): PlayerData => ({
  id,
  match_name: id.toUpperCase(),
  full_name: `Player ${id}`,
  date_of_birth: "1998-01-01",
  nationality: "GB",
  position,
  natural_position: position,
  alternate_positions: [],
  training_focus: null,
  attributes: {
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
    ...attributeOverrides,
  },
  condition: 100,
  morale: 80,
  injury: null,
  team_id: "team1",
  retired: false,
  contract_end: "2027-06-30",
  wage: 1_000,
  market_value: 100_000,
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
});

describe("effective tactics match-role resolution", () => {
  it("returns empty assignments for an empty starting XI", () => {
    expect(resolveEffectiveMatchRoles([])).toEqual(EMPTY_MATCH_ROLES);
  });

  it("preserves stored assignments that still belong to the starting XI", () => {
    const players = [
      makePlayer("captain", "Defender"),
      makePlayer("vice", "Midfielder"),
      makePlayer("penalty", "Forward"),
      makePlayer("free-kick", "Midfielder"),
      makePlayer("corner", "Midfielder"),
    ];
    const stored: TeamMatchRolesData = {
      captain: "captain",
      vice_captain: "vice",
      penalty_taker: "penalty",
      free_kick_taker: "free-kick",
      corner_taker: "corner",
    };

    expect(resolveEffectiveMatchRoles(players, stored)).toEqual(stored);
  });

  it("replaces stale assignments and excludes goalkeepers from set pieces", () => {
    const goalkeeper = makePlayer("gk", "Goalkeeper", {
      leadership: 99,
      teamwork: 99,
      passing: 99,
      vision: 99,
      shooting: 99,
      composure: 99,
    });
    const specialist = makePlayer("specialist", "Midfielder", {
      leadership: 80,
      teamwork: 80,
      passing: 85,
      vision: 85,
      shooting: 85,
      composure: 85,
    });
    const other = makePlayer("other", "Defender", {
      leadership: 70,
      teamwork: 70,
    });

    expect(
      resolveEffectiveMatchRoles([goalkeeper, specialist, other], {
        captain: "departed",
        vice_captain: "departed",
        penalty_taker: "departed",
        free_kick_taker: "departed",
        corner_taker: "departed",
      }),
    ).toEqual({
      captain: "gk",
      vice_captain: "specialist",
      penalty_taker: "specialist",
      free_kick_taker: "specialist",
      corner_taker: "specialist",
    });
  });
});

describe("tactics match-role assignment updates", () => {
  it("updates the requested set-piece assignment without changing the others", () => {
    const players = [
      makePlayer("captain", "Defender"),
      makePlayer("vice", "Midfielder"),
      makePlayer("specialist", "Forward"),
    ];
    const current: TeamMatchRolesData = {
      captain: "captain",
      vice_captain: "vice",
      penalty_taker: "vice",
      free_kick_taker: "vice",
      corner_taker: "vice",
    };

    expect(
      buildUpdatedMatchRolesForAssignment(
        current,
        players,
        "penalty_taker",
        "specialist",
      ),
    ).toEqual({
      ...current,
      penalty_taker: "specialist",
    });
  });

  it("keeps captain and vice-captain distinct when either role is reassigned", () => {
    const captain = makePlayer("captain", "Defender", {
      leadership: 90,
      teamwork: 90,
    });
    const vice = makePlayer("vice", "Midfielder", {
      leadership: 80,
      teamwork: 80,
    });
    const third = makePlayer("third", "Forward", {
      leadership: 70,
      teamwork: 70,
    });
    const players = [captain, vice, third];
    const current: TeamMatchRolesData = {
      captain: "captain",
      vice_captain: "vice",
      penalty_taker: "third",
      free_kick_taker: "third",
      corner_taker: "third",
    };

    expect(
      buildUpdatedMatchRolesForAssignment(
        current,
        players,
        "captain",
        "vice",
      ),
    ).toMatchObject({ captain: "vice", vice_captain: "captain" });
    expect(
      buildUpdatedMatchRolesForAssignment(
        current,
        players,
        "vice_captain",
        "captain",
      ),
    ).toMatchObject({ captain: "vice", vice_captain: "captain" });
  });
});
