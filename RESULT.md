Cloud run g3-1: DONE

**Setup:** apt-get update + install webkit2gtk/gtk3/rsvg/appindicator dev libs: exit 0. Rust 1.95.0 (rust-toolchain.toml) installed via rustup. `npm ci`: exit 0. Biome 2.5.5 (real, from node_modules).

**1. Sources:** fetched `cloud-src/ofm-frontend/g3` → `g3`. HEAD `7b5fcf843a2417556bf2da4a39c62800230c5060` ("test(i18n): a default value that is the key itself does not exempt it"). `origin/HEAD` does not exist in this clone (git: unknown revision), so that command printed nothing. Against `origin/develop` the branch adds 3 commits: 7b5fcf84, 330dee13, 354a1347 on top of a0a809bf (Merge #1255). Diff vs a0a809bf touches 9 files (index.ts, missingKeys.ts/.test.ts, test-setup.ts, backendI18n.ts/.test.ts, advanceRecap/commentary/errorMessage tests) — no inbox file.

**2. `vitest run src/i18n/missingKeys.test.ts`:** exit 0 — Test Files 1 passed (1), Tests 3 passed (3).

**3. RED (deleted `reportMissingKey(languages[0] ?? "", key);`):** exit 1 — Tests 2 failed | 1 passed (3). Failed: "reports a key no locale has and stays quiet for one that exists", "reports a key whose default value is the key itself". Passed: "stays quiet for a key asked with a default value". As expected. Restored.

**4. RED2 (`options.defaultValue !== key` → `true`):** exit 1 — Tests 1 failed | 2 passed (3). Failed: "reports a key whose default value is the key itself". As expected. Restored (`git status` clean).

**5. FULL `npm test`:** exit 0 — Test Files 369 passed (369), Tests 3409 passed (3409), Duration 302.62s. Failures: none. "Rendered translation keys that no locale has" occurrences: 0 — zero gate trips, confirming the previous run.

**6. GATES:**
- `npm run build` (tsc && vite build): exit 0, "built in 1.95s".
- `npm run lint`: exit 0 — "Checked 919 files in 924ms. No fixes applied. Found 141 infos." (no errors/warnings).
- `npm run knip`: exit 0 — only 2 configuration hints (tailwindcss in ignoreDependencies; .css compiled extension), no unused findings.
