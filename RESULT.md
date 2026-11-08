Cloud run d4-1: DONE

Setup: apt install of libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev exit 0. `npm ci` exit 0. No Rust build needed (frontend job).
Started on ae5e94e7c56fd180c0873c07b9d51d42fc54c577 (claude/cloud-runner-d4-1-ujeal3).

1. Source: fetched cloud-src/ofm-frontend/d4 -> d4, checked out.
   HEAD = 40f244f8d71a88be161672c622e27d1419a08154
   "test(i18n): a relegation notice names its division too; the JSDoc sits on resolveMessage again"

2. GREEN: `npm exec --no -- vitest run src/utils/backendI18n.test.ts` exit 0
   Test Files 1 passed (1); Tests 61 passed (61)

3. RED: deleted the relegation line (backendI18n.ts:625), line 624 now ends `;` (only promotion qualifies). Exit 1.
   × names a relegated-to division in the player's language
   Test Files 1 failed (1); Tests 1 failed | 60 passed (61)
   The expected test failed, and it was the only one. Restored with `git checkout -- src` (tree clean).

4. GATES (on unmodified d4):
   - npm run build: exit 0 (tsc + vite build, "built in 1.61s")
   - npm run lint: exit 0, "Checked 917 files in 773ms. No fixes applied. Found 141 infos." (infos only)
   - npm run knip: exit 0 (only 2 configuration hints: tailwindcss in ignoreDependencies, .css extension)
   - npm test: exit 0, Test Files 368 passed (368); Tests 3412 passed (3412); Duration 261.25s
