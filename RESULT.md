Cloud run ofm-design-harness-tactics: DONE (every step ran; the red tests below are findings)

**Setup worked:** apt exit 0, Rust 1.95.0 installed from rust-toolchain.toml, `npm ci` exit 0 (biome in node_modules/.bin).

1. Fetched `job`. `git log --oneline -2`: `11b00073 feat(dev): the page harness opens the Tactics tab` / `481e9914 Merge upstream/develop into fix/page-harness-familiarity`.
2. `npm run fixture:pages` exit 0 (3m05s). Diff: `fixture.generated.ts | 15 ++++++++++++++-` (14+, 1−; the other change is the `AutoSetPieces` type import). The only new exports are the three expected ones, **but they are empty**: `tacticsBlueprintStatus = {modified: true}`, `autoSetPiecesFor = []` (**0 ids**), `autoSetPieces` with captain, corner_taker, free_kick_taker and penalty_taker all `null`. What I saw: `export_tactics` reads `team.starting_xi_ids`. That list is empty in the generated career, so `autoSetPiecesFor` is `[]`, yet the tab still sends 11 ids. I did not trace where the tab's ids come from. Committed **aaf158fc**.
3. vitest pageHarness+scripts: exit 1, **3 failed | 76 passed (79)**. Failed:
   - `answers the Tactics tab's mount queries for the club's eleven only`: `expected 0 to be greater than 0` (line 47).
   - `asks for no command the fixture cannot answer: tactics`: `auto_select_set_pieces` unanswered. The tab sent the 11 ids listed after step 3. `autoSetPiecesFor` is `[]`, so `sameIds` fails for any request that isn't empty.
   - `…: staff`: no button `/release staff member/i`. This fails the same way with 481e9914's pageHarness, so it is not caused by 11b00073.
   ```
   bc579ccf-0548-4973-8dc4-ecda95702d64 9eddcad9-b2fb-4c33-b55a-71abc4726a64 04886981-4e0a-4373-8133-8bc9b2b3663e
   aa153c31-5962-471d-82b6-4626d1ddaa99 e41b20dc-7bcf-4858-a3bd-fdc439a7f509 70bb8091-431e-4a07-9a80-d1da9f75f757
   ebc6a46e-0594-494f-8931-fe2b457a15fc 7ebf4a65-6732-4513-a213-b76017087ad5 3e225c13-89a6-4e08-9c85-9c1c6dce6aee
   9b261d9f-ddbd-4704-8f2a-77e72fd889c7 525ef9dc-dd37-4647-b044-4d30d43c6da4
   ```
   The other 76 passed, including all of harnessPage.test.ts (`reads the tactics page` too).
4. RED (`sameIds` → `true`): 1 failed | 16 passed (17). It failed at the same `length > 0` assertion as the unmutated run, so the run **does not discriminate**. The test checks `autoSetPiecesFor.length > 0` before it reaches the `sameIds` call, so with an empty fixture the mutated line never runs. Restored.
5. Layout check exit 1: **27 of 30 cases pass**. The script has 30 cases, not 33: base 27 plus 3 tactics. All ok except `FAIL tactics 1280×800 normal en`, `960×640 normal en` and `960×640 xlarge de`, each with `unanswered commands: auto_select_set_pieces {playerIds:[the 11 above]}`. There were no layout problem lines.

   | page | 1280×800 en | 960×640 en | 960×640 xlarge de |
   |---|---|---|---|
   | style guide | ok | ok | ok |
   | home | ok | ok | ok |
   | squad | ok | ok | ok |
   | players | ok | ok | ok |
   | teams | ok | ok | ok |
   | managers | ok | ok | ok |
   | staff | ok | ok | ok |
   | tactics | FAIL | FAIL | FAIL |
   | players (cards) | ok | ok | — |
   | squad (cards) | ok | ok | — |
   | teams (cards) | ok | ok | — |

6. `cargo test -p ofm_core --example page_fixture` exit 0, 6 passed (`the_checked_in_fixture_matches_a_fresh_generation` ok). clippy exit 0. fmt check exit 0. `npm test` exit 1: Tests 3 failed | 3343 passed (3346), Files 2 failed | 360 passed (362), the same 3 failures. tsc exit 0. lint exit 0 (147 infos). format:check exit 0 (902 files).

No other tracked file changed.
