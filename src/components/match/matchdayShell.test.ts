import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const MATCH_COMPONENTS = "src/components/match";

function readSource(relativePath: string): string {
  try {
    return readFileSync(`${MATCH_COMPONENTS}/${relativePath}`, "utf-8");
  } catch {
    return "";
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const stages = [
  { file: "PreMatchSetup.tsx", name: "pre-match", mode: "frame" },
  { file: "MatchLive.tsx", name: "live", mode: "frame" },
  { file: "HalfTimeBreak.tsx", name: "half-time", mode: "frame" },
  { file: "PostMatchScreen.tsx", name: "post-match", mode: "frame" },
  { file: "RoundDigestScreen.tsx", name: "round digest", mode: "frame" },
  {
    file: "PenaltyShootoutScreen.tsx",
    name: "penalty shootout",
    mode: "centered",
  },
  { file: "PressConference.tsx", name: "press conference", mode: "centered" },
] as const;

describe("MatchdayShell structure", () => {
  it("exports the shared shell and its two body modes", () => {
    const source = readSource("MatchdayShell.tsx");

    expect(
      source,
      "MatchdayShell.tsx must exist and export MatchdayBodyMode",
    ).toMatch(/export\s+type\s+MatchdayBodyMode\s*=\s*["']frame["']\s*\|\s*["']centered["']/);
    expect(source).toMatch(/export\s+interface\s+MatchdayShellProps/);
    expect(source).toMatch(/export\s+default\s+function\s+MatchdayShell/);
  });

  it("bounds the viewport and every shrinking link in the body height chain", () => {
    const source = stripComments(readSource("MatchdayShell.tsx"));
    const staticClassTokens = [...source.matchAll(/className="([^"]*)"/g)]
      .flatMap((match) => match[1].split(/\s+/));

    expect(
      staticClassTokens,
      "the shell root must have a definite h-screen viewport height",
    ).toContain("h-screen");
    expect(staticClassTokens).not.toContain("min-h-screen");
    expect(source, "the shell must prevent document-level overflow").toContain(
      "overflow-hidden",
    );
    expect(
      source.match(/min-h-0/g)?.length ?? 0,
      "the shell root and body both need min-h-0",
    ).toBeGreaterThanOrEqual(2);
  });

  it("makes frame bodies scroll at narrow widths and stop page-scrolling when wide", () => {
    const source = stripComments(readSource("MatchdayShell.tsx"));

    expect(source).toContain('bodyMode === "frame"');
    expect(
      source,
      "frame mode needs a narrow scroller with a wide overflow-hidden override",
    ).toContain("overflow-y-auto xl:overflow-hidden");
  });

  it("makes centered bodies honest bounded single-column scrollers", () => {
    const source = stripComments(readSource("MatchdayShell.tsx"));

    expect(source).toContain('bodyMode === "centered"');
    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("mx-auto w-full max-w-page");
  });

  it("owns competition and round identity, theme control, and capped chrome", () => {
    const source = stripComments(readSource("MatchdayShell.tsx"));

    expect(source).toContain("identity.competitionName");
    expect(source).toContain("identity.roundLabel");
    expect(source).toContain("ThemeToggle");
    expect(source).toContain("max-w-page");
    expect(source).toMatch(/<header[\s\S]*aria-label=/);
  });

  it("establishes a reduced-motion descendant guard", () => {
    const source = stripComments(readSource("MatchdayShell.tsx"));

    expect(
      source,
      "MatchdayShell must disable descendant motion for reduced-motion users",
    ).toContain("motion-reduce:");
  });

  it("allows the collapsed pre-match grids to grow into the frame scroller", () => {
    const source = stripComments(readSource("PreMatchSetup.tsx"));
    const collapsedGrids = [...source.matchAll(/className="([^"]*grid-cols-1[^"]*)"/g)];
    const clippingGrids = collapsedGrids
      .map((match) => match[1])
      .filter((className) => className.split(/\s+/).includes("overflow-hidden"));

    expect(
      clippingGrids,
      "a one-column pre-match grid may use responsive overflow clipping, but not unconditional overflow-hidden",
    ).toEqual([]);
  });
});

describe("matchday stage adoption", () => {
  for (const stage of stages) {
    it(`${stage.name} adopts MatchdayShell in ${stage.mode} mode`, () => {
      const source = stripComments(readSource(stage.file));

      expect(source).toContain("MatchdayShell");
      expect(source).toContain(`bodyMode="${stage.mode}"`);
      expect(source).not.toMatch(/\b(?:min-)?h-screen\b/);
      expect(source).not.toContain("ThemeToggle");
      expect(source).not.toContain("MatchScreenLayout");
    });
  }
});

describe("matchday motion policy", () => {
  it("guards every matchday animation behind motion-safe", () => {
    const offenders = stages.flatMap(({ file }) => {
      const source = stripComments(readSource(file));
      return [...source.matchAll(/(?<!motion-safe:)animate-[\w-]+/g)].map(
        (match) => `${file}: ${match[0]}`,
      );
    });

    expect(
      offenders,
      "animation utilities in matchday stages must be prefixed with motion-safe:",
    ).toEqual([]);
  });
});
