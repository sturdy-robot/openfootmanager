Cloud run i4-1: DONE

Setup: apt libs installed (exit 0); Rust pin 1.95.0 not needed (no cargo run); `npm ci` exit 0.
Source: fetched sturdy-robot cloud-src/ofm-frontend/i4 -> i4. HEAD a13228a431d830e473b95011eb9bdfe6258093dd "fix(inbox): a refused response is shown as an alert; the buttons enable again and look disabled while in flight". Started on ae5e94e7c56fd180c0873c07b9d51d42fc54c577.

2. GREEN `vitest run src/components/inbox`: exit 0. Test Files 5 passed (5); Tests 60 passed (60).

3. RED a (`setActionError(...)` -> `void error;`), InboxTab.test.tsx: as expected FAIL. Tests 1 failed | 36 passed (37). "shows a refused response and enables the buttons again": TestingLibraryElementError: Unable to find role="alert". Restored with git checkout -- src.

4. RED b (deleted `setIsResolvingAction(false);`), InboxTab.test.tsx: Tests 2 failed | 35 passed (37).
 - "shows a refused response and enables the buttons again": expect(element).toBeEnabled()
 - "enables the response buttons again once the answer lands": expect(element).toBeEnabled()
 Both re-enable tests failed. Restored; tree clean.

5. GATES (on i4):
 - npm run build: exit 0 (230s, run while the full test was also running); "built in 1.79s" for vite.
 - npm run lint: exit 0; Checked 917 files, "Found 141 infos" (no errors).
 - npm run knip: exit 0; only 2 configuration hints (tailwindcss in ignoreDependencies; .css extension).
 - npm test: exit 0; Test Files 368 passed (368); Tests 3412 passed (3412); Duration 313.92s.

No code left changed. Result branch cloud-run/i4-1 = ae5e94e + this commit.
