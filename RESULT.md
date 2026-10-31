Cloud run ofm-design-starter-edge-1: DONE

**Setup: worked.** apt-get install of the webkit/gtk/rsvg/appindicator dev packages exited 0. Rust 1.95.0 was installed from rust-toolchain.toml with clippy and rustfmt. Node v22.23.4, npm 10.9.9. `npm ci` exited 0. Biome reports version 2.5.5.

**1. Checkout.** Fetched `cloud-src/ofm-design/starter-edge` into `job`. HEAD is `0fe99c06439fc72ba1918e7972044c6347d07fd1` ("refactor(ui): DataTable's starter edge is the selected role, not positive") (as expected).

**2. GREEN** (exit 0): Test Files 5 passed (5), Tests 110 passed (110), 13.40s.
- src/components/ui/DataTable.test.tsx: 16/16
- src/components/squad/SquadTab.test.tsx: 25/25
- src/components/squad/SquadTab.helpers.test.ts: 29/29
- src/dev/styleGuide/StyleGuide.test.tsx: 8/8
- src/designSystem.test.ts: 32/32

**3. RED** (exit 1): changed `DataTable.tsx:77` to `selected: "border-l-positive",`. Result: Tests 2 failed | 14 passed (16). The failures were exactly the 2 expected tests:
- DataTable > marks a row with its accent
- DataTable > keeps the accented first column when it asks to fold

Restored with `git checkout --`. `git status --short` was empty afterwards.

**4. GATES**
- `tsc --noEmit`: exit 0, no output.
- `npm run lint` (`biome lint --error-on-warnings`): exit 0. "Checked 806 files in 857ms. No fixes applied. Found 148 infos." There were 0 errors and 0 warnings.
- `npm run format:check`: exit 0. "Checked 804 files in 385ms. No fixes applied."
- `npm run knip`: exit 0. It printed only 2 configuration hints: "tailwindcss: Remove from ignoreDependencies" and ".css: Compiled extension excluded by project". It reported no unused files or exports.
- `npm test`: exit 0. Test Files 319 passed (319), Tests 2913 passed (2913), Duration 278.20s. No failures.

**5. BUILD**
- `npm run build`: exit 0, "✓ built in 2.06s".
- The class is emitted in `dist/assets/index-DUvrwJjh.css` as `border-l-selected{border-left-color:var(--color-selected)}`.
- It uses `--color-selected`: `#047857` under `@theme`, `#34d399` under `.dark` (src/App.css:193, :274).

No code was changed apart from the restored RED mutation.
