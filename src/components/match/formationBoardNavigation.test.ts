import { describe, expect, it } from "vitest";

import * as formationPitchModule from "./FormationPitch";

/**
 * Arrow keys on a formation board are spatial, not arithmetic.
 *
 * Index + 1 crosses rows unpredictably — a 3-4-3's rows are three, four and
 * three wide, so "the next index" is the far-left forward as often as it is the
 * player standing to your right. The board already knows where every slot is;
 * moving between them asks that same geometry.
 */

type Direction = "up" | "down" | "left" | "right";

interface Coordinate {
  index: number;
  position: string;
  x: number;
  y: number;
}

type BuildCoordinates = (
  formation: string,
  slots: readonly { fallbackGroup?: string }[],
  orientation: "normal" | "mirrored",
) => Coordinate[];

type NextSlotInDirection = (
  coordinates: readonly Coordinate[],
  fromIndex: number,
  direction: Direction,
) => number | null;

function lookup<T>(name: string, why: string): T {
  const candidate = (
    formationPitchModule as unknown as Record<string, unknown>
  )[name];

  expect(candidate, why).toBeTypeOf("function");

  return candidate as T;
}

function requireCoordinateBuilder(): BuildCoordinates {
  return lookup<BuildCoordinates>(
    "buildFormationBoardCoordinates",
    "FormationPitch.tsx must re-export buildFormationBoardCoordinates",
  );
}

function requireNavigator(): NextSlotInDirection {
  return lookup<NextSlotInDirection>(
    "nextSlotInDirection",
    "FormationPitch.tsx must re-export nextSlotInDirection from the shared board helper",
  );
}

function coordinatesFor(formation: string, slotCount: number): Coordinate[] {
  const build = requireCoordinateBuilder();
  return build(
    formation,
    Array.from({ length: slotCount }, () => ({})),
    "normal",
  );
}

/** The slots sharing a row with `index`, left to right. */
function rowOf(coordinates: Coordinate[], index: number): Coordinate[] {
  const y = coordinates[index].y;
  return coordinates
    .filter((coordinate) => coordinate.y === y)
    .sort((left, right) => left.x - right.x);
}

describe("moving between formation slots with the arrow keys", () => {
  it("walks along a row and stops at its edges", () => {
    const next = requireNavigator();
    const coordinates = coordinatesFor("4-4-2", 11);
    const defence = rowOf(coordinates, 1);

    expect(defence).toHaveLength(4);

    for (let position = 0; position < defence.length - 1; position += 1) {
      expect(next(coordinates, defence[position].index, "right")).toBe(
        defence[position + 1].index,
      );
      expect(next(coordinates, defence[position + 1].index, "left")).toBe(
        defence[position].index,
      );
    }

    // A row has two ends, and walking off one of them is not a wrap-around to
    // some other line of the team.
    expect(next(coordinates, defence[0].index, "left")).toBeNull();
    expect(
      next(coordinates, defence[defence.length - 1].index, "right"),
    ).toBeNull();
  });

  it("gives the lone goalkeeper nowhere to go sideways", () => {
    const next = requireNavigator();
    const coordinates = coordinatesFor("4-4-2", 11);

    expect(next(coordinates, 0, "left")).toBeNull();
    expect(next(coordinates, 0, "right")).toBeNull();
  });

  it("steps to the nearest row and lands nearest where it started across", () => {
    const next = requireNavigator();
    const coordinates = coordinatesFor("4-3-3", 11);

    // Up is toward the goal this team is attacking, which is where y is
    // smallest — the same direction the board draws it.
    const fromDefence = rowOf(coordinates, 1);
    const target = next(coordinates, fromDefence[0].index, "up");

    expect(target).not.toBeNull();

    const landed = coordinates[target as number];
    const rowsAhead = coordinates.filter(
      (coordinate) => coordinate.y < fromDefence[0].y,
    );
    // Nearest, not furthest: y grows toward this team's own goal, so the row
    // just ahead is the *largest* y still smaller than where we started.
    const nearestAheadY = Math.max(
      ...rowsAhead.map((coordinate) => coordinate.y),
    );

    expect(landed.y).toBe(nearestAheadY);

    const contenders = rowsAhead.filter(
      (coordinate) => coordinate.y === nearestAheadY,
    );
    const closestAcross = Math.min(
      ...contenders.map((coordinate) =>
        Math.abs(coordinate.x - fromDefence[0].x),
      ),
    );

    expect(Math.abs(landed.x - fromDefence[0].x)).toBe(closestAcross);
  });

  it("returns down to the row it came from", () => {
    const next = requireNavigator();
    const coordinates = coordinatesFor("4-3-3", 11);
    const defence = rowOf(coordinates, 1);
    const forward = next(coordinates, defence[1].index, "up");

    expect(forward).not.toBeNull();
    expect(coordinates[forward as number].y).toBeLessThan(defence[1].y);

    const back = next(coordinates, forward as number, "down");

    expect(back).not.toBeNull();
    expect(coordinates[back as number].y).toBe(defence[1].y);
  });

  it("stops at the front and the back of the shape", () => {
    const next = requireNavigator();
    const coordinates = coordinatesFor("4-4-2", 11);
    const frontY = Math.min(...coordinates.map((coordinate) => coordinate.y));
    const backY = Math.max(...coordinates.map((coordinate) => coordinate.y));
    const striker = coordinates.find(
      (coordinate) => coordinate.y === frontY,
    ) as Coordinate;
    const keeper = coordinates.find(
      (coordinate) => coordinate.y === backY,
    ) as Coordinate;

    expect(next(coordinates, striker.index, "up")).toBeNull();
    expect(next(coordinates, keeper.index, "down")).toBeNull();
  });

  it("breaks a tie by taking the lower slot index", () => {
    const next = requireNavigator();
    const coordinates = coordinatesFor("4-4-2", 11);

    // The keeper stands on the centre line; the two central defenders are
    // equally far to either side of him. Two answers are equally correct, so
    // the choice has to be stated rather than left to sort order.
    const target = next(coordinates, 0, "up");
    const row = rowOf(coordinates, 1);
    const distances = row.map((coordinate) =>
      Math.abs(coordinate.x - coordinates[0].x),
    );
    const nearest = Math.min(...distances);
    const tied = row
      .filter((_, position) => distances[position] === nearest)
      .map((coordinate) => coordinate.index);

    expect(tied.length).toBeGreaterThan(1);
    expect(target).toBe(Math.min(...tied));
  });

  it("is screen-spatial on a mirrored board, not team-relative", () => {
    const next = requireNavigator();
    const build = requireCoordinateBuilder();
    const mirrored = build(
      "4-4-2",
      Array.from({ length: 11 }, () => ({})),
      "mirrored",
    );
    const frontY = Math.min(...mirrored.map((coordinate) => coordinate.y));
    const onScreenTop = mirrored.find(
      (coordinate) => coordinate.y === frontY,
    ) as Coordinate;

    // The away side attacks the other way, but the arrow key belongs to the
    // viewer's screen: up is up.
    expect(next(mirrored, onScreenTop.index, "up")).toBeNull();
    expect(next(mirrored, onScreenTop.index, "down")).not.toBeNull();
  });

  it("refuses an index it was never given", () => {
    const next = requireNavigator();
    const coordinates = coordinatesFor("4-4-2", 11);

    expect(next(coordinates, -1, "up")).toBeNull();
    expect(next(coordinates, 99, "left")).toBeNull();
    expect(next([], 0, "right")).toBeNull();
  });
});
