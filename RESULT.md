Cloud run b18: PARTIAL

Setup: worked (apt libs installed; Rust 1.95.0 from rust-toolchain.toml auto-installed; `npm ci` ok; `node scripts/ensure-page-fixture.mjs` exit 0, generated fixture.generated.ts 666 KB).
Fetched `cloud-src/ofm-design/apply18` as `job`. `git log --oneline -3`:
- f5aa2728 Merge remote-tracking branch 'upstream/develop' into fix/tactics-apply-timing
- 04b9512a fix(tactics): the write queue is per career, so a new career's apply does not wait for the old one's reply (#1447)
- 6e0667cc test(tactics): a new career's apply is sent without waiting for the old career's held reply (red, #1447)

Results (fixed nothing):
- tsc --noEmit: exit 0
- vitest run src/components/tactics src/i18n: exit 1. Test Files 1 failed | 44 passed (45); Tests 1 failed | 413 passed (414).
  FAIL src/components/tactics/useTacticsBusy.career.test.ts > the tactic bar's busy state across careers > reopens when the career changes, and an old apply's completion cannot clear a new one
  Error: b is in the library (thrown at useTacticsBusy.career.test.ts:94:23 in `entry`, called from :127:64)
- npm run build: exit 0
- npm run lint: exit 0 (156 infos, 0 errors)
- npm run format:check: exit 0 (1110 files)
- npm run knip: exit 0 (2 configuration hints only: tailwindcss in ignoreDependencies; .css extension excluded)
- npm test: exit 1. Test Files 1 failed | 460 passed (461); Tests 1 failed | 4454 passed (4455). Only failure is the same test as above.
- git status --short: empty after all steps (checked before the branch switch; RESULT.md is the only addition afterwards).

Note: I also ran `npx tsc --noEmit` once by mistake before the direct node_modules tsc run; both exit 0.
