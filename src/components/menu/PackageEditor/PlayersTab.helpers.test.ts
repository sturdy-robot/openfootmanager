import { describe, expect, it } from "vitest";

import { filterPlayerRows } from "./PlayersTab.helpers";
import { emptyPlayer } from "./helpers";
import type { PlayerDef, Position } from "./types";

function player(overrides: Partial<PlayerDef> = {}): PlayerDef {
  return { ...emptyPlayer(), ...overrides };
}

const NO_TEAMS = new Map<string, string>();

describe("filterPlayerRows", () => {
  it("carries the original array index, which is what edit and delete address", () => {
    const players = [
      player({ id: "a", name: "Ana" }),
      player({ id: "b", name: "Bo" }),
      player({ id: "c", name: "Cyd" }),
      player({ id: "d", name: "Bo Reilly" }),
    ];

    const { filtered } = filterPlayerRows({ players, query: "bo", teamNames: NO_TEAMS });

    expect(filtered.map(({ i }) => i)).toEqual([1, 3]);
  });

  it("scopes to youth or to seniors, still with unfiltered indices", () => {
    const players = [
      player({ id: "a", name: "Ana" }),
      player({ id: "b", name: "Bo", youth: true }),
      player({ id: "c", name: "Cyd" }),
    ];

    const youth = filterPlayerRows({ players, youthOnly: true, query: "", teamNames: NO_TEAMS });
    const seniors = filterPlayerRows({ players, youthOnly: false, query: "", teamNames: NO_TEAMS });

    expect(youth.filtered.map(({ i }) => i)).toEqual([1]);
    expect(seniors.filtered.map(({ i }) => i)).toEqual([0, 2]);
  });

  it("reports the scoped total separately from the matches", () => {
    const players = [
      player({ id: "a", name: "Ana" }),
      player({ id: "b", name: "Bo" }),
    ];

    const { scoped, filtered } = filterPlayerRows({
      players,
      query: "ana",
      teamNames: NO_TEAMS,
    });

    expect(scoped).toHaveLength(2);
    expect(filtered).toHaveLength(1);
  });

  it("matches a club by the name shown in the row, not only by its id", () => {
    // The subtitle reads "Northshire FC" while the record stores "nsfc", so
    // searching for what is on screen used to find nothing.
    const players = [
      player({ id: "a", name: "Ana", club: "nsfc" }),
      player({ id: "b", name: "Bo", club: "hav" }),
    ];
    const teamNames = new Map([["nsfc", "Northshire FC"], ["hav", "Havenport"]]);

    const { filtered } = filterPlayerRows({ players, query: "northshire", teamNames });

    expect(filtered.map(({ player: p }) => p.id)).toEqual(["a"]);
  });

  it("still matches the raw id, position and nationality", () => {
    const players = [
      player({ id: "keeper-one", name: "Ana", position: "Goalkeeper" as Position, nationality: "BRA" }),
      player({ id: "striker-one", name: "Bo", position: "Striker" as Position, nationality: "ARG" }),
    ];

    const byId = filterPlayerRows({ players, query: "keeper-o", teamNames: NO_TEAMS });
    const byPosition = filterPlayerRows({ players, query: "goalkeeper", teamNames: NO_TEAMS });
    const byNationality = filterPlayerRows({ players, query: "arg", teamNames: NO_TEAMS });

    expect(byId.filtered.map(({ player: p }) => p.id)).toEqual(["keeper-one"]);
    expect(byPosition.filtered.map(({ player: p }) => p.id)).toEqual(["keeper-one"]);
    expect(byNationality.filtered.map(({ player: p }) => p.id)).toEqual(["striker-one"]);
  });

  it("falls back to the first and last name when there is no display name", () => {
    const players = [player({ id: "a", firstName: "Ana", lastName: "Reyes" })];

    expect(filterPlayerRows({ players, query: "reyes", teamNames: NO_TEAMS }).filtered).toHaveLength(1);
  });
});
