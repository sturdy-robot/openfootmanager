Cloud run t2-1: DONE

**Setup:** worked. apt-get install of webkit/gtk/rsvg/appindicator dev packages exit 0; Rust 1.95.0 (rust-toolchain.toml) installed by rustup; Node v22.23.4; `npm ci` exit 0 ("added 236 packages"); `node_modules/.bin/biome` and `vitest` present.

**1. Sources:** fetched `cloud-src/ofm-frontend/t2` → `fam`. HEAD `a1cec2b59381c1c5349cffa20be013a7ffcb40bc` ("test(squad): the XI-fill test uses a pool that can field eleven besides the saved players").

**2. RED** (3 helper/hook files from `fam~2`): exit 1. Test Files 3 failed | 6 passed (9); Tests 3 failed | 156 passed (159); 20.94s. Exactly the expected three:
- SquadTab.helpers.test.ts > getDeployedPosition > when the screen reads the backend's familiarity > fills the XI only once the familiarity has loaded — `AssertionError: expected [ 'p10', 'p11', 'p12', 'p13', …(7) ] to deeply equal [ 'p0', 'p1', 'p2' ]`
- TacticsTab.helpers.test.ts > … > when the screen reads the backend's familiarity > fills nothing of a pending lineup before the familiarity has loaded — `AssertionError: expected [ Array(11) ] to deeply equal [ 'm0' ]`
- TacticsTab.test.tsx > TacticsTab > keeps the selection when a dropped lineup is not saved — `TestingLibraryElementError: Unable to find an element with the text: tactics.comparePlayer.`

Restored with `git checkout fam -- src`; tree clean.

**3. GREEN:** exit 0. Test Files 112 passed (112); Tests 1014 passed (1014); 127.57s.

**4. MUTANTS** (each: Test Files 1 failed | 8 passed (9); Tests 1 failed | 158 passed (159); restored after each):
- Q1 (SquadTab.helpers.ts:317 deleted): CAUGHT — "fills the XI only once the familiarity has loaded"
- Q2 (TacticsTab.helpers.ts:137 deleted): CAUGHT — "fills nothing of a pending lineup before the familiarity has loaded"
- Q3 (useTacticsLineup.ts:198 `return false`→`return true`): CAUGHT — "keeps the selection when a dropped lineup is not saved"

Caught: Q1, Q2, Q3. Missed: none.

**5. GATES:**
- `npm run build`: exit 0, 29s ("✓ built in 2.23s")
- `npm run lint` (`biome lint --error-on-warnings`): exit 0, "Checked 901 files in 1041ms", "Found 147 infos."
- `npm run knip`: exit 0, 3s; only 2 configuration hints (tailwindcss ignoreDependencies, .css extension)
- `npm test`: exit 0. Test Files 361 passed (361); Tests 3342 passed (3342); 336.13s.
