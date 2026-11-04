Cloud run x1-1: DONE

Result branch base: ae5e94e (the commit this session started on). Tested source: `fam` = cloud-src/ofm-frontend/x1, HEAD feeec75537357496de2cc1c78291bdd1c9481082 ("fix(squad): an XI rebuilt from fewer than eight saved players uses the whole pool"); fam~1 = d5df35c5 (test commit).

**Setup — worked.** apt-get update + install webkit2gtk-4.1/gtk-3/rsvg2/ayatana: exit 0. Rust 1.95.0 (rust-toolchain.toml) installed with clippy, rustfmt. Node v22.23.4. `npm ci`: exit 0, 13.2s. vitest 4.1.11, Biome 2.5.5.

**1. Sources** — fetch + checkout fam: OK, HEAD feeec755.

**2. RED** — `git checkout fam~1 -- src/components/squad/SquadTab.helpers.ts`; vitest SquadTab.helpers.test.ts: exit 1.
- `× rebuilds a full XI when fewer than eight saved players remain`
- `AssertionError: expected [ Array(9) ] to have a length of 11 but got 9`
- Tests 1 failed | 39 passed (40), 1.76s. Exactly one failure, as expected. Restored with `git checkout fam -- src` (tree clean).

**3. GREEN** — vitest squad, tactics, match, playerProfile, dashboard: exit 0.
- Test Files 75 passed (75); Tests 801 passed (801); 87.48s.

**4. MUTANT** — deleted `used.clear();` (line 332); vitest SquadTab.helpers.test.ts: exit 1 — mutant CAUGHT.
- Caught by: `rebuilds a full XI when fewer than eight saved players remain` — `expected [ Array(9) ] to have a length of 11 but got 9`
- Tests 1 failed | 39 passed (40), 1.48s. Missed: none. Restored with `git checkout -- src` (tree clean).

**5. GATES**
- `npm run build` (tsc && vite build): exit 0, 28s, "✓ built in 2.58s".
- `npm run lint` (biome lint --error-on-warnings): exit 0, 2s, "Checked 903 files in 1095ms. No fixes applied. Found 147 infos." (no errors or warnings).
- `npm run knip`: exit 0, 2s; 2 configuration hints only (tailwindcss in ignoreDependencies; .css extension excluded).
- `npm test` (full): exit 0, 332s — Test Files 361 passed (361); Tests 3338 passed (3338); Duration 330.95s.
