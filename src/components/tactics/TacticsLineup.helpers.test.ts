import { describe, expect, it } from "vitest";

import { getRolesForPosition } from "../../lib/playerRoles";
import type { PlayerData } from "../../store/gameStore";
import {
  applyLineupSwap,
  buildPitchRows,
  buildPromoteToStartingXi,
  getDeployedPosition,
} from "../squad/SquadTab.helpers";
import {
  buildTacticsRoster,
  canConfirmTacticsLineupSwap,
  getSectionPlayerPosition,
  isPlayerEligibleForTacticsLineup,
  reconcilePendingStartingXiIds,
  resolveTacticsStartingXiIds,
  updateTacticsLineupSelection,
  type TacticsLineupSelection,
} from "./TacticsTab.helpers";

const makePlayer = (
  id: string,
  position: string,
  overrides: Partial<PlayerData> = {},
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
  ...overrides,
});

const EMPTY_SELECTION: TacticsLineupSelection = {
  selectedPlayerId: null,
  selectedPlayerSection: null,
  comparePlayerId: null,
  comparePlayerSection: null,
};

describe("tactics first-team roster eligibility", () => {
  it("excludes youth academy players from the first-team tactics roster", () => {
    const senior = makePlayer("senior", "Forward");
    const youth = makePlayer("youth", "Forward", { squad_role: "Youth" });
    const otherTeam = makePlayer("other", "Forward", { team_id: "team2" });

    expect(buildTacticsRoster([youth, otherTeam, senior], "team1")).toEqual([
      senior,
    ]);
  });

  it("returns an empty roster when no team is assigned", () => {
    expect(buildTacticsRoster([makePlayer("senior", "Forward")], null)).toEqual(
      [],
    );
  });

  it("rejects injured, youth, missing, and injured-youth players from lineup entry", () => {
    expect(isPlayerEligibleForTacticsLineup(makePlayer("fit", "Forward"))).toBe(
      true,
    );
    expect(
      isPlayerEligibleForTacticsLineup(
        makePlayer("injured", "Forward", {
          injury: { name: "Hamstring strain", days_remaining: 7 },
        }),
      ),
    ).toBe(false);
    expect(
      isPlayerEligibleForTacticsLineup(
        makePlayer("youth", "Forward", { squad_role: "Youth" }),
      ),
    ).toBe(false);
    expect(
      isPlayerEligibleForTacticsLineup(
        makePlayer("injured-youth", "Forward", {
          injury: { name: "Ankle sprain", days_remaining: 3 },
          squad_role: "Youth",
        }),
      ),
    ).toBe(false);
    expect(isPlayerEligibleForTacticsLineup(null)).toBe(false);
    expect(isPlayerEligibleForTacticsLineup(undefined)).toBe(false);
  });

  it("does not promote an injured bench player into a vacated XI slot", () => {
    const starter = makePlayer("starter", "Defender");
    const injured = makePlayer("injured", "Defender", {
      injury: { name: "Hamstring strain", days_remaining: 7 },
    });

    expect(
      buildPromoteToStartingXi(
        [starter.id],
        new Map(
          [starter, injured].map((player) => [player.id, player] as const),
        ),
        "1-0-0",
        injured.id,
      ),
    ).toBeNull();
  });
});

