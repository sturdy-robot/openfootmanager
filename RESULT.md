Cloud run h11-1: DONE

**Setup — worked.** `apt-get install` libwebkit2gtk-4.1-dev etc.: exit 0. Rust 1.95.0 (pinned by rust-toolchain.toml) installed by rustup. `npm ci`: exit 0 (12.3s). Biome resolves to 2.5.5 (not the 0.3.3 impostor).

**1. Sources.** Fetched `cloud-src/ofm-frontend/h11` → `fam`. HEAD `653dbed9f1c456cacf9a9c30ee96663a0ea592be` "test(dev): the Staff page is told apart by its own table; the position count comes from the fixture".

**2. GREEN** — `npm exec --no -- vitest run src/dev`: exit 0. `Test Files 7 passed (7)`, `Tests 58 passed (58)`, Duration 10.92s. Errors: 0.

**3. MUTANTS** (`src/dev/pageHarness/harnessPages.test.tsx`; tree restored with `git checkout -- src` after each, clean afterwards). Caught: H1, H2, H3. Missed: none.

- **H1** (`initialTab="Home"`): exit 1, `Tests 5 failed | 1 passed (6)`. Failed: `asks for no command the fixture cannot answer: managers`, `players`, `squad`, `staff`, `teams` (home passes, as expected). Reasons: no table named "Managers", `/League$/`, `/Squad$/`, `/^My Staff \(\d+\)$/`; no role "row".
- **H2** (delete `get_familiarity`): exit 1, `Tests 6 failed (6)`. Failed: `…: home`, `managers`, `players`, `squad`, `staff`, `teams`. Reason: `expected [ 'get_familiarity' ] to deeply equal []` (and 9× `page harness: no answer for "get_familiarity"`).
- **H3** (`return null;`): exit 1, `Tests 6 failed (6)`. Failed: `…: home`, `managers`, `players`, `squad`, `staff`, `teams`. Reasons: no heading "Next Match", no table "Managers"/`/League$/`/`/Squad$/`, no role "row".

**4. GATES**
- `npm run build` (tsc && vite build): exit 0, 26s, `✓ built in 1.89s`.
- `npm run lint` (biome lint --error-on-warnings): exit 0, 1s. `Checked 908 files in 934ms. No fixes applied. Found 147 infos.` 0 errors, 0 warnings.
- `npm run knip`: exit 0, 3s. Only 2 configuration hints (`tailwindcss` in ignoreDependencies; `.css` compiled extension excluded), no unused findings.
