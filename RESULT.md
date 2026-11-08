Cloud run d3-1: DONE

Setup: apt libs installed (exit 0); `npm ci` exit 0; rust-toolchain.toml pins 1.95.0 (not needed, frontend-only job).
Started on ae5e94e7c56fd180c0873c07b9d51d42fc54c577; d3 fetched and checked out.

1. HEAD of d3: 40f244f8d71a88be161672c622e27d1419a08154 ("test(i18n): a relegation notice names its division too; the JSDoc sits on resolveMessage again")

2. GREEN `npm exec --no -- vitest run src/utils/backendI18n.test.ts`: exit 0. Test Files 1 passed (1); Tests 61 passed (61).

3. RED (only promotion qualifies in isDivisionChange): exit 1. Test Files 1 failed (1); Tests 1 failed | 60 passed (61). Failing: `resolveMessage > names a relegated-to division in the player's language`. Reverted with `git checkout -- src`; tree clean.

4. GATES (on unmodified d3):
- npm run build: exit 0 ("built in 1.44s")
- npm run lint: exit 0 (Checked 917 files; no fixes applied; 141 infos)
- npm run knip: exit 0 (2 config hints: tailwindcss in ignoreDependencies; .css extension excluded)
- npm test: exit 0. Test Files 368 passed (368); Tests 3412 passed (3412); Duration 342.40s
