/**
 * A hand-written sliver of the Node typings, for tests that have to read a file
 * Vite will not hand over as text.
 *
 * The project deliberately ships without `@types/node` — nothing in `src/`
 * targets Node. The exception is the workspace-layout gate, which needs the
 * text of `src/App.css` to check that the shared page-width token still exists.
 * Vitest runs with `css: false`, so it stubs every CSS import to `""` — the
 * `?raw` query and `import.meta.glob(..., { query: "?raw" })` that the i18n
 * tests use for `.ts`/`.tsx` sources both come back empty for `.css`.
 *
 * Declaring the one function that test calls is cheaper than adding a
 * dependency. Widen this only if another test genuinely needs it.
 */
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf-8"): string;
}
