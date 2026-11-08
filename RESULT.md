Cloud run g4-1: DONE

Setup: apt libs installed (exit 0); `npm ci` exit 0. Rust not needed (frontend job).
1. g4 fetched from sturdy-robot/openfootmanager. HEAD 6ea7ab22bc56e9e8ce37234999dd0ecbc2675633 ("Merge remote-tracking branch 'upstream/develop' into test/i18n-missing-key-gate-clean"). `git log origin/HEAD..HEAD` printed nothing (origin/HEAD unset). origin/develop (ce26c01e) is already an ancestor of g4, so the tip already contains develop.
2. missingKeys.test.ts: exit 0, Test Files 1 passed (1), Tests 3 passed (3).
3. RED (deleted `reportMissingKey(languages[0] ?? "", key);`): 2 failed | 1 passed. Failed: "reports a key no locale has and stays quiet for one that exists", "reports a key whose default value is the key itself". Caught. Restored.
4. RED2 (`options.defaultValue !== key` -> `true`): 1 failed | 2 passed. Failed: "reports a key whose default value is the key itself". Caught. Restored.
5. `npm test`: exit 0. Test Files 369 passed (369); Tests 3412 passed (3412); Duration 303.02s (wall 8m15s). Failures: none, so no "Rendered translation keys that no locale has" lines. 0 gate trips.
6. Gates: `npm run build` exit 0 (24s, built in 1.32s); `npm run lint` exit 0 (Checked 919 files, no fixes, 141 infos); `npm run knip` exit 0 (2s, only config hints).
Source tree restored (git status clean) after the mutants.