describe("tactics starting XI resolution", () => {
  it("uses the optimistic XI while the server still reports the old saved XI", () => {
    const players = [
      makePlayer("gk", "Goalkeeper"),
      ...Array.from({ length: 4 }, (_, index) =>
        makePlayer(`d${index + 1}`, "Defender"),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        makePlayer(`m${index + 1}`, "Midfielder"),
      ),
      makePlayer("f1", "Forward"),
      makePlayer("f2", "Forward"),
      makePlayer("bench", "Defender"),
    ];
    const saved = [
      "gk",
      "d1",
      "d2",
      "d3",
      "d4",
      "m1",
      "m2",
      "m3",
      "m4",
      "f1",
      "f2",
    ];
    const pending = saved.map((id) => (id === "d2" ? "bench" : id));

    expect(
      resolveTacticsStartingXiIds({
        formation: "4-4-2",
        pendingStartingXiIds: pending,
        roster: players,
        savedStartingXiIds: saved,
      }),
    ).toEqual(pending);
    expect(reconcilePendingStartingXiIds(pending, saved)).toEqual(pending);
  });

  it("clears the optimistic XI only when the server acknowledges the same slot order", () => {
    const pending = ["gk", "left", "right"];

    expect(reconcilePendingStartingXiIds(pending, [...pending])).toBeNull();
    expect(
      reconcilePendingStartingXiIds(pending, ["gk", "right", "left"]),
    ).toEqual(pending);
    expect(reconcilePendingStartingXiIds(null, pending)).toBeNull();
  });

  it("does not admit an injured pending player merely because the roster map contains them", () => {
    const healthy = [
      makePlayer("gk", "Goalkeeper"),
      makePlayer("d1", "Defender"),
      makePlayer("m1", "Midfielder"),
      makePlayer("f1", "Forward"),
    ];
    const injured = makePlayer("injured", "Defender", {
      injury: { name: "Hamstring strain", days_remaining: 7 },
    });
    expect(
      resolveTacticsStartingXiIds({
        formation: "1-1-1",
        pendingStartingXiIds: ["gk", "injured"],
        roster: [...healthy, injured],
        savedStartingXiIds: [],
      }),
    ).toEqual(["gk", "d1", "m1", "f1"]);
  });

  it("returns no starters for an empty squad", () => {
    expect(
      resolveTacticsStartingXiIds({
        formation: "4-4-2",
        pendingStartingXiIds: ["missing"],
        roster: [],
        savedStartingXiIds: ["missing"],
      }),
    ).toEqual([]);
  });

  it("caps a pending XI at the formation slot count when the counts disagree", () => {
    const players = [
      makePlayer("gk", "Goalkeeper"),
      makePlayer("d1", "Defender"),
      makePlayer("m1", "Midfielder"),
      makePlayer("f1", "Forward"),
      makePlayer("extra1", "Forward"),
      makePlayer("extra2", "Forward"),
    ];
    const resolved = resolveTacticsStartingXiIds({
      formation: "1-1-1",
      pendingStartingXiIds: ["gk"],
      roster: players,
      savedStartingXiIds: [],
    });

    expect(resolved).toHaveLength(
      buildPitchRows("1-1-1").flatMap((row) => row.positions).length,
    );
  });
});

