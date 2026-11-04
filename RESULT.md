Cloud run e1-1: DONE

**Setup: worked.** apt install exit 0; Rust 1.95.0 (pinned) installed; Node v22.23.4; `npm ci` exit 0.

**1. Sources.** `fam` HEAD = `5d649b021306088005de53a327d9264510ff2dcf`.

**2. RED** (pre-fix errorMessage.ts): exit 1, Tests 2 failed | 2 passed (4). Both expected failures:
- translates a param that is itself a key: Received `"be.error.squadFloor.wouldLeaveShort?group=common.positionGroups.Goalkeeper"`
- formats a money param with the currency: Received `"be.error.contracts.boardWagePolicy?budget=75000"`

**3. GREEN — FAILS.** `npm test`: exit 1, Test Files 7 failed | 355 passed (362); Tests 4 failed | 3283 passed (3287); Errors 2; 280.21s.
- errorMessage.test.ts > resolveTranslatedErrorMessage > translates a param that is itself a key: expected to contain "Position group affected: Goalkeeper." but got "…Position group affected: Goalkeepers." (plural)
- PlayerProfile.test.tsx > PlayerProfile contract surfaces > localizes the no-assistant delegation error if the command still fails: Unable to find text "Hire an assistant manager before delegating contract talks."
- PlayerProfile.test.tsx > PlayerProfile contract surfaces > localizes contract action failures instead of showing raw backend keys: Unable to find text "This player does not have an active contract."
- TransfersTab.loans.test.tsx > TransfersTab > surfaces listing toggle failures from the my-list context menu: expected "Player already loaned", received "be.error.transfers.playerAlreadyLoaned"
- Suites failed to load: usePlayersListActions.test.ts, ScheduleTab.test.tsx, PlayerProfileActionsMenu.test.tsx, TeamsListTab.test.tsx. Error: `No "initReactI18next" export is defined on the "react-i18next" mock` (via backendI18n.ts:1)
- 2 unhandled rejections (PlayerProfile.test.tsx): `No "resolveBackendError" export is defined on the "../../utils/backendI18n" mock`

**4. MUTANTS**
- E1 (`extractErrorMessage` only): CAUGHT. 2 failed: the param-key test and the money test.
- E2 (`resolveBackendError` only): exit 1, only failure is the param-key test, which already fails unmutated: **in effect MISSED**. No test covers unknown shapes. Probe (temp file, deleted), `[{}, null, undefined, 42]` gave `["[object Object]","null","undefined","42"]` on fam and `["","","",""]` under E2: the banner would be blank.

**5. GATES:** build exit 0 (built in 1.89s); lint exit 0 (147 infos); knip exit 0 (2 config hints).
