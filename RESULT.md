Cloud run i1-3: DONE

**Setup** — worked. apt-get update + install of libwebkit2gtk-4.1-dev, libgtk-3-dev, librsvg2-dev, libayatana-appindicator3-dev: exit 0. Rust 1.95.0 (pinned in rust-toolchain.toml) installed by rustup. Node v22.23.4, npm 10.9.9. `npm ci`: exit 0. vitest 4.1.11, biome 2.5.5.

**1. Sources** — `git fetch https://github.com/sturdy-robot/openfootmanager fix/inbox-response-in-flight:i1`; `git checkout i1`.
HEAD = `d867787baf325d285d902ab356bfd20fd3606250` ("refactor(inbox): the disabled buttons are the guard; no test needs the extra ref").

**2. GREEN** — `npm exec --no -- vitest run src/components/inbox`: exit 0.
Test Files 5 passed (5); Tests 58 passed (58); Duration 6.00s. No failures.

**3. RED** — deleted line 311 `                          disabled={isActionInFlight}` in `src/components/inbox/InboxMessageDetailPane.tsx` (diff: 1 file, 1 deletion); `npm exec --no -- vitest run src/components/inbox/InboxTab.test.tsx`: exit 1.
- FAIL `InboxTab > asks the backend once while a response is in flight`
- `AssertionError: expected [ …(3) ] to have a length of 1 but got 3`
- Test Files 1 failed (1); Tests 1 failed | 34 passed (35); Duration 3.55s.

Expected failure observed — the mutant is caught. `git checkout -- src` restored; `git status` clean.

**4. GATES**
- `npm run build`: exit 0 (tsc + vite, "✓ built in 2.13s").
- `npm run lint` (`biome lint --error-on-warnings`): exit 0. "Checked 917 files in 931ms. No fixes applied. Found 141 infos." (no errors or warnings).
- `npm run knip`: exit 0. No unused-code findings; 2 configuration hints only (`tailwindcss` in knip.json ignoreDependencies, `.css` compiled extension).
- `npm test` (full): exit 0. Test Files 368 passed (368); Tests 3398 passed (3398); Duration 278.07s.
