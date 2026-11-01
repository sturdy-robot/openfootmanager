Cloud run fam2-5: PARTIAL

**Setup: worked.** apt-get install (webkit2gtk-4.1, gtk-3, rsvg2, ayatana-appindicator3) exit 0; Rust 1.95.0 installed from rust-toolchain.toml; Node v22.23.4; `npm ci` exit 0 (12.3s).

**1. Sources** — fetched `cloud-src/ofm-frontend/fam2d` into `fam`. HEAD = `2a3be80d0860748b9273b4f51131f8d345d648ba` "fix(squad): the saved XI is drawn before get_squad answers; actions keep the strict pool" (parent `aa55cd26` Merge upstream/develop into feat/familiarity-squad).

**2. RED** — `git checkout fam~1 -- src/components/squad/SquadRosterView.tsx`; vitest SquadTab.test.tsx: exit 1, `Tests 1 failed | 35 passed (36)`. Exactly one failure, as expected:
- `SquadTab > draws the saved XI before get_squad answers and saves nothing`
- `TestingLibraryElementError: Unable to find an element with the text: squad.startingXi.`

Restored with `git checkout fam -- src/components/squad`; tree clean.

**3. GREEN** — `vitest run src/components/squad src/lib`: **exit 1**. `Test Files 1 failed | 36 passed (37)`, `Tests 1 failed | 406 passed (407)`, Duration 28.72s.
- FAIL `src/components/squad/SquadCardsView.test.tsx > SquadRosterView cards > marks a starter deployed out of position on his card`
- `AssertionError: expected [] to have a length of 1 but got +0` at `SquadCardsView.test.tsx:370:34` (`expect(outOfPosition("GK1")).toHaveLength(1);`)
- Deterministic: re-running that file alone gave the same failure (`Tests 1 failed | 16 passed (17)`).
- Not caused by the XI fix: with `SquadRosterView.tsx` at `fam~1` (the merge), the same test fails the same way (`Tests 1 failed | 16 passed (17)`, exit 1); restored afterwards. It was already red on the merge `aa55cd26`.

**STOPPED per job instructions.** Steps 4 (MUTANT) and 5 (GATES: build, npm test, lint, knip, i18n) were **not run**.

No source changes remain; this branch is HEAD `2a3be80d` + this RESULT.md.
