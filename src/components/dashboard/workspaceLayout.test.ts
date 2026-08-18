import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The workspace owns one decision: is this tab a *document* that scrolls, or a
 * *workbench* that fills the window and lets its own panes scroll?
 *
 * Today every tab is a document, because `DashboardWorkspaceContent` is a
 * single `overflow-auto` and nothing downstream is height-bounded. That is why
 * the tactics screen scrolls as one long page however its columns are arranged.
 *
 * These tests are deliberately source-level. jsdom computes no layout, so it
 * cannot tell a working height chain from a broken one; what it *can* pin is
 * that the chain is written down, in one place, and that no tab escapes the
 * decision. Losing the contract would otherwise be a silent one-line edit.
 *
 * Sources are read through `node:fs` rather than `?raw` on purpose: a module
 * that does not exist yet then fails its own test with a readable message,
 * instead of breaking collection for the whole file and reporting nothing.
 * Paths are relative to the Vitest root, which is the repository root.
 */
const DASHBOARD = "src/components/dashboard";

function readSource(relativePath: string): string {
  return readFileSync(`${DASHBOARD}/${relativePath}`, "utf-8");
}

/**
 * Drop comments before asserting on class names, so a mention in prose cannot
 * satisfy a check — and so the check does not dictate *how* the class reaches
 * the element. Requiring a quoted literal would forbid a template string.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const appCss = readFileSync("src/App.css", "utf-8");

/**
 * Read one exported tab set out of `workspaceLayout.ts` as text.
 *
 * Importing the module would be nicer, but Vite resolves even a dynamic import
 * at transform time, so a module that does not exist yet takes the whole file
 * down with it and no test reports anything.
 */
function readTabSet(exportName: string): string[] {
  const source = readSource("workspaceLayout.ts");
  const declaration = new RegExp(
    exportName + "[^=]*=\\s*new Set\\(\\[([^\\]]*)\\]",
  ).exec(source);

  if (!declaration) {
    throw new Error("workspaceLayout.ts does not export " + exportName + " as a Set");
  }

  return [...declaration[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

describe("workspace layout contract", () => {
  it("defines the shared page-width token in the theme", () => {
    const theme = appCss.slice(
      appCss.indexOf("@theme {"),
      appCss.indexOf("@layer base"),
    );

    // Tailwind v4 resolves `max-w-page` from the `--container-*` namespace, so
    // the token has to live inside @theme to generate the utility at all.
    // 80rem is the value the page-width work settled on; changing it is a
    // design decision, not a refactor.
    expect(theme).toMatch(/--container-page:\s*80rem;/);
  });

  it("stops the workspace from being the page scroller", () => {
    // The single `flex-1 overflow-auto p-6` that made every tab a document.
    // While it exists, no pane below it can own its own overflow.
    const source = readSource("DashboardWorkspaceContent.tsx");

    expect(source).not.toMatch(/overflow-auto/);
    expect(source).not.toMatch(/overflow-y-auto/);
  });

  it("gives the workspace a bounded height for its children to fill", () => {
    // `min-h-0` is the load-bearing class: a flex child defaults to
    // `min-height: auto` and refuses to shrink below its content, which is the
    // usual reason an `overflow-auto` further down does nothing at all.
    expect(readSource("DashboardWorkspaceContent.tsx")).toContain("min-h-0");
  });

  it("routes every tab through exactly one layout primitive", () => {
    // All 18 lazily-loaded tabs funnel through one `content` variable, so the
    // decision is made once. A tab rendered outside both primitives would sit
    // in a bounded box with no scroller and clip silently.
    const source = readSource("DashboardTabContent.tsx");

    expect(source).toContain("WorkspaceFrame");
    expect(source).toContain("WorkspaceScroll");
  });

  it("makes the scrolling primitive the one that owns overflow and page width", () => {
    const source = stripComments(readSource("WorkspaceScroll.tsx"));

    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("max-w-page");
    expect(source).toContain("mx-auto w-full");
  });

  it("keeps the frame primitive height-bounded and unconstrained in width", () => {
    const source = stripComments(readSource("WorkspaceFrame.tsx"));

    expect(source).toContain("min-h-0");
    expect(source).not.toMatch(/overflow-y-auto/);
    // A workbench uses the whole window; capping it at the reading width would
    // squeeze the pitch back into the column it is being freed from.
    expect(source).not.toContain("max-w-page");
  });

  it("exempts only Tactics from the document layout", () => {
    // Widening this set is a design decision that belongs in review, not a
    // quiet edit — every addition is a tab that stops scrolling as a page.
    expect(readTabSet("FRAME_TABS")).toEqual(["Tactics"]);
  });

  it("gives a definite height to only the Inbox", () => {
    // InboxTab is `flex flex-col h-full` over a `flex-1 … min-h-0` master
    // detail pane, so its wrapper needs a definite height. Every other document
    // tab must stay auto-height: `h-full` pins the wrapper to the viewport and
    // a long table then overflows it, losing the scroll container's padding.
    expect(readTabSet("FULL_HEIGHT_TABS")).toEqual(["Inbox"]);
  });
});
