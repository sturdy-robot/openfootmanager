Cloud run h9-1: DONE

**Setup:** worked. apt install of webkit2gtk-4.1/gtk-3/rsvg2/ayatana-appindicator3 dev packages: exit 0. Rust 1.95.0 (pinned in rust-toolchain.toml) installed via rustup. `npm ci`: exit 0. Biome resolved as 2.5.5 (not the 0.3.3 impostor).

**1. Sources:** `git fetch https://github.com/sturdy-robot/openfootmanager cloud-src/ofm-frontend/h9:fam`, checkout `fam`.
HEAD = `7ccdeef98462ed8ff5bc6e03549e5bc790c181ec` "test(dev): the Staff page is told apart by its labelled search box".

**2. GREEN:** `npm exec --no -- vitest run src/dev` — exit 0.
Test Files 7 passed (7); Tests 58 passed (58); Duration 11.94s. Errors: 0 (no "error" lines in output).

**3. MUTANTS** (`src/dev/pageHarness/harnessPages.test.tsx`; `git checkout -- src` after each, tree clean afterwards) — caught 3/3, missed none.
- H1 (`initialTab="Home"`): exit 1, Tests 5 failed | 1 passed (6). Failing: "asks for no command the fixture cannot answer: managers / players / squad / staff / teams" (home passes, as expected). Decisive: Unable to find role "table" name "Managers", `/League$/`, `/Squad$/`, role "textbox" name `/search staff/i`, role "row".
- H2 (delete `get_familiarity`): exit 1, Tests 6 failed (6): home, managers, players, squad, staff, teams. Decisive: `expected [ 'get_familiarity' ] to deeply equal []`; `page harness: no answer for "get_familiarity"`.
- H3 (`return null;`): exit 1, Tests 6 failed (6): home, managers, players, squad, staff, teams. Decisive: Unable to find role "heading" name "Next Match", plus the table/row lookups above.

**4. GATES:**
- `npm run build`: exit 0 (✓ built in 3.66s).
- `npm run lint`: exit 0. Checked 904 files in 1960ms; Found 147 infos (no errors/warnings).
- `npm run knip`: exit 0; only 2 configuration hints (tailwindcss in ignoreDependencies; .css extension).

**5. FRESHNESS:** `(cd src-tauri && cargo test --locked -p ofm_core --example page_fixture)` — exit 0. Finished in 2m 33s (real 2m34.185s). test result: ok. 6 passed; 0 failed; incl. `the_checked_in_fixture_matches_a_fresh_generation ... ok`.