describe("tactics selection and swap decisions", () => {
  it("selects a starter first and records the second player as the comparison", () => {
    const afterFirstClick = updateTacticsLineupSelection(
      EMPTY_SELECTION,
      "starter",
      "xi",
    );

    expect(afterFirstClick).toEqual({
      selectedPlayerId: "starter",
      selectedPlayerSection: "xi",
      comparePlayerId: null,
      comparePlayerSection: null,
    });
    expect(
      updateTacticsLineupSelection(afterFirstClick, "bench", "bench"),
    ).toEqual({
      selectedPlayerId: "starter",
      selectedPlayerSection: "xi",
      comparePlayerId: "bench",
      comparePlayerSection: "bench",
    });
  });

  it("handles a second click on the selected or compared player without stale compare state", () => {
    const compared: TacticsLineupSelection = {
      selectedPlayerId: "starter",
      selectedPlayerSection: "xi",
      comparePlayerId: "bench",
      comparePlayerSection: "bench",
    };

    expect(updateTacticsLineupSelection(compared, "bench", "bench")).toEqual({
      ...compared,
      comparePlayerId: null,
      comparePlayerSection: null,
    });
    expect(updateTacticsLineupSelection(compared, "starter", "xi")).toEqual({
      selectedPlayerId: "bench",
      selectedPlayerSection: "bench",
      comparePlayerId: null,
      comparePlayerSection: null,
    });
  });

  it("permits healthy bench-to-XI and XI-to-XI swaps and preserves vacated indices", () => {
    const players = [
      makePlayer("starter1", "Defender"),
      makePlayer("starter2", "Defender"),
      makePlayer("bench", "Defender"),
    ];
    const playersById = new Map(players.map((player) => [player.id, player]));
    const currentXiIds = ["starter1", "starter2"];

    expect(
      canConfirmTacticsLineupSwap(currentXiIds, playersById, {
        selectedPlayerId: "bench",
        selectedPlayerSection: "bench",
        comparePlayerId: "starter2",
        comparePlayerSection: "xi",
      }),
    ).toBe(true);
    expect(
      applyLineupSwap(
        currentXiIds,
        { id: "bench", from: "bench" },
        "starter2",
        "xi",
      ),
    ).toEqual(["starter1", "bench"]);

    expect(
      canConfirmTacticsLineupSwap(currentXiIds, playersById, {
        selectedPlayerId: "starter1",
        selectedPlayerSection: "xi",
        comparePlayerId: "starter2",
        comparePlayerSection: "xi",
      }),
    ).toBe(true);
    expect(
      applyLineupSwap(
        currentXiIds,
        { id: "starter1", from: "xi" },
        "starter2",
        "xi",
      ),
    ).toEqual(["starter2", "starter1"]);
  });

  it("forbids swaps that put an injured or youth bench player into the XI", () => {
    const starter = makePlayer("starter", "Defender");
    const injured = makePlayer("injured", "Defender", {
      injury: { name: "Hamstring strain", days_remaining: 7 },
    });
    const youth = makePlayer("youth", "Defender", { squad_role: "Youth" });
    const playersById = new Map(
      [starter, injured, youth].map((player) => [player.id, player]),
    );

    for (const benchPlayerId of ["injured", "youth"]) {
      expect(
        canConfirmTacticsLineupSwap(["starter"], playersById, {
          selectedPlayerId: benchPlayerId,
          selectedPlayerSection: "bench",
          comparePlayerId: "starter",
          comparePlayerSection: "xi",
        }),
      ).toBe(false);
    }
  });

  it("forbids incomplete, same-player, and bench-to-bench comparisons", () => {
    const first = makePlayer("first", "Defender");
    const second = makePlayer("second", "Defender");
    const playersById = new Map(
      [first, second].map((player) => [player.id, player]),
    );

    expect(
      canConfirmTacticsLineupSwap(["first"], playersById, EMPTY_SELECTION),
    ).toBe(false);
    expect(
      canConfirmTacticsLineupSwap(["first"], playersById, {
        selectedPlayerId: "first",
        selectedPlayerSection: "xi",
        comparePlayerId: "first",
        comparePlayerSection: "xi",
      }),
    ).toBe(false);
    expect(
      canConfirmTacticsLineupSwap(["first"], playersById, {
        selectedPlayerId: "first",
        selectedPlayerSection: "bench",
        comparePlayerId: "second",
        comparePlayerSection: "bench",
      }),
    ).toBe(false);
  });
});

describe("deployed position and role options", () => {
  it("derives a starter position from its formation slot without mutating the natural position", () => {
    const player = makePlayer("striker-at-rm", "Striker");
    const team = {
      formation: "4-4-2",
      starting_xi_ids: [
        "gk",
        "lb",
        "cb1",
        "cb2",
        "rb",
        "lm",
        "cm1",
        "cm2",
        player.id,
        "st1",
        "st2",
      ],
    };
    const deployedPosition = getDeployedPosition(team, player.id);

    expect(deployedPosition).toBe("RightMidfielder");
    expect(
      getSectionPlayerPosition(
        player,
        "xi",
        new Map([[player.id, deployedPosition ?? player.position]]),
      ),
    ).toBe("RightMidfielder");
    expect(player.position).toBe("Striker");
    expect(player.natural_position).toBe("Striker");
  });

  it("offers roles for the deployed slot instead of the player's natural position", () => {
    const player = makePlayer("striker-at-rm", "Striker");
    const team = {
      formation: "4-4-2",
      starting_xi_ids: [
        "gk",
        "lb",
        "cb1",
        "cb2",
        "rb",
        "lm",
        "cm1",
        "cm2",
        player.id,
        "st1",
        "st2",
      ],
    };
    const deployedPosition = getDeployedPosition(team, player.id);

    expect(deployedPosition).not.toBeNull();
    expect(getRolesForPosition(deployedPosition ?? player.position)).toContain(
      "InvertedWinger",
    );
    expect(getRolesForPosition(deployedPosition ?? player.position)).not.toContain(
      "Poacher",
    );
  });
});
