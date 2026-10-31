Cloud run ofm-mcp-market-1: DONE

Setup: worked. apt packages installed (exit 0); rustup installed pinned toolchain 1.95.0 (rustc 1.95.0 59807616e). npm ci not run — no npm/vitest/biome command in this job.

1. Source `srcmk` @ 60599a08. `git log --oneline -3`:
   - 60599a08 fix(mcp): the transfer market shows each player's rating and wage only as the club knows them
   - df24957f test(transfers): the market test's scouted player has no rating, as the backend sends
   - c0bbb2dc Merge remote-tracking branch 'upstream/develop' into fix/players-list-shows-what-the-club-knows
   - Stacking: parent df24957f is NOT #1046's current tip. #1046 head is now afe040bb ("fix(transfers): the market never shows another club's figures after a club change"), 1 commit ahead of df24957f. All results below are for 60599a08 on df24957f, without afe040bb.

2. Gates
   - fmt --check: exit 0 (2s)
   - clippy -D warnings: exit 0 (328s); --features mcp: exit 0 (61s)
   - test --workspace: exit 0 (1031s), 79 `test result: ok` lines, 4054 passed / 0 failed / 57 ignored
   - test --workspace --features mcp: exit 0 (468s), 79 `test result: ok` lines, 4155 passed / 0 failed / 57 ignored
   - Verdict: PASS

3. Targeted
   - `--lib --features mcp -- market_tests`: exit 0, 4 passed; 0 failed; 645 filtered out
   - `-p mcp-results -- market_rows`: exit 0, 1 passed (market_rows_show_only_what_the_club_may_see); 12 filtered out
   - Verdict: PASS (4 and 1 as expected)

4. Revert checks (each exit 101; file restored after each, tree clean at end)
   - R1 ovr→Some(p.ovr): FAILED the_market_shows_each_player_as_much_as_the_club_knows — caught
   - R2 wage→Some(p.wage()): FAILED the_market_shows_each_player_as_much_as_the_club_knows — caught
   - R3 old exact-wage filter: FAILED the_price_filter_never_matches_a_wage_the_club_cannot_see — caught
   - R4 drop Own condition: FAILED the_listing_and_position_filters_still_apply, the_price_filter_never_matches_a_wage_the_club_cannot_see, the_market_shows_each_player_as_much_as_the_club_knows (3 failed, 1 passed) — caught (expected test included, plus two more)
   - R5 wage_is_approximate: false: FAILED the_market_shows_each_player_as_much_as_the_club_knows — caught
   - R6 max/52→max: FAILED the_price_filter_never_matches_a_wage_the_club_cannot_see — caught
   - Verdict: PASS, 6/6 mutants caught, 0 missed
