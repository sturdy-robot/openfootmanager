Cloud run g2-1: DONE

**Setup: worked.** apt-get install exit 0; rustup installed pinned 1.95.0 (`rustc 1.95.0 (59807616e 2026-04-14)`); node v22.23.4; `npm ci` succeeded (biome 2.5.5 local).

**1. Sources.** Fetched `cloud-src/ofm-frontend/g2` → `g2`. `git checkout g1` failed: `pathspec 'g1' did not match` — no g1 exists, so ran on **g2**. HEAD `c079337b2aa635d34122383c028340d58269f985` ("test(i18n): the gate ignores a key asked with a default value; …").

**2. `vitest run src/i18n/missingKeys.test.ts`** — exit 0. Test Files 1 passed (1); Tests 2 passed (2).

**3. RED** (deleted `reportMissingKey(languages[0] ?? "", key);`, index.ts:108) — exit 1. Tests **1 failed | 1 passed (2)**. Expectation "both FAIL" **not met**:
- FAILED: `missing translation keys > reports a key no locale has and stays quiet for one that exists` — `expected [] to deeply equal [ 'be.msg.noSuchMessage.subject' ]`
- PASSED: `missing translation keys > stays quiet for a key asked with a default value` (it asserts silence, so removing the reporter can't fail it).
Restored with `git checkout -- src`; tree clean.

**4. FULL `npm test`** — exit 1, 7m29.8s wall. Test Files 1 failed | 368 passed (369); Tests 1 failed | 3399 passed (3400); Duration 275.33s.
- **Gate trips: 0.** No "Rendered translation keys that no locale has" message anywhere in the output. Distinct keys: none.
- Caveat on coverage: `src/test-setup.ts` is wired (`vite.config.ts:147 setupFiles`), but **155 of 369** test files `vi.mock("react-i18next")`, so their `t` never reaches the `missingKeyHandler` — the gate can't see keys in those files. (InboxTab is one: its DOM shows raw `common.all`, a key en.json has.)
- The only failure is not the gate: `src/components/inbox/InboxTab.test.tsx > InboxTab > asks the backend once while a response is in flight` — `TestingLibraryElementError: Unable to find an element with the text: No renewal`. Deterministic (fails 2/2 in isolation) and **pre-existing**: it fails the same way at `0b57b623` (the commit before the two gate commits), run in a throwaway worktree.

**5. GATES**
- `npm run build` — exit 0 (`✓ built in 1.83s`).
- `npm run lint` — exit 0 (`biome lint --error-on-warnings`; "Checked 919 files in 813ms… Found 141 infos.").
- `npm run knip` — exit 0 (2 configuration hints only: `tailwindcss` in ignoreDependencies, `.css` extension).
