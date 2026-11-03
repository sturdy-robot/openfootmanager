Cloud run h1-1: PARTIAL

**Setup: worked.** apt install exit 0; Rust 1.95.0 installed from rust-toolchain.toml; `npm ci` exit 0.

**1. Sources:** fetched `cloud-src/ofm-frontend/h1` → `fam`. HEAD `18fc3f44d8c9f1deb652480a09df164d7db7fda2` "fix(dev): the page harness answers get_familiarity, and a guard fails on any command it cannot answer".

**2. GENERATE:** `npm run fixture:pages` exit 0 (3m16s): `wrote src/dev/pageHarness/fixture.generated.ts (643 KB)`.
- `git status --short`: ` M src/dev/pageHarness/fixture.generated.ts`
- `git diff --stat`: `fixture.generated.ts | 29 +++++++++++++++++++++++++++++` / `1 file changed, 29 insertions(+)`. This adds the `FamiliarityProjection` import and `export const familiarity`.
- Copied to `artifacts/fixture.generated.ts` and committed on this branch. The source tree's copy is not committed.

**3. FRESHNESS:** `cargo test --locked -p ofm_core --example page_fixture` exit 0: `6 passed; 0 failed`, including `the_checked_in_fixture_matches_a_fresh_generation ... ok`.

**4. GREEN: FAILED.** `vitest run src/dev` exit 1: `Test Files 1 failed | 6 passed (7)`, `Tests 3 failed | 55 passed (58)`.
- `harnessPages.test.tsx > the page harness's pages > asks for no command the fixture cannot answer: home` / `: players` / `: managers`. All three fail with `TypeError: window.matchMedia is not a function` at `getInitialTheme src/context/ThemeContext.tsx:18:14`.
- Cause: `harnessPages.test.tsx` never stubs `window.matchMedia`, but sibling tests that mount ThemeProvider do (e.g. `StyleGuide.test.tsx:42`). The failure is in the test environment, not the fixture. I did not fix it.

**5. RED:** deleted `get_familiarity: () => fixture.familiarity,` (line 77) and ran vitest. Exit 1: `Test Files 2 failed (2)`, `Tests 4 failed | 18 passed (22)`.
- `fixtureAnswers.test.ts > fixture answers > answers the club's familiarity`: `TypeError: handlers.get_familiarity is not a function`. The guard bites here.
- The same 3 harnessPages tests fail, but still with `window.matchMedia is not a function`. So this run does not show whether the unanswered-command guard bites.
- Restored with `git checkout -- src/dev/pageHarness/fixtureAnswers.ts`.

**6. GATES:** `npm run build` exit 0 (`✓ built in 2.33s`). `npm run lint` exit 0 (`Checked 898 files`, `Found 147 infos`, no errors or warnings). `npm run knip` exit 0 (2 configuration hints only).
