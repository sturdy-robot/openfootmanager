Cloud run u9-1: DONE

Setup: apt libs installed (exit 0); `npm ci` exit 0. Rust toolchain not needed (frontend-only gates).
Source: fetched cloud-src/ofm-frontend/u9 -> u9. HEAD = 4857df0bb7c1ad530707dc7dd6acc6d5b72335d6 ("fix(digest): drop the import the helper made unused"). Started from ae5e94e7c56fd180c0873c07b9d51d42fc54c577.

Gates:
- `npm run build` — exit 0. "✓ built in 1.63s".
- `npm run lint` — exit 0. "Checked 919 files in 990ms. No fixes applied. Found 141 infos." (no errors; 121 diagnostics not shown due to limit)
- `npm run knip` — exit 0. Only 2 configuration hints (tailwindcss in knip.json ignoreDependencies; .css extension excluded); no unused-file/export findings.
- `npm test` (full) — exit 0. Test Files 369 passed (369); Tests 3414 passed (3414); Duration 362.23s. No failures.
