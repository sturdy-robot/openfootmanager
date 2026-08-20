import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const formationBoard = readSource("src/components/match/FormationBoard.tsx");
// Pure geometry lives in the co-located helper per src/CLAUDE.md §7, so that is
// where the buildPitchRows dependency is asserted.
const formationBoardHelpers = readSource(
  "src/components/match/FormationBoard.helpers.ts",
);
const formationPitch = readSource("src/components/match/FormationPitch.tsx");
const tacticsPitch = readSource("src/components/tactics/TacticsPitch.tsx");
const tacticsHelpers = readSource("src/components/tactics/TacticsTab.helpers.ts");
const tacticsLineupHook = readSource("src/components/tactics/useTacticsLineup.ts");

describe("one pitch renderer architecture", () => {
  it("puts the only pitch SVG and buildPitchRows geometry in FormationBoard", () => {
    const core = stripComments(formationBoard);

    expect(
      core,
      "src/components/match/FormationBoard.tsx must exist",
    ).not.toBe("");
    expect(core.match(/<svg\b/g) ?? []).toHaveLength(1);
    expect(core).toMatch(/viewBox\s*=\s*["']0 0 100 140["']/);
    expect(stripComments(formationBoardHelpers)).toMatch(/\bbuildPitchRows\b/);
  });

  it("turns FormationPitch and TacticsPitch into SVG-free FormationBoard variants", () => {
    const formationVariant = stripComments(formationPitch);
    const tacticsVariant = stripComments(tacticsPitch);
    const violations = [
      ["FormationPitch does not delegate", !formationVariant.includes("FormationBoard")],
      ["FormationPitch still owns an SVG", /<svg\b/.test(formationVariant)],
      ["FormationPitch still owns a viewBox", formationVariant.includes("viewBox")],
      ["TacticsPitch does not delegate", !tacticsVariant.includes("FormationBoard")],
      ["TacticsPitch still owns an SVG", /<svg\b/.test(tacticsVariant)],
      ["TacticsPitch still owns a viewBox", tacticsVariant.includes("viewBox")],
    ]
      .filter(([, failed]) => failed)
      .map(([message]) => message);

    expect(violations).toEqual([]);
  });

  it("removes the tactics-only coordinate model and formula", () => {
    const helperImplementation = stripComments(tacticsHelpers);
    const hookImplementation = stripComments(tacticsLineupHook);
    const legacyReferences = [
      ["getSlotXCoordinates", helperImplementation.includes("getSlotXCoordinates")],
      ["buildTacticsPitchSlots", helperImplementation.includes("buildTacticsPitchSlots")],
      ["useTacticsLineup buildTacticsPitchSlots", hookImplementation.includes("buildTacticsPitchSlots")],
    ]
      .filter(([, present]) => present)
      .map(([name]) => name);

    expect(legacyReferences).toEqual([]);
  });

  it("pins the rich-token host and its light/dark focus treatment in the core", () => {
    const core = stripComments(formationBoard);

    // Step 8b: with no control left inside a token, the slot host is a real
    // button rather than a div wearing the role — the nesting that made a div
    // necessary is what issue #322 was.
    expect(core).toMatch(/<button\b/);
    expect(core).not.toMatch(/role\s*=\s*["']button["']/);
    expect(core).toContain("focus-visible:ring-2");
    expect(core).toContain("focus-visible:ring-offset-2");
    // The surface behind a slot is the turf, which does not change with the
    // theme — so the offset names a turf token and has no dark variant. This
    // used to require `dark:focus-visible:ring-offset-`, which pinned an
    // override against a colour that is never there.
    expect(core).toMatch(/focus-visible:ring-offset-turf-/);
    expect(core).not.toMatch(/emerald-/);
  });
});
