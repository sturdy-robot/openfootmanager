Cloud run d3-1: DONE

**Setup: worked.** apt-get update + install webkit2gtk-4.1/gtk-3/rsvg2/ayatana-appindicator3 dev packages: exit 0. Rust 1.95.0 (rust-toolchain.toml pin) installed by rustup. Node v22.23.4. `npm ci`: exit 0 (11.9s). Biome is the real package (`biome --version` → 2.5.5).

**1. Sources:** `git fetch https://github.com/sturdy-robot/openfootmanager cloud-src/ofm-frontend/d3:fam` → `git checkout fam`.
HEAD = `a08a8021e1ff7ff11fcf58ac9331b4a41d93a33f` "test(digest): a press-conference headline carries the quote only the resolver builds; the recap layer is asserted".

**2. GREEN:** `vitest run src/components/dashboard` exit 0 — Test Files 13 passed (13); Tests 157 passed (157); Duration 11.83s.

**3. MUTANTS** (advanceRecap.test.ts + DashboardSimulatingModal.test.tsx; `git checkout -- src` after each, tree clean afterwards):
- **P1 (headline via i18n.t): CAUGHT**, exit 1. Test Files 1 failed | 1 passed (2); Tests 2 failed | 30 passed (32).
  - `advanceRecap > keeps key news but drops routine and transfer-duplicate categories`: expected 'news.injury' to be 'Star out injured'.
  - `advanceRecap > draws a press-conference headline with the quote the resolver builds`: Expected `Press Conference: "The players worked hard. We prepared well and executed the game plan." — User FC boss`, Received `Press Conference: "{{quote}}" — User FC boss`. The quote is missing, as R3 described.
- **P2 (subject via i18n.t): CAUGHT**, exit 1. Test Files 1 failed | 1 passed (2); Tests 1 failed | 31 passed (32).
  - `DashboardSimulatingModal backend text > translates the params of an inbox subject that are themselves keys` (recap-layer assertion, line 187): expected `["Match injury — John Star (Hamstring tear)", "Dressing Room Report — Mood: Excellent"]`, received `["Match injury — John Star (common.injuries.hamstringTear)", "Dressing Room Report — Mood: common.moods.excellent"]`.

**4. GATES:**
- `npm run build`: exit 0 (27s, "✓ built in 1.77s").
- `npm run lint` (`biome lint --error-on-warnings`): exit 0. "Checked 903 files in 1092ms. No fixes applied. Found 147 infos." No errors or warnings.
- `npm run knip`: exit 0. It printed only 2 configuration hints (tailwindcss in ignoreDependencies; .css extension excluded) and no unused-code findings.
