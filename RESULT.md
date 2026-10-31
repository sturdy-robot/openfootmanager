Cloud run ofm-design-1014-threads-2: DONE

Setup: worked for the frontend job. `git fetch … cloud-src/ofm-design/1014-threads-2:job` + `git checkout job` OK; HEAD = 157893c0c982d53da490f71f0da518c9de047cb0 (matches expected 157893c0…). `npm ci` exit 0. Biome resolved from node_modules: 2.5.5. apt packages and the Rust toolchain were not installed because the job is frontend-only and needs no cargo.

1. GREEN: `npm exec --no -- vitest run src/designSystem.test.ts` exit 0. Test Files 1 passed (1); Tests 32 passed (32).

2. RED A (rule 8, `BRAND_CLASS` without `inset-ring` and `drop-shadow`): exit 1. Test Files 1 failed (1); Tests 1 failed | 31 passed (32). Failing: "the rule checks themselves > catches the brand green outside a brand file only". Nothing else failed, which matches the expectation. Restored with `git checkout`.

3. RED B (rule 6, `TRANSLUCENT_FOCUS` replaced by `/(?<![\w:-])(?:(?![\w-]*focus)[\w-]+:)*ring-focus\/\d+/g`; the original was a single line, 138): exit 1. Test Files 1 failed (1); Tests 1 failed | 31 passed (32). Failing: "the rule checks themselves > catches a translucent focus marker". Nothing else failed, which matches the expectation. Restored; `git status --short` was empty.

4. FULL GATES (restored tree):
- `npm test`: exit 0. Test Files 316 passed (316); Tests 2878 passed (2878); 0 failed; no timeouts. Duration 231.54s.
- `npm exec --no -- tsc --noEmit`: exit 0, no errors.
- `npm run lint` (`biome lint --error-on-warnings`): exit 0. "Checked 799 files in 765ms. No fixes applied." "Found 148 infos." (no errors or warnings)
- `npm run format:check`: exit 0. "Checked 797 files in 371ms. No fixes applied."
