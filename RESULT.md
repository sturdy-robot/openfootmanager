Cloud run s1-1: PARTIAL

Setup: worked. apt-get update + install of the webkit/gtk/rsvg/appindicator dev packages exit 0; Rust 1.95.0 (pinned in rust-toolchain.toml) installed by rustup with clippy and rustfmt; `npm ci` exit 0 (12.1s).

1. Sources: fetched `cloud-src/ofm-frontend/s1` into `fam`. HEAD = 497dcd3dc66a9af6ee4f2442089d946e83a83ab8 ("fix(season): the awards ceremony and the new-season screen survive the rollover"); fam~1 = 5c587c54 (the test commit).

2. RED (EndOfSeasonScreen.tsx and DashboardTabContent.tsx taken from fam~1), seasonRollover test: exit 1, as expected. Tests 2 failed (2).
   - × shows the awards ceremony and the new-season screen, then Home: `Unable to find an element with the text: Awards Ceremony`
   - × keeps the ceremony when the player leaves Home and returns: `Unable to find an element with the text: Awards Ceremony`
   "Home Tab Mock" was in the rendered DOM in both failures. Afterwards `git checkout fam -- src`; the tree was clean.

3. GREEN: `vitest run src/components src/pages/Dashboard.test.tsx` exit 1. Test Files 1 failed | 248 passed (249); Tests 2 failed | 2309 passed (2311); Duration 237.53s. The same 2 failures happen when the file runs alone:
   - FAIL DashboardTabContent.seasonRollover.test.tsx > shows the awards ceremony and the new-season screen, then Home: `Unable to find an accessible element with the role "button" and name "Continue to dashboard"` (line 116:28). The first click at line 112 (ceremony `endOfSeason.ceremony.continue` = "Continue to dashboard") works. The new-season screen's button is named "Continue to Dashboard", with a capital D (en.json `continueDashboard`).
   - FAIL … > keeps the ceremony when the player leaves Home and returns: `Unable to find an element with the text: Squad Tab Mock` (line 131:19), after the "go to squad" click.

STOPPED here as the job instructs. Steps 4 (mutants S1–S3) and 5 (build, lint, knip, full npm test) were not run. No source changes are left behind.
