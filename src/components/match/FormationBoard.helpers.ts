import { buildPitchRows } from "../squad/SquadTab.helpers";

export type FormationBoardOrientation = "normal" | "mirrored";

export type FormationBoardFallbackGroup =
  | "Goalkeeper"
  | "Defender"
  | "Midfielder"
  | "Forward";

export interface FormationBoardGeometrySlot {
  /**
   * Only consulted when the slot count disagrees with the formation — see
   * `buildFormationBoardCoordinates`.
   */
  fallbackGroup?: FormationBoardFallbackGroup;
}

export interface FormationBoardCoordinate {
  index: number;
  position: string;
  x: number;
  y: number;
}

export type FormationBoardDirection = "up" | "down" | "left" | "right";

export function nextSlotInDirection(
  coordinates: readonly FormationBoardCoordinate[],
  fromIndex: number,
  direction: FormationBoardDirection,
): number | null {
  const origin = coordinates.find(
    (coordinate) => coordinate.index === fromIndex,
  );
  if (!origin) {
    return null;
  }

  if (direction === "left" || direction === "right") {
    const candidates = coordinates.filter(
      (coordinate) =>
        coordinate.y === origin.y &&
        (direction === "left"
          ? coordinate.x < origin.x
          : coordinate.x > origin.x),
    );

    candidates.sort(
      (left, right) =>
        Math.abs(left.x - origin.x) - Math.abs(right.x - origin.x) ||
        left.index - right.index,
    );
    return candidates[0]?.index ?? null;
  }

  const candidates = coordinates.filter((coordinate) =>
    direction === "up"
      ? coordinate.y < origin.y
      : coordinate.y > origin.y,
  );
  candidates.sort(
    (left, right) =>
      Math.abs(left.y - origin.y) - Math.abs(right.y - origin.y) ||
      Math.abs(left.x - origin.x) - Math.abs(right.x - origin.x) ||
      left.index - right.index,
  );
  return candidates[0]?.index ?? null;
}

/**
 * Where the slots of one row sit across the pitch.
 *
 * Rows of five or more spread from 10 to 90 rather than dividing the width
 * evenly: at five wide, even spacing puts full-size tokens close enough to
 * overlap, which is what a 3-5-2 or 4-5-1 midfield looks like. Smaller rows
 * divide evenly, which reads better than pushing three players to the margins.
 *
 * There used to be two of these — one per renderer — differing in this rule and
 * in rounding. This is the survivor.
 */
export function rowSlotXCoordinates(slotCount: number): number[] {
  if (slotCount <= 0) {
    return [];
  }

  if (slotCount === 1) {
    return [50];
  }

  if (slotCount >= 5) {
    return Array.from(
      { length: slotCount },
      (_, index) => Math.round((10 + (index * 80) / (slotCount - 1)) * 10) / 10,
    );
  }

  return Array.from(
    { length: slotCount },
    (_, index) => Math.round(((index + 1) / (slotCount + 1)) * 1000) / 10,
  );
}

/** Which rows a fallback group may occupy, by row label, in row order. */
const FALLBACK_ROW_LABELS: Record<FormationBoardFallbackGroup, string[]> = {
  Goalkeeper: ["GK"],
  Defender: ["DEF"],
  Midfielder: ["DM", "AM", "MID"],
  Forward: ["FWD"],
};

/**
 * Place every slot on the pitch.
 *
 * The formation owns the rows, their vertical positions and the granular
 * position of each slot; `buildPitchRows` is the only source of those and this
 * does not second-guess it. Index maps to slot one-for-one, because entry `i`
 * of the XI *is* formation slot `i`.
 *
 * When the counts disagree — an old save, a formation string the world does not
 * define — the slots are grouped onto the rows their occupants broadly belong
 * to instead of being dropped. A player rendered in roughly the right band is
 * recoverable; a player who silently vanishes from the pitch is not.
 */
