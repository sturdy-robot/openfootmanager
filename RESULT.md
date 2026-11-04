Cloud run prl-stats: DONE

Setup OK: apt exit 0; Rust 1.95.0 (rust-toolchain.toml); cargo-mutants 27.1.0; `npm ci` exit 0. Started on ae5e94e7. Disk ran out twice (ENOSPC at the 39G allowance): wiped `target/debug`, then ran steps 6b–11 with `CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 CARGO_INCREMENTAL=0`.

**Headline: fix 2698db91 ships a red test.** `engine --test rating_tests::the_keeper_in_goal_for_most_of_a_clean_sheet_keeps_it` fails at 2698db91 and at head: `panicked at crates/engine/tests/rating_tests.rs:267:5: assertion failed: report.player_stats["home_Goalkeeper_0"].clean_sheet`. Likely cause: `MatchReport` counts goals from events (`report.rs:370`), so `test_set_score(0, 0)` never reaches `assign_ratings` and a simulated away goal (seed 5) removes the clean sheet. Also at head: clippy fails (step 5), and after the step-10 fixture regeneration `npm run build` (tsc) fails. Steps 1–11 all ran; their deviations are described in the rows below.

| Step | Result |
|---|---|
| 1 | HEAD 10949ac4; log 10949ac4 5b983f9b b5081113 a8bd06ac 2698db91 802c7772 5029fc66 |
| 2a 802c7772 | exit 101, 2p/2f: `…last_minutes…` (turn_tests.rs:647 left: 1 right: 0), `…sent_off_early…` (661, left: 1 right: 0) |
| 2b a8bd06ac | exit 101, 1p/1f: friendly fails (591, left: (1, 2) right: (0, 0)); cup_tie ok |
| 2c 5b983f9b | exit 101, 0p/1f: golden_boot (648, left: ("t1_fwd0", 4.0) right: ("t1_fwd1", 2.0)) |
| 3 2698db91 | turn_tests 114p/0f; engine --lib rating 17p/0f (53 filtered); rating_tests **7p/1f** (above) |
| 3 b5081113 | turn_tests 116p/0f |
| 3 head | turn_tests 119p/0f; db 411p/0f/1i + 1p + 1p + 0 (doc); end_of_season_tests 114p/0f; rating_tests still 7p/1f |
| 4 | under the three named suites (rating_tests 7p/1f under every mutant = baseline, not a kill): C1 **SURVIVES** (caught only by `engine --lib rating`: a_clean_sheet_is_shared_only_by_a_player_on_for_most_of_it, a_clean_sheet_needs_a_real_shift). C2 turn 116p/3f: a_keeper_sent_off_early…, a_keeper_on_for_the_last_minutes…, apply_match_report_gk_no_clean_sheet_on_conceding. F1 turn 118p/1f: a_friendly_is_not_part_of_a_players_season_stats. L1 turn 117p/2f: a_cup_tie_is_not_part_of_a_players_league_season, a_divisions_golden_boot_counts_its_league_goals_alone. L2 turn 118p/1f: golden_boot. L3 db 410p/1f: player_repo::tests::test_player_league_stats_roundtrip. L4 db 410p/1f: test_a_player_saved_before_league_stats_reads_his_season_as_his_league_season. L5 db 410p/1f: legacy_migration::tests::test_migrate_legacy_save_reads_its_season_as_the_league_season. L6 **SURVIVES** (caught only by end_of_season_tests::player_stats_reset, 113p/1f). All restored, status empty. |
| 5 | fmt --check exit 0. clippy exit 101, and the same with `--features mcp`: `error: deref which would be done by auto-deref --> crates/ofm_core/src/season_awards.rs:144:33` `season(*player)` → `player` (clippy::explicit_auto_deref; added in 10949ac4). Both runs stop at ofm_core lib, so the crates after it were not linted. 3 ts-rs "failed to parse serde attribute" notes (not 6). |
| 6 | `--workspace` (fail-fast) exit 101, 13m49.754s: stopped after 12 suites, 687p/1f/2i (rating_tests). Rerun `--no-fail-fast` exit 101, 12m31.744s: 96 suites, **4562p/3f/63i**. Failures: rating_tests (above); `ofm_core --example page_fixture` tests::the_checked_in_fixture_matches_a_fresh_generation: "src/dev/pageHarness/fixture.generated.ts is stale: run `npm run fixture:pages` and commit it. First difference, line 179, column 869" (league_stats); wire_types the_checked_in_typescript_matches_the_rust_wire_types: "src/store/generated no longer matches the Rust wire types: out of date: Player.ts / out of date: SquadPlayer.ts". `--lib --features mcp` exit 0, 4m13.185s: 686p/0f/1i |
| 7 | migrations::tests::shipped_migrations_are_never_edited_in_place ok; lists ("v064_player_league_stats.sql", 0x877d34d1535c0e66) |
| 8 | both exit 0 |
| 9 | regen exit 0 (9p); recheck exit 0 (9p). Diff below; it also touches SquadPlayer.ts |
| 10 | fixture:pages exit 0 (697 KB). build exit 2; vitest exit 0. Details below |
| 11 | At head, cargo-mutants rejects fix1 and fix2 (`ERROR Diff content doesn't match source file: crates/ofm_core/src/turn/post_match.rs line 8` / the `apply_player_stats(game, report, &both_clubs);` line), so fix1 ran at 2698db91 and fix2 at b5081113. Run exactly as given, fix1 and fix3 fail their baseline (`ERROR cargo test failed in an unmutated tree, so no mutants were tested`: rating_tests / page_fixture), so they were rerun with that one test skipped (`-- -- --skip <name>`). fix1@2698db91 (skip the_keeper_in_goal…): 15 mutants, 14m, **13 caught / 2 missed / 0 unviable / 0 timeout**. MISSED: `crates/engine/src/rating.rs:65:61: replace && with || in MatchReport::assign_ratings`; `crates/engine/src/rating.rs:65:37: replace == with != in MatchReport::assign_ratings` (both are the cases the skipped red test should cover). fix2@b5081113: 1 mutant, 5m, **1 caught / 0 missed / 0 unviable / 0 timeout** (baseline 123s build + 48s test). fix3@head (skip the_checked_in_fixture…): 63 mutants, 2h, **58 caught / 1 missed / 4 unviable / 0 timeout**. MISSED: `crates/ofm_core/src/turn/post_match.rs:502:20: replace += with *= in add_match` (`season.assists += ps.assists`; no test asserts a season's assists). `git diff` empty after each run. |

**Step 8 FINGERPRINT lines**
5029fc66: gate seed 1 two seasons 5775029d54549864 · gate seed 2 two seasons b33856a558913d0d · gate seed 3 two seasons 9263c787c520059b · authored-only club squads b8239a111741d47a · shipped seed 1 one season 24423b95ea27c6d3 · shipped seed 1 one season every match real 47d90d083f3e0885
head: gate seed 1 two seasons 843e8e033673aeae · gate seed 2 two seasons c0504b5156f2c21a · gate seed 3 two seasons 5842464cf7b20c66 · authored-only club squads b8239a111741d47a · shipped seed 1 one season 51a93b9f18602e22 · shipped seed 1 one season every match real 5a132bdc72c9e6de

**Step 9 diff (verbatim)**
```diff
diff --git a/src/store/generated/Player.ts b/src/store/generated/Player.ts
index a2968a24..f89e3c0b 100644
--- a/src/store/generated/Player.ts
+++ b/src/store/generated/Player.ts
@@ -28,7 +28,13 @@ ovr: number,
 /**
  * Player's ceiling rating (1–99). Set at generation; higher than ovr for young players.
  */
-potential: number, market_value: number, stats: PlayerSeasonStats, career: Array<CareerEntry>, training_focus: TrainingFocus | null, transfer_listed: boolean, loan_listed: boolean, transfer_offers: Array<TransferOffer>, loan_offers: Array<LoanOffer>, active_loan?: ActiveLoan | null, morale_core: PlayerMoraleCore, 
+potential: number, market_value: number, stats: PlayerSeasonStats, 
+/**
+ * This season's league matches alone, which the division's awards rank by, so they agree
+ * with the league's own tables. A save from before it loads its season so far here
+ * (`db::repositories::player_repo`).
+ */
+league_stats: PlayerSeasonStats, career: Array<CareerEntry>, training_focus: TrainingFocus | null, transfer_listed: boolean, loan_listed: boolean, transfer_offers: Array<TransferOffer>, loan_offers: Array<LoanOffer>, active_loan?: ActiveLoan | null, morale_core: PlayerMoraleCore, 
 /**
  * Jersey/squad number (1–99). None means unassigned.
  */
diff --git a/src/store/generated/SquadPlayer.ts b/src/store/generated/SquadPlayer.ts
index bebcfbfc..09b669c9 100644
--- a/src/store/generated/SquadPlayer.ts
+++ b/src/store/generated/SquadPlayer.ts
@@ -36,7 +36,13 @@ ovr: number,
 /**
  * Player's ceiling rating (1–99). Set at generation; higher than ovr for young players.
  */
-potential: number, market_value: number, stats: PlayerSeasonStats, career: Array<CareerEntry>, training_focus: TrainingFocus | null, transfer_listed: boolean, loan_listed: boolean, transfer_offers: Array<TransferOffer>, loan_offers: Array<LoanOffer>, active_loan?: ActiveLoan | null, morale_core: PlayerMoraleCore, 
+potential: number, market_value: number, stats: PlayerSeasonStats, 
+/**
+ * This season's league matches alone, which the division's awards rank by, so they agree
+ * with the league's own tables. A save from before it loads its season so far here
+ * (`db::repositories::player_repo`).
+ */
+league_stats: PlayerSeasonStats, career: Array<CareerEntry>, training_focus: TrainingFocus | null, transfer_listed: boolean, loan_listed: boolean, transfer_offers: Array<TransferOffer>, loan_offers: Array<LoanOffer>, active_loan?: ActiveLoan | null, morale_core: PlayerMoraleCore, 
 /**
  * Jersey/squad number (1–99). None means unassigned.
  */
```

**Step 10**
`git diff --stat`: fixture.generated.ts | 455 ++++++++++++++++---------------; Player.ts | 8 +-; SquadPlayer.ts | 8 +-; 3 files changed, 253 insertions(+), 218 deletions(-). The fixture diff is 627 lines and 860,512 bytes, made of single-line JSON records of about 1.3 KB each; the first 150 lines alone are 266,947 bytes, so they are not copied here. A word-diff check shows its only change is 239 inserted `"league_stats":{…all zeros…}` objects. `npm run build` exit 2: 239 × `error TS2353: Object literal may only specify known properties, and '"league_stats"' does not exist in type 'PlayerData'.` (first at fixture.generated.ts(179,867)). The hand-written `PlayerData` (src/store/types.ts:319) lacks the field. `vitest run src/store src/pages`: 10 files, 181 tests passed. Restored, status empty.
