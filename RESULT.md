Cloud run g5-1: DONE

**Setup:** worked. apt libs installed (exit 0); Rust 1.95.0 (pinned) present; `npm ci` exit 0.
**Sources:** `g5` fetched from sturdy-robot/openfootmanager `cloud-src/ofm-frontend/g5`. HEAD = 433ae22795ffb5d3e7f35b87a020bc561c2143f1 ("test(i18n): the gate sees a missing key-shaped value behind exists() and behind a default that is a key; the deliberate drains assert their keys").

**2. Targeted vitest** (missingKeys.test.ts, src/utils, commentary.test.ts, advanceRecap.test.ts): exit 0. Test Files 8 passed (8); Tests 126 passed (126); 4.01s.

**3. RED a** (deleted `reportIfKeyShaped(i18n.language, value);` in backendI18n.ts): exit 1. Tests 2 failed | 11 passed (13). Failed, as expected:
- reports a key-shaped param that has no text
- reports a backend error that is a key without text
Restored with `git checkout -- src`.

**4. RED b** (replaced the `typeof fallback === "string" && looksLikeTranslationKey(fallback)` condition in i18n/index.ts with `false`): exit 1. Tests 1 failed | 12 passed (13). Failed, as expected:
- reports a key whose default value is itself a key
Restored with `git checkout -- src`; tree clean.

**5. FULL `npm test`:** exit 0. Test Files 370 passed (370); Tests 3424 passed (3424); Duration 251.11s (wall 6m49s). No failures, so no "Rendered translation keys that no locale has" output to list (none).

**6. GATES:**
- `npm run build`: exit 0 (built in 1.11s; only an INEFFECTIVE_DYNAMIC_IMPORT warning for en.json).
- `npm run lint`: exit 0. "Checked 921 files in 800ms. No fixes applied. Found 141 infos."
- `npm run knip`: exit 0. Only 2 configuration hints (tailwindcss in ignoreDependencies; .css extension).

No code changes remain; the mutations were reverted.
