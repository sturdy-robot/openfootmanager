Cloud run x2-1: DONE

**Setup** — worked. apt-get update + install webkit2gtk-4.1/gtk-3/rsvg2/ayatana deps: exit 0. Rust 1.95.0 (pinned by rust-toolchain.toml) installed via rustup. Node v22.23.4. `npm ci`: exit 0. Biome resolves to 2.5.5 (the real one, not the 0.3.3 impostor).

**1. Sources** — `git fetch https://github.com/sturdy-robot/openfootmanager cloud-src/ofm-frontend/x2:fam`, `git checkout fam`.
HEAD = `ad5df1d886d5570b03ad523ed21ccfced3f89cad` "test(squad): a saved player may be picked again by the rebuild, in a squad of twenty".

**2. RED** — deleted `used.clear();` (src/components/squad/SquadTab.helpers.ts:333). `npm exec --no -- vitest run src/components/squad/SquadTab.helpers.test.ts`: exit 1.
- × rebuilds a full XI when fewer than eight saved players remain — `AssertionError: expected [ Array(9) ] to have a length of 11 but got 9`
- × rebuilds from the whole pool, saved players included — `AssertionError: expected 'm10' to be 'gk' // Object.is equality` (Expected "gk", Received "m10")
- Test Files 1 failed (1); Tests 2 failed | 39 passed (41)

Both expected tests failed, and nothing else did. `git checkout -- src` restored the file; the tree was clean afterwards.

**3. GREEN** — `npm exec --no -- vitest run src/components/squad src/components/tactics`: exit 0.
Test Files 13 passed (13); Tests 214 passed (214); Duration 33.66s.

**4. GATES**
- `npm run lint` (`biome lint --error-on-warnings`): exit 0. "Checked 903 files in 1006ms. No fixes applied. Found 147 infos." 0 errors, 0 warnings.
- `npm run knip`: exit 0. No unused files, exports or dependencies were reported. It printed only 2 configuration hints: `tailwindcss` in knip.json can be removed from ignoreDependencies, and `.css` is a compiled extension excluded by the project.
