Cloud run b1-3: DONE

**Setup: worked.** apt-get install of webkit2gtk-4.1/gtk3/rsvg/appindicator dev libs exit 0. Rust 1.95.0 installed from rust-toolchain.toml (rustc 1.95.0 59807616e 2026-04-14). Node v22.23.4. `npm ci` exit 0; Biome resolves to 2.5.5 (not the 0.3.3 impostor).

**1. Sources:** `git fetch https://github.com/sturdy-robot/openfootmanager cloud-src/ofm-frontend/b1:b1` and `git checkout b1`.
HEAD = `feb0ecb3617d702709e17c198d1181f3a435bd2a` "fix(ui): FormResultMark's mapping is typed, the dots test reads the mark, the style guide draws it"

**2. GREEN:** `npm exec --no -- vitest run src/components/ui src/components/dashboard src/components/home src/components/teams src/dev/styleGuide`, exit 0
- Test Files 66 passed (66)
- Tests 533 passed (533)
- Duration 50.13s
- Failures: none

**3. GATES:**
- `npm run build`: exit 0 (tsc clean; vite "✓ built in 1.81s")
- `npm run lint` (`biome lint --error-on-warnings`): exit 0. "Checked 918 files in 886ms. No fixes applied. Found 141 infos." No warnings or errors; 121 infos were left out by the diagnostics limit.
- `npm run knip`: exit 0. No unused files, exports or dependencies reported. 2 configuration hints only: `tailwindcss` (knip.json: "Remove from ignoreDependencies") and `.css` ("Compiled extension excluded by project (imports not followed)").
- `npm test` (full): exit 0
  - Test Files 368 passed (368)
  - Tests 3400 passed (3400)
  - Duration 316.02s
  - Failures: none

No code changes were made.
