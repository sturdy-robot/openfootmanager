import { describe, expect, it } from "vitest";

import { buildPitchRows } from "../squad/SquadTab.helpers";
import { FORMATIONS } from "./types";
import * as formationPitchModule from "./FormationPitch";

type FormationBoardOrientation = "normal" | "mirrored";

interface FormationBoardGeometrySlot {
  fallbackGroup?: "Goalkeeper" | "Defender" | "Midfielder" | "Forward";
}

interface FormationBoardCoordinate {
  index: number;
  position: string;
  x: number;
  y: number;
}

type BuildFormationBoardCoordinates = (
  formation: string,
  slots: readonly FormationBoardGeometrySlot[],
  orientation: FormationBoardOrientation,
) => FormationBoardCoordinate[];

function requireCoordinateBuilder(): BuildFormationBoardCoordinates {
  const candidate = (formationPitchModule as unknown as Record<string, unknown>)[
    "buildFormationBoardCoordinates"
  ];

  expect(
    candidate,
    "FormationPitch.tsx must re-export buildFormationBoardCoordinates from the shared board helper",
  ).toBeTypeOf("function");

  return candidate as BuildFormationBoardCoordinates;
}

function expectedRowX(slotCount: number): number[] {
  if (slotCount === 1) return [50];

  if (slotCount >= 5) {
    return Array.from({ length: slotCount }, (_, index) =>
      Math.round((10 + (index * 80) / (slotCount - 1)) * 10) / 10,
    );
  }

  return Array.from({ length: slotCount }, (_, index) =>
    Math.round(((index + 1) / (slotCount + 1) * 100) * 10) / 10,
  );
}

describe("FormationBoard geometry", () => {
  it("derives every shipped formation from buildPitchRows and one shared row-x formula", () => {
    const buildCoordinates = requireCoordinateBuilder();

    for (const formation of FORMATIONS) {
      const rows = buildPitchRows(formation);
      const slots = rows.flatMap((row) => row.positions).map(() => ({}));
      const expected = rows.flatMap((row) =>
        row.positions.map((position, index) => ({
          position,
          x: expectedRowX(row.positions.length)[index],
          y: Number.parseFloat(row.y),
        })),
      );

      expect(
        buildCoordinates(formation, slots, "normal").map(
          ({ position, x, y }) => ({ position, x, y }),
        ),
        formation,
      ).toEqual(expected);
    }
  });

  it("mirrors both axes without changing slot order", () => {
    const buildCoordinates = requireCoordinateBuilder();
    const slots = buildPitchRows("4-4-2")
      .flatMap((row) => row.positions)
      .map(() => ({}));
    const normal = buildCoordinates("4-4-2", slots, "normal");
    const mirrored = buildCoordinates("4-4-2", slots, "mirrored");

    expect(mirrored).toEqual(
      normal.map((slot) => ({
        ...slot,
        x: 100 - slot.x,
        y: 100 - slot.y,
      })),
    );
  });

  it("keeps every occupant visible when the XI length disagrees with the formation", () => {
    const buildCoordinates = requireCoordinateBuilder();
    const coordinates = buildCoordinates(
      "4-4-2",
      [
        { fallbackGroup: "Goalkeeper" },
        { fallbackGroup: "Defender" },
        { fallbackGroup: "Midfielder" },
        { fallbackGroup: "Midfielder" },
        { fallbackGroup: "Forward" },
      ],
      "normal",
    );

    expect(coordinates).toHaveLength(5);
    expect(coordinates.map(({ index }) => index)).toEqual([0, 1, 2, 3, 4]);
    expect(coordinates.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(coordinates.map(({ y }) => y)).toEqual([88, 70, 46, 46, 22]);
  });
});
