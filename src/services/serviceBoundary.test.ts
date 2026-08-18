import { describe, expect, it } from "vitest";

/**
 * The service boundary: components describe *what* they want, services know
 * *how* to ask the backend for it. A raw `invoke()` in a component duplicates
 * error handling and re-declares response shapes inline — which is how the
 * same team-talk result type came to be written out twice.
 *
 * This gate covers the match and tactics trees, which this redesign owns. The
 * rest of the app still has raw calls; widening the glob is how that debt gets
 * paid off, one tree at a time.
 */

const componentModules = {
  ...(import.meta.glob("../components/match/**/*.{ts,tsx}", {
    eager: true,
    import: "default",
    query: "?raw",
  }) as Record<string, string>),
  ...(import.meta.glob("../components/tactics/**/*.{ts,tsx}", {
    eager: true,
    import: "default",
    query: "?raw",
  }) as Record<string, string>),
  // The matchday orchestrator lives in pages/ but owns start/snapshot/finish.
  ...(import.meta.glob("../pages/MatchSimulation.tsx", {
    eager: true,
    import: "default",
    query: "?raw",
  }) as Record<string, string>),
};

function isTestModule(path: string): boolean {
  return path.endsWith(".test.ts") || path.endsWith(".test.tsx");
}

/**
 * `TacticsRolesPanel` and `TacticsPlayerTable` are unreferenced repo-wide and
 * are deleted later in this redesign. Excluding them keeps this gate honest
 * about live code instead of forcing churn on files already condemned.
 */
const CONDEMNED = ["TacticsRolesPanel.tsx", "TacticsPlayerTable.tsx"];

function isCondemned(path: string): boolean {
  return CONDEMNED.some((name) => path.endsWith(name));
}

describe("service boundary", () => {
  it("has match and tactics modules to check", () => {
    // Guards against a glob that silently matches nothing, which would make
    // every assertion below vacuously true.
    const checked = Object.keys(componentModules).filter(
      (path) => !isTestModule(path) && !isCondemned(path),
    );
    expect(checked.length).toBeGreaterThan(15);
  });

  it("no match or tactics component imports the Tauri core module", () => {
    const offenders = Object.entries(componentModules)
      .filter(([path]) => !isTestModule(path) && !isCondemned(path))
      .filter(([, source]) => /from\s+["']@tauri-apps\/api\/core["']/.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it("no match or tactics component calls invoke directly", () => {
    const offenders = Object.entries(componentModules)
      .filter(([path]) => !isTestModule(path) && !isCondemned(path))
      .filter(([, source]) => /\binvoke\s*[<(]/.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