export function buildFormationBoardCoordinates(
  formation: string,
  slots: readonly FormationBoardGeometrySlot[],
  orientation: FormationBoardOrientation,
): FormationBoardCoordinate[] {
  const rows = buildPitchRows(formation);
  const rowPositions = rows.flatMap((row) => row.positions);

  // Index-for-index is the normal case, and it still holds for a partial board
  // — a live side showing only the players left on the pitch. The fallback
  // grouping is for callers that cannot map to slots at all and say so by
  // declaring a group; guessing at it from the count alone would scatter a
  // short XI across the pitch instead of filling the formation from the back.
  const hasFallbackHints = slots.some((slot) => slot.fallbackGroup !== undefined);
  const coordinates: FormationBoardCoordinate[] =
    hasFallbackHints && slots.length !== rowPositions.length
      ? buildFallbackCoordinates(rows, slots)
      : buildAlignedCoordinates(rows, slots.length);

  if (orientation === "normal") {
    return coordinates;
  }

  // A 180-degree turn, not a horizontal flip: the away side attacks the other
  // way, so its left back has to appear on the viewer's opposite side too.
  return coordinates.map((coordinate) => ({
    ...coordinate,
    x: Math.round((100 - coordinate.x) * 10) / 10,
    y: Math.round((100 - coordinate.y) * 10) / 10,
  }));
}

function buildAlignedCoordinates(
  rows: ReturnType<typeof buildPitchRows>,
  slotCount: number,
): FormationBoardCoordinate[] {
  const coordinates: FormationBoardCoordinate[] = [];
  let index = 0;

  for (const row of rows) {
    const xs = rowSlotXCoordinates(row.positions.length);
    row.positions.forEach((position, positionIndex) => {
      coordinates.push({
        index,
        position,
        x: xs[positionIndex],
        y: Number.parseFloat(row.y),
      });
      index += 1;
    });
  }

  return coordinates.slice(0, slotCount);
}

function buildFallbackCoordinates(
  rows: ReturnType<typeof buildPitchRows>,
  slots: readonly FormationBoardGeometrySlot[],
): FormationBoardCoordinate[] {
  // Bucket the slots onto rows first, so each row's x spacing is computed from
  // the players actually standing in it rather than from the formation's
  // nominal width.
  const rowBuckets = new Map<number, number[]>();

  slots.forEach((slot, index) => {
    const rowIndex = resolveFallbackRowIndex(rows, slot.fallbackGroup, rowBuckets);
    const bucket = rowBuckets.get(rowIndex) ?? [];
    bucket.push(index);
    rowBuckets.set(rowIndex, bucket);
  });

  const coordinates: FormationBoardCoordinate[] = [];

  for (const [rowIndex, slotIndices] of rowBuckets) {
    const row = rows[rowIndex];
    const xs = rowSlotXCoordinates(slotIndices.length);

    slotIndices.forEach((slotIndex, positionInRow) => {
      coordinates.push({
        index: slotIndex,
        position: row.positions[positionInRow] ?? row.positions[0] ?? "",
        x: xs[positionInRow],
        y: Number.parseFloat(row.y),
      });
    });
  }

  // Callers index by slot, so hand them back in slot order.
  return coordinates.sort((left, right) => left.index - right.index);
}

function resolveFallbackRowIndex(
  rows: ReturnType<typeof buildPitchRows>,
  group: FormationBoardFallbackGroup | undefined,
  rowBuckets: ReadonlyMap<number, number[]>,
): number {
  // An unknown group goes to midfield rather than off the pitch.
  const labels = FALLBACK_ROW_LABELS[group ?? "Midfielder"];
  const candidates = rows
    .map((row, index) => ({ row, index }))
    .filter((entry) => labels.includes(entry.row.label));

  if (candidates.length === 0) {
    return Math.min(1, rows.length - 1);
  }

  // Fill the formation's own row widths in order; the last candidate row takes
  // whatever is left over rather than spilling into the forwards.
  for (const candidate of candidates) {
    const taken = rowBuckets.get(candidate.index)?.length ?? 0;
    if (taken < candidate.row.positions.length) {
      return candidate.index;
    }
  }

  return candidates[candidates.length - 1].index;
}
