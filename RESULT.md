Cloud run t1-1: PARTIAL

**Setup: worked.** apt-get update + install webkit2gtk-4.1/gtk-3/rsvg2/ayatana: exit 0. Rust 1.95.0 (rust-toolchain.toml pin) installed by rustup. `npm ci`: exit 0.

**1. Sources.** `git fetch https://github.com/sturdy-robot/openfootmanager cloud-src/ofm-frontend/t1:fam` OK. HEAD = `9b1a9f154f42ddb0c1f6b39af0b71994de587428` ("fix(tactics): nothing is filled by a grade that has not arrived; a dropped lineup that is not saved keeps the selection; the loading notice covers the squad").

**2. RED** (3 files from fam~1): exit 1. Test Files 3 failed | 6 passed (9); Tests 3 failed | 156 passed (159); 19.85s. Exactly the expected three:
- SquadTab.helpers.test.ts > getDeployedPosition > …familiarity > "fills the XI only once the familiarity has loaded" — `AssertionError: expected [ Array(9) ] to deeply equal [ 'p0', 'p1', 'p2' ]`
- TacticsTab.helpers.test.ts > …familiarity > "fills nothing of a pending lineup before the familiarity has loaded" — `AssertionError: expected [ Array(11) ] to deeply equal [ 'm0' ]`
- TacticsTab.test.tsx > TacticsTab > "keeps the selection when a dropped lineup is not saved" — `TestingLibraryElementError: Unable to find an element with the text: tactics.comparePlayer.`
Restored with `git checkout fam -- src` (tree clean).

**3. GREEN: FAILED → stopped.** exit 1. Test Files 1 failed | 111 passed (112); Tests 1 failed | 1013 passed (1014); 123.20s.
- src/components/squad/SquadTab.helpers.test.ts > getDeployedPosition > when the screen reads the backend's familiarity > "fills the XI only once the familiarity has loaded" — `AssertionError: expected [ Array(9) ] to have a length of 11 but got 9` at SquadTab.helpers.test.ts:894 (the second assertion: with `saying("natural")`, `buildStartingXIIds` of a 12-Midfielder pool + 3 saved on 4-4-2 returns 9, not 11). The first (pending → `['p0','p1','p2']`) passes.
Deterministic: re-run of that file alone, Tests 1 failed | 39 passed (40), same message.

**4. MUTANTS (Q1–Q3): not run** (job says STOP on GREEN failure).
**5. GATES (build, lint, knip, full npm test): not run** (same reason).
