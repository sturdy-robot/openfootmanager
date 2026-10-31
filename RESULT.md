Cloud run ofm-mcp-state-4a-1: DONE

Source: `src4a` @ `8cb13c91`. Setup OK (apt deps + xvfb, Rust 1.95.0). One gate is red: 2e.

**2a** fmt --check: exit 0. PASS
**2b** clippy: exit 0, 5m 56s. PASS
**2c** clippy --features mcp: exit 0, 1m 02s. PASS
**2d** test --workspace: exit 0, 76/76 `test result: ok`, 3870 passed / 0 failed / 56 ignored, 5m 07s. PASS
**2e** test --workspace --features mcp: exit 101. FAIL
- As run: 48 of 49 lines ok, 3814 passed / 1 failed / 33 ignored.
- With `--no-fail-fast`: 75 of 76 ok, 3959 passed / 1 failed / 56 ignored.
- FAILED: `mcp_server::tools::tests::the_docs_match_the_competition_mode_decision`. Panic at tools.rs:2430: "the implementation comment must state the decision".
- Cause: the doc comment at `tools_impl/info.rs:82-83` wraps "not / available in competition mode" across two lines, so `contains(...)` never matches.

**3** Baseline (unmutated): exit 101, 13 passed, 1 failed (the docs test, same as 2e). Every restore went back to exactly that.
- M1: expected test FAILED (the_dev_dump_exists_only_when_asked_for), plus the_dev_flag_cannot_be_combined_with_competition_mode. CAUGHT
- M2: the_dev_flag_cannot_be_combined_with_competition_mode FAILED. CAUGHT
- M3: competition_hides_the_setup_tools_and_the_state_dumps and competition_never_lists_a_state_dump FAILED. CAUGHT. The docs test fails for the 2e reason, so it can't be checked here.
- M4: the_dev_dump_exists_only_when_asked_for FAILED. CAUGHT

**4** The build first ran out of disk (ENOSPC). I freed target/debug/incremental and the old test binaries, then rebuilt: exit 0, 1m 24s.
- foundation: exit 0, 9 passed / 0 failed (78.67s). catalog_matches_the_live_server ok.
- smoke: exit 0, 12 passed / 0 failed / 3 filtered out (108.43s). the_file_on_disk_holds_what_the_game_holds, competition_omits_and_rejects_info_game_state and competition_omits_and_rejects_dev_full_game_state are all ok.

**Verdicts:** 2a PASS, 2b PASS, 2c PASS, 2d PASS, 2e FAIL (1 test), M1 CAUGHT, M2 CAUGHT, M3 CAUGHT (the docs test can't be checked), M4 CAUGHT, 4 PASS.
