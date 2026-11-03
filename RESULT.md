Cloud run ofm-profile-fix-1160: DONE

Every step ran. **Finding: the fix's own regression test `retirees_start_managing_on_the_created_scale_by_their_ability` fails at head (434 vs 681). It is the only failure in the workspace (step 2).**

## Setup — worked
- apt-get update + install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev: exit 0.
- Toolchain 1.95.0 from rust-toolchain.toml installed by rustup (rustc 1.95.0 (59807616e 2026-04-14)).
- cargo-mutants v27.1.0 installed (`cargo install --locked cargo-mutants`, exit 0).
- `npm ci` was not run: no npm/vitest/biome command was part of this job.

## 1. Checkout
`git fetch origin cloud-src/ofm-profile/fix-1160:f1160 && git checkout --detach f1160`, then `git log --oneline -2`:
```
be8ce65e fix(managers): a retired player starts managing on the scale every manager is created on
f2b660f4 Merge pull request #1158 from sturdy-robot/fix/dashboard-storage-test-any-node
```

## 2. Lint and tests (from src-tauri/, CARGO_INCREMENTAL=0)
- `cargo fmt --all --check`: exit 0.
- `cargo clippy --locked --workspace --all-targets -- -D warnings`: exit 0 (6m58s).
- `cargo clippy --locked --workspace --all-targets --features mcp -- -D warnings`: exit 0 (1m06s). The `mcp` feature is on the root package, which is a workspace member, so the workspace form was used.
- `cargo test --locked --workspace`: **exit 101** (15m45s). Cargo stops at the first failing binary, so I reran it with `--no-fail-fast` (exit 101, 3m55s) to cover every binary. **Exactly one failure in the whole workspace:**
```
end_of_season_tests: test result: FAILED. 113 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.89s

---- retirees_start_managing_on_the_created_scale_by_their_ability stdout ----
thread 'retirees_start_managing_on_the_created_scale_by_their_ability' (30983) panicked at crates/ofm_core/tests/end_of_season_tests.rs:4050:5:
assertion `left == right` failed
  left: Some((434, 50, 50))
 right: Some((681, 50, 50))
```
  The test expects `mgr_retired_star` (ovr 85, 13 seasons) to start at 681 = 200+30×13+13×7, but it starts at 434. 434 equals 200+11×13+13×7, which is what the formula gives for ovr **66**. Cause, read from the code but not instrumented: `aging::apply_seasonal_aging` (crates/ofm_core/src/aging.rs:85-106) runs `development::develop_one_season` and then `player_rating::refresh_player_derived` on every player in `game.players`. Line 43 of the latter does `let ovr = natural_rating_from(player, &player.attributes)`, and only then does `retirees::archive_retired_players` archive the retirees. The test sets `player.ovr = 85`/`62` but keeps `make_retired_player`'s mid-60s attributes, so ovr is recomputed (about 66, matching 434) before `retired_player_reputation` reads it. Both retirees would therefore land at the same value. The fixture's attributes, rather than its `ovr` field, need to produce 85 and 62. The second assert (`squad` → 382) is never reached.
  Every other binary passes. Summary lines per binary:
  - unittests src/lib.rs (db): ok. 407 passed; 0 failed; 1 ignored; finished in 36.14s
  - tests/ai_review_persistence_tests.rs (ai_review_persistence_tests): ok. 1 passed; 0 failed; 0 ignored; finished in 0.04s
  - tests/jersey_handover_save_tests.rs (jersey_handover_save_tests): ok. 1 passed; 0 failed; 0 ignored; finished in 0.08s
  - unittests src/lib.rs (domain): ok. 90 passed; 0 failed; 0 ignored; finished in 0.12s
  - unittests src/lib.rs (engine): ok. 58 passed; 0 failed; 0 ignored; finished in 0.11s
  - tests/ai_decision_tests.rs (ai_decision_tests): ok. 9 passed; 0 failed; 0 ignored; finished in 0.01s
  - tests/injury_risk_tests.rs (injury_risk_tests): ok. 3 passed; 0 failed; 0 ignored; finished in 0.17s
  - tests/live_match_tests.rs (live_match_tests): ok. 80 passed; 0 failed; 0 ignored; finished in 0.62s
  - tests/play_style_tests.rs (play_style_tests): ok. 4 passed; 0 failed; 1 ignored; finished in 4.33s
  - tests/rating_tests.rs (rating_tests): ok. 7 passed; 0 failed; 0 ignored; finished in 0.12s
  - tests/shootout_tests.rs (shootout_tests): ok. 21 passed; 0 failed; 0 ignored; finished in 0.49s
  - tests/short_handed_tests.rs (short_handed_tests): ok. 7 passed; 0 failed; 0 ignored; finished in 2.27s
  - tests/shot_rate_tests.rs (shot_rate_tests): ok. 2 passed; 0 failed; 0 ignored; finished in 0.73s
  - tests/simulation_tests.rs (simulation_tests): ok. 50 passed; 0 failed; 0 ignored; finished in 0.34s
  - tests/tactics_phase_tests.rs (tactics_phase_tests): ok. 14 passed; 0 failed; 0 ignored; finished in 0.60s
  - unittests src/lib.rs (mcp_e2e): ok. 27 passed; 0 failed; 0 ignored; finished in 1.37s
  - tests/foundation.rs (foundation): ok. 0 passed; 0 failed; 9 ignored; finished in 0.00s
  - tests/smoke.rs (smoke): ok. 3 passed; 0 failed; 13 ignored; finished in 0.00s
  - tests/window.rs (window): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - unittests src/lib.rs (mcp_results): ok. 21 passed; 0 failed; 0 ignored; finished in 0.00s
  - unittests src/main.rs (ofm_cli): ok. 28 passed; 0 failed; 0 ignored; finished in 0.01s
  - unittests src/lib.rs (ofm_core): ok. 1886 passed; 0 failed; 0 ignored; finished in 3.84s
  - tests/ai_readiness_probe.rs (ai_readiness_probe): ok. 2 passed; 0 failed; 1 ignored; finished in 0.13s
  - tests/ai_tactical_review_tests.rs (ai_tactical_review_tests): ok. 2 passed; 0 failed; 0 ignored; finished in 0.02s
  - tests/calendar_reconcile_properties.rs (calendar_reconcile_properties): ok. 4 passed; 0 failed; 0 ignored; finished in 0.47s
  - tests/club_tests.rs (club_tests): ok. 2 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/contracts_tests.rs (contracts_tests): ok. 81 passed; 0 failed; 0 ignored; finished in 0.01s
  - tests/determinism_tests.rs (determinism_tests): ok. 8 passed; 0 failed; 0 ignored; finished in 1.95s
  - tests/end_of_season_tests.rs (end_of_season_tests): FAILED. 113 passed; 1 failed; 0 ignored; finished in 1.70s
  - tests/finances_tests.rs (finances_tests): ok. 83 passed; 0 failed; 0 ignored; finished in 0.01s
  - tests/legacy_save_migration_tests.rs (legacy_save_migration_tests): ok. 2 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/live_match_feed_tests.rs (live_match_feed_tests): ok. 1 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/live_match_manager_tests.rs (live_match_manager_tests): ok. 38 passed; 0 failed; 0 ignored; finished in 0.03s
  - tests/match_injury_fitness_tests.rs (match_injury_fitness_tests): ok. 1 passed; 0 failed; 0 ignored; finished in 0.25s
  - tests/messages_tests.rs (messages_tests): ok. 24 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/player_events_tests.rs (player_events_tests): ok. 93 passed; 0 failed; 0 ignored; finished in 0.03s
  - tests/player_rating_tests.rs (player_rating_tests): ok. 25 passed; 0 failed; 0 ignored; finished in 0.01s
  - tests/random_events_tests.rs (random_events_tests): ok. 84 passed; 0 failed; 0 ignored; finished in 0.24s
  - tests/role_distribution_probe.rs (role_distribution_probe): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/scenario_tests.rs (scenario_tests): ok. 2 passed; 0 failed; 2 ignored; finished in 0.01s
  - tests/scouting_tests.rs (scouting_tests): ok. 42 passed; 0 failed; 0 ignored; finished in 0.01s
  - tests/shootout_order_tests.rs (shootout_order_tests): ok. 6 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/slices_players_tests.rs (slices_players_tests): ok. 53 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/slices_squad_tests.rs (slices_squad_tests): ok. 4 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/slices_staff_tests.rs (slices_staff_tests): ok. 5 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/slices_teams_tests.rs (slices_teams_tests): ok. 24 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/squad_floor_seasons.rs (squad_floor_seasons): ok. 8 passed; 0 failed; 0 ignored; finished in 41.21s
  - tests/tactical_adaptation_probe.rs (tactical_adaptation_probe): ok. 1 passed; 0 failed; 1 ignored; finished in 0.36s
  - tests/tactical_identity_probe.rs (tactical_identity_probe): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/text_determinism_tests.rs (text_determinism_tests): ok. 8 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/training_tests.rs (training_tests): ok. 60 passed; 0 failed; 0 ignored; finished in 0.01s
  - tests/transfers_tests.rs (transfers_tests): ok. 137 passed; 0 failed; 0 ignored; finished in 0.01s
  - tests/turn_tests.rs (turn_tests): ok. 112 passed; 0 failed; 0 ignored; finished in 0.29s
  - tests/watched_equals_unwatched.rs (watched_equals_unwatched): ok. 2 passed; 0 failed; 1 ignored; finished in 0.39s
  - tests/world_tests.rs (world_tests): ok. 2 passed; 0 failed; 0 ignored; finished in 0.73s
  - tests/youth_intake_wages_probe.rs (youth_intake_wages_probe): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - unittests examples/page_fixture.rs (page_fixture): ok. 6 passed; 0 failed; 0 ignored; finished in 0.02s
  - unittests src/lib.rs (openfootmanager_lib): ok. 564 passed; 0 failed; 1 ignored; finished in 12.99s
  - unittests src/main.rs (openfootmanager): ok. 0 passed; 0 failed; 0 ignored; finished in 0.00s
  - tests/architecture.rs (architecture): ok. 2 passed; 0 failed; 0 ignored; finished in 0.02s
  - tests/contract_single_writer.rs (contract_single_writer): ok. 5 passed; 0 failed; 0 ignored; finished in 0.01s
  - tests/finance_journal.rs (finance_journal): ok. 4 passed; 0 failed; 0 ignored; finished in 0.05s
  - tests/screen_writes.rs (screen_writes): ok. 4 passed; 0 failed; 0 ignored; finished in 0.02s
  - tests/wire_types.rs (wire_types): ok. 9 passed; 0 failed; 0 ignored; finished in 0.22s
  - unittests src/lib.rs (season_harness): ok. 102 passed; 0 failed; 0 ignored; finished in 1.73s
  - tests/fingerprint_hash.rs (fingerprint_hash): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/gate.rs (gate): ok. 12 passed; 0 failed; 0 ignored; finished in 9.42s
  - tests/generated_calendar.rs (generated_calendar): ok. 1 passed; 0 failed; 0 ignored; finished in 3.71s
  - tests/match_injuries.rs (match_injuries): ok. 0 passed; 0 failed; 2 ignored; finished in 0.00s
  - tests/measure_ageing.rs (measure_ageing): ok. 0 passed; 0 failed; 2 ignored; finished in 0.00s
  - tests/measure_club_injuries.rs (measure_club_injuries): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/measure_distribution.rs (measure_distribution): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/measure_every_match.rs (measure_every_match): ok. 0 passed; 0 failed; 2 ignored; finished in 0.00s
  - tests/measure_history.rs (measure_history): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/measure_match_stats.rs (measure_match_stats): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/measure_pyramid.rs (measure_pyramid): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/measure_red_cards.rs (measure_red_cards): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/measure_reputation.rs (measure_reputation): ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - tests/nightly.rs (nightly): ok. 0 passed; 0 failed; 11 ignored; finished in 0.00s
  - tests/opening_ratings.rs (opening_ratings): ok. 2 passed; 0 failed; 0 ignored; finished in 1.02s
  - tests/package_world.rs (package_world): ok. 4 passed; 0 failed; 0 ignored; finished in 5.67s
  - tests/threads.rs (threads): ok. 1 passed; 0 failed; 0 ignored; finished in 0.00s
  - unittests src/main.rs (ofm_sim_bench): ok. 18 passed; 0 failed; 0 ignored; finished in 0.01s
  - Doc-tests db: ok. 0 passed; 0 failed; 0 ignored; finished in 0.00s
  - Doc-tests domain: ok. 0 passed; 0 failed; 0 ignored; finished in 0.00s
  - Doc-tests engine: ok. 0 passed; 0 failed; 0 ignored; finished in 0.00s
  - Doc-tests mcp_e2e: ok. 0 passed; 0 failed; 0 ignored; finished in 0.00s
  - Doc-tests mcp_results: ok. 0 passed; 0 failed; 0 ignored; finished in 0.00s
  - Doc-tests ofm_core: ok. 0 passed; 0 failed; 0 ignored; finished in 0.00s
  - Doc-tests openfootmanager_lib: ok. 0 passed; 0 failed; 1 ignored; finished in 0.00s
  - Doc-tests season_harness: ok. 0 passed; 0 failed; 0 ignored; finished in 0.00s
- `cargo test --locked --lib --features mcp`: exit 0 (4m32s): `test result: ok. 684 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 7.78s`

## 3. Red steps (each restored with `git checkout`; the tree was clean afterwards)
- **A. CAUGHT.** Old formula `(200u32 + u32::from(r.ovr) * 6 + r.seasons_played * 30).clamp(200, 900)` in end_of_season/mod.rs, then `cargo test --locked -p ofm_core --test end_of_season_tests retirees_start_managing`: exit 101.
```
panicked at crates/ofm_core/tests/end_of_season_tests.rs:4050:5:
assertion `left == right` failed
  left: Some((900, 50, 50))
 right: Some((681, 50, 50))
test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 113 filtered out
```
  Note: at head this same test is already red (434 vs 681), so for this test "CAUGHT" only shows the assertion changes value. It does not show the test is green with the fix.
- **B. CAUGHT, both.** `floor = 300.0`, `span = 600.0` in domain/src/manager.rs, then `cargo test --locked -p domain manager::tests`: exit 101, `2 passed; 3 failed`.
  - the_top_of_the_created_scale_takes_the_whole_reputation_share: **CAUGHT**, manager.rs:299:9 `left: 22 right: 33`
  - reputation_past_the_created_scale_adds_nothing: **CAUGHT**, manager.rs:312:9 `left: 63 right: 52`
  - also failed: rating_for_fresh_mid_reputation_manager_is_mid_range, manager.rs:254:9 `expected mid-range rating, got 38`
- **C. cargo mutants** (v27.1.0)
  - `cargo mutants --package ofm_core --file crates/ofm_core/src/manager_reputation.rs -- --lib`:
    - **Exit 4.** The unmutated baseline failed in cargo-mutants' copy of `src-tauri/`, so no mutants were tested. The copy has 5 lib tests failing (`1881 passed; 5 failed`) because they read files outside `src-tauri/`. Examples: `cannot read /tmp/cargo-mutants-src-tauri-5J8DU5.tmp/crates/ofm_core/../../../src/components/menu/PackageEditor/schemaFields.generated.json`, `.../src/components/squad/familiarity.generated.json`, and a locale-file NotFound. The failing tests were `generator::scaffold::tests::the_frontend_fixture_lists_every_field_every_definition_serializes`, `generator::world_io::tests::a_seed_builds_the_same_package_world_ids_included`, `generator::world_io::tests::a_seed_builds_the_same_padded_one_club_package`, `player_rating::tests::the_familiarity_fixture_is_what_the_backend_says` and `save_notice::tests::every_key_the_notice_sends_is_in_the_locale_file`. All 5 pass in the real checkout (step 2).
    - **Rerun with `--in-place`.** The first attempt hit my 30-minute background limit after 7 of the 15 mutants, all of them caught. The tree was clean after the kill. I then ran the other 8 with `--in-place --re ':37:43: replace \+ with \*|:37:33:|:43:5:|:45:43:'`: exit 0, `8 mutants tested in 27m: 8 caught`. The tree was clean afterwards.
    - **Combined: 15 mutants, 15 caught, 0 missed, 0 unviable, 0 timeout.** All 15 run with each mutant applied (both runs passed their unmutated baseline): `retired_player_reputation` → 0 and → 1, 35:64 `*`→`+` and `*`→`/`, 36:58 `*`→`+` and `*`→`/`, 37:43 `+`→`-` and `+`→`*`, 37:33 `+`→`-` and `+`→`*`, `seasons_played` → 0 and → 1, 45:43 `>`→`==`, `>`→`<` and `>`→`>=`.
  - `cargo mutants --package domain --file crates/domain/src/manager.rs --re 'rating' -- --lib`: exit 2 (the cargo-mutants exit code when mutants are missed), `34 mutants tested in 13m: 5 missed, 29 caught`, 0 unviable, 0 timeout. MISSED, verbatim:
```
crates/domain/src/manager.rs:208:72: replace / with * in Manager::rating
crates/domain/src/manager.rs:209:52: replace / with % in Manager::rating
crates/domain/src/manager.rs:209:52: replace / with * in Manager::rating
crates/domain/src/manager.rs:210:63: replace / with % in Manager::rating
crates/domain/src/manager.rs:210:63: replace / with * in Manager::rating
```
    These are the `/ 250.0` (experience), `/ 100.0` (win rate) and `/ 10.0` (trophies) divisors. The commit does not change those lines. Every mutant on the reputation lines (205–207) was caught.

## 4. Band-share probe
A temporary `crates/season-harness/tests/probe_manager_bands.rs` (`#[test] #[ignore]`) built the world as specified: `generate_world_data_seeded_with(seed, WorldGenConfig::standard_from(embedded_only) with opening_year Some(2033))` → `build_game_from_world_data(GameClock::new(start_date_for_year(2033)), Manager "mgr_user", PastHistory{2033, 12}, world, ReputationBasis::Authored(&empty))` → `begin_career(strongest ENG club, CareerScope::default())` → `run_seasons(RunOptions::seasons(5))`, seeds 1 and 2. Snapshots are taken at the opening and in `on_season_end` (after the rollover) of seasons 1, 3 and 5.
- ALL is `game.managers` plus `game.manager`, de-duplicated by id.
- Percentiles are nearest-rank: `sorted[ceil(p/100·n) − 1]`.
- Each band shows its percentage, with the count in brackets.
- NEW_RETIREES_S1 is the managers with ids `mgr_retired_*` that were absent at the opening, measured after the season-1 rollover.

`cargo test --release -p season-harness --test probe_manager_bands -- --ignored --nocapture`: exit 0, 8m20s wall clock (305s of test time), `test result: ok. 1 passed`. Every printed line:
```
seed=1 club=e39db9a5-d895-49f7-bc49-5234db47d4b4
seed=1 at=opening group=ALL n=441 min=200 max=698 mean=446.37 p1=202 p5=223 p10=248 p20=298 p30=350 p40=403 p50=448 p60=495 p70=551 p80=592 p90=641 p95=661 p99=690
seed=1 at=opening group=ALL bands: World class >=670: 3.63% (16) | Established 620-669: 11.79% (52) | Great 550-619: 14.97% (66) | Good 450-549: 19.27% (85) | Average 350-449: 20.41% (90) | Below average 250-349: 19.50% (86) | Unknown <250: 10.43% (46)
seed=1 at=opening group=ALL exactly700=0 above700=0
seed=1 at=opening group=EMPLOYED n=440 min=200 max=698 mean=446.47 p1=202 p5=223 p10=248 p20=297 p30=348 p40=401 p50=448 p60=495 p70=551 p80=592 p90=641 p95=661 p99=690
seed=1 at=opening group=EMPLOYED bands: World class >=670: 3.64% (16) | Established 620-669: 11.82% (52) | Great 550-619: 15.00% (66) | Good 450-549: 19.32% (85) | Average 350-449: 20.23% (89) | Below average 250-349: 19.55% (86) | Unknown <250: 10.45% (46)
seed=1 at=opening group=EMPLOYED exactly700=0 above700=0
seed=1 at=opening group=UNEMPLOYED n=1 min=403 max=403 mean=403.00 p1=403 p5=403 p10=403 p20=403 p30=403 p40=403 p50=403 p60=403 p70=403 p80=403 p90=403 p95=403 p99=403
seed=1 at=opening group=UNEMPLOYED bands: World class >=670: 0.00% (0) | Established 620-669: 0.00% (0) | Great 550-619: 0.00% (0) | Good 450-549: 0.00% (0) | Average 350-449: 100.00% (1) | Below average 250-349: 0.00% (0) | Unknown <250: 0.00% (0)
seed=1 at=opening group=UNEMPLOYED exactly700=0 above700=0
seed=1 at=after_season_1 group=ALL n=1320 min=200 max=698 mean=454.39 p1=206 p5=236 p10=276 p20=349 p30=401 p40=433 p50=464 p60=492 p70=518 p80=557 p90=613 p95=647 p99=685
seed=1 at=after_season_1 group=ALL bands: World class >=670: 2.20% (29) | Established 620-669: 6.82% (90) | Great 550-619: 12.58% (166) | Good 450-549: 33.11% (437) | Average 350-449: 25.08% (331) | Below average 250-349: 13.48% (178) | Unknown <250: 6.74% (89)
seed=1 at=after_season_1 group=ALL exactly700=0 above700=0
seed=1 at=after_season_1 group=EMPLOYED n=440 min=200 max=698 mean=449.92 p1=202 p5=223 p10=249 p20=300 p30=352 p40=409 p50=456 p60=499 p70=554 p80=595 p90=641 p95=661 p99=690
seed=1 at=after_season_1 group=EMPLOYED bands: World class >=670: 3.64% (16) | Established 620-669: 12.05% (53) | Great 550-619: 15.68% (69) | Good 450-549: 20.23% (89) | Average 350-449: 19.09% (84) | Below average 250-349: 19.32% (85) | Unknown <250: 10.00% (44)
seed=1 at=after_season_1 group=EMPLOYED exactly700=0 above700=0
seed=1 at=after_season_1 group=UNEMPLOYED n=880 min=200 max=689 mean=456.62 p1=208 p5=245 p10=302 p20=375 p30=414 p40=440 p50=466 p60=492 p70=518 p80=540 p90=583 p95=626 p99=679
seed=1 at=after_season_1 group=UNEMPLOYED bands: World class >=670: 1.48% (13) | Established 620-669: 4.20% (37) | Great 550-619: 11.02% (97) | Good 450-549: 39.55% (348) | Average 350-449: 28.07% (247) | Below average 250-349: 10.57% (93) | Unknown <250: 5.11% (45)
seed=1 at=after_season_1 group=UNEMPLOYED exactly700=0 above700=0
seed=1 at=after_season_1 group=NEW_RETIREES_S1 n=537 min=284 max=648 mean=471.20 p1=297 p5=349 p10=375 p20=414 p30=440 p40=453 p50=479 p60=492 p70=512 p80=531 p90=557 p95=577 p99=629
seed=1 at=after_season_1 group=NEW_RETIREES_S1 bands: World class >=670: 0.00% (0) | Established 620-669: 1.49% (8) | Great 550-619: 9.87% (53) | Good 450-549: 52.33% (281) | Average 350-449: 30.91% (166) | Below average 250-349: 5.40% (29) | Unknown <250: 0.00% (0)
seed=1 at=after_season_1 group=NEW_RETIREES_S1 exactly700=0 above700=0
seed=1 at=after_season_3 group=ALL n=2198 min=200 max=698 mean=466.92 p1=224 p5=321 p10=349 p20=391 p30=427 p40=442 p50=466 p60=492 p70=518 p80=538 p90=584 p95=627 p99=680
seed=1 at=after_season_3 group=ALL bands: World class >=670: 1.32% (29) | Established 620-669: 4.46% (98) | Great 550-619: 10.69% (235) | Good 450-549: 42.68% (938) | Average 350-449: 30.44% (669) | Below average 250-349: 8.51% (187) | Unknown <250: 1.91% (42)
seed=1 at=after_season_3 group=ALL exactly700=0 above700=0
seed=1 at=after_season_3 group=EMPLOYED n=438 min=200 max=698 mean=455.27 p1=202 p5=224 p10=251 p20=302 p30=353 p40=417 p50=464 p60=507 p70=565 p80=606 p90=649 p95=679 p99=690
seed=1 at=after_season_3 group=EMPLOYED bands: World class >=670: 5.71% (25) | Established 620-669: 11.19% (49) | Great 550-619: 15.53% (68) | Good 450-549: 20.09% (88) | Average 350-449: 18.72% (82) | Below average 250-349: 19.18% (84) | Unknown <250: 9.59% (42)
seed=1 at=after_season_3 group=EMPLOYED exactly700=0 above700=0
seed=1 at=after_season_3 group=UNEMPLOYED n=1760 min=323 max=680 mean=469.82 p1=330 p5=349 p10=375 p20=401 p30=427 p40=453 p50=466 p60=492 p70=505 p80=531 p90=566 p95=596 p99=648
seed=1 at=after_season_3 group=UNEMPLOYED bands: World class >=670: 0.23% (4) | Established 620-669: 2.78% (49) | Great 550-619: 9.49% (167) | Good 450-549: 48.30% (850) | Average 350-449: 33.35% (587) | Below average 250-349: 5.85% (103) | Unknown <250: 0.00% (0)
seed=1 at=after_season_3 group=UNEMPLOYED exactly700=0 above700=0
seed=1 at=after_season_5 group=ALL n=2195 min=200 max=698 mean=489.38 p1=224 p5=328 p10=427 p20=440 p30=453 p40=468 p50=492 p60=505 p70=521 p80=544 p90=590 p95=627 p99=680
seed=1 at=after_season_5 group=ALL bands: World class >=670: 1.32% (29) | Established 620-669: 4.56% (100) | Great 550-619: 13.03% (286) | Good 450-549: 56.22% (1234) | Average 350-449: 19.32% (424) | Below average 250-349: 3.74% (82) | Unknown <250: 1.82% (40)
seed=1 at=after_season_5 group=ALL exactly700=0 above700=0
seed=1 at=after_season_5 group=EMPLOYED n=434 min=200 max=698 mean=455.32 p1=202 p5=224 p10=253 p20=305 p30=358 p40=417 p50=464 p60=505 p70=561 p80=599 p90=649 p95=674 p99=690
seed=1 at=after_season_5 group=EMPLOYED bands: World class >=670: 5.53% (24) | Established 620-669: 11.29% (49) | Great 550-619: 14.98% (65) | Good 450-549: 20.97% (91) | Average 350-449: 19.12% (83) | Below average 250-349: 18.89% (82) | Unknown <250: 9.22% (40)
seed=1 at=after_season_5 group=EMPLOYED exactly700=0 above700=0
seed=1 at=after_season_5 group=UNEMPLOYED n=1761 min=421 max=686 mean=497.77 p1=424 p5=427 p10=439 p20=453 p30=466 p40=479 p50=492 p60=505 p70=518 p80=544 p90=570 p95=602 p99=651
seed=1 at=after_season_5 group=UNEMPLOYED bands: World class >=670: 0.28% (5) | Established 620-669: 2.90% (51) | Great 550-619: 12.55% (221) | Good 450-549: 64.91% (1143) | Average 350-449: 19.36% (341) | Below average 250-349: 0.00% (0) | Unknown <250: 0.00% (0)
seed=1 at=after_season_5 group=UNEMPLOYED exactly700=0 above700=0
seed=2 club=2aa80d1c-69ce-48de-b09c-214079c3170e
seed=2 at=opening group=ALL n=441 min=200 max=700 mean=453.98 p1=206 p5=223 p10=251 p20=306 p30=360 p40=399 p50=452 p60=490 p70=554 p80=612 p90=663 p95=687 p99=697
seed=2 at=opening group=ALL bands: World class >=670: 9.30% (41) | Established 620-669: 9.07% (40) | Great 550-619: 12.47% (55) | Good 450-549: 19.73% (87) | Average 350-449: 21.32% (94) | Below average 250-349: 18.14% (80) | Unknown <250: 9.98% (44)
seed=2 at=opening group=ALL exactly700=1 above700=0
seed=2 at=opening group=EMPLOYED n=440 min=200 max=700 mean=454.45 p1=206 p5=221 p10=251 p20=306 p30=360 p40=399 p50=452 p60=490 p70=554 p80=612 p90=663 p95=687 p99=697
seed=2 at=opening group=EMPLOYED bands: World class >=670: 9.32% (41) | Established 620-669: 9.09% (40) | Great 550-619: 12.50% (55) | Good 450-549: 19.77% (87) | Average 350-449: 21.36% (94) | Below average 250-349: 18.18% (80) | Unknown <250: 9.77% (43)
seed=2 at=opening group=EMPLOYED exactly700=1 above700=0
seed=2 at=opening group=UNEMPLOYED n=1 min=243 max=243 mean=243.00 p1=243 p5=243 p10=243 p20=243 p30=243 p40=243 p50=243 p60=243 p70=243 p80=243 p90=243 p95=243 p99=243
seed=2 at=opening group=UNEMPLOYED bands: World class >=670: 0.00% (0) | Established 620-669: 0.00% (0) | Great 550-619: 0.00% (0) | Good 450-549: 0.00% (0) | Average 350-449: 0.00% (0) | Below average 250-349: 0.00% (0) | Unknown <250: 100.00% (1)
seed=2 at=opening group=UNEMPLOYED exactly700=0 above700=0
seed=2 at=after_season_1 group=ALL n=1318 min=200 max=700 mean=461.31 p1=207 p5=237 p10=284 p20=362 p30=402 p40=440 p50=466 p60=492 p70=525 p80=570 p90=627 p95=663 p99=693
seed=2 at=after_season_1 group=ALL bands: World class >=670: 4.63% (61) | Established 620-669: 6.37% (84) | Great 550-619: 13.05% (172) | Good 450-549: 32.40% (427) | Average 350-449: 25.19% (332) | Below average 250-349: 12.22% (161) | Unknown <250: 6.15% (81)
seed=2 at=after_season_1 group=ALL exactly700=1 above700=0
seed=2 at=after_season_1 group=EMPLOYED n=438 min=200 max=700 mean=457.03 p1=206 p5=221 p10=251 p20=310 p30=363 p40=404 p50=456 p60=494 p70=560 p80=613 p90=663 p95=687 p99=697
seed=2 at=after_season_1 group=EMPLOYED bands: World class >=670: 9.36% (41) | Established 620-669: 9.36% (41) | Great 550-619: 13.24% (58) | Good 450-549: 19.86% (87) | Average 350-449: 20.78% (91) | Below average 250-349: 17.58% (77) | Unknown <250: 9.82% (43)
seed=2 at=after_season_1 group=EMPLOYED exactly700=1 above700=0
seed=2 at=after_season_1 group=UNEMPLOYED n=880 min=200 max=699 mean=463.44 p1=209 p5=262 p10=310 p20=388 p30=420 p40=440 p50=466 p60=492 p70=518 p80=550 p90=596 p95=636 p99=684
seed=2 at=after_season_1 group=UNEMPLOYED bands: World class >=670: 2.27% (20) | Established 620-669: 4.89% (43) | Great 550-619: 12.95% (114) | Good 450-549: 38.64% (340) | Average 350-449: 27.39% (241) | Below average 250-349: 9.55% (84) | Unknown <250: 4.32% (38)
seed=2 at=after_season_1 group=UNEMPLOYED exactly700=0 above700=0
seed=2 at=after_season_1 group=NEW_RETIREES_S1 n=537 min=284 max=674 mean=473.04 p1=284 p5=362 p10=388 p20=414 p30=440 p40=453 p50=473 p60=492 p70=505 p80=531 p90=564 p95=583 p99=622
seed=2 at=after_season_1 group=NEW_RETIREES_S1 bands: World class >=670: 0.37% (2) | Established 620-669: 0.74% (4) | Great 550-619: 12.66% (68) | Good 450-549: 51.02% (274) | Average 350-449: 31.10% (167) | Below average 250-349: 4.10% (22) | Unknown <250: 0.00% (0)
seed=2 at=after_season_1 group=NEW_RETIREES_S1 exactly700=0 above700=0
seed=2 at=after_season_3 group=ALL n=2198 min=200 max=700 mean=467.51 p1=224 p5=323 p10=351 p20=388 p30=415 p40=440 p50=466 p60=492 p70=505 p80=544 p90=596 p95=638 p99=692
seed=2 at=after_season_3 group=ALL bands: World class >=670: 2.78% (61) | Established 620-669: 4.14% (91) | Great 550-619: 10.92% (240) | Good 450-549: 40.35% (887) | Average 350-449: 31.89% (701) | Below average 250-349: 8.05% (177) | Unknown <250: 1.87% (41)
seed=2 at=after_season_3 group=ALL exactly700=2 above700=0
seed=2 at=after_season_3 group=EMPLOYED n=438 min=200 max=700 mean=462.81 p1=207 p5=224 p10=253 p20=311 p30=369 p40=413 p50=461 p60=499 p70=575 p80=625 p90=674 p95=691 p99=698
seed=2 at=after_season_3 group=EMPLOYED bands: World class >=670: 11.19% (49) | Established 620-669: 9.82% (43) | Great 550-619: 12.79% (56) | Good 450-549: 18.95% (83) | Average 350-449: 20.55% (90) | Below average 250-349: 17.35% (76) | Unknown <250: 9.36% (41)
seed=2 at=after_season_3 group=EMPLOYED exactly700=1 above700=0
seed=2 at=after_season_3 group=UNEMPLOYED n=1760 min=310 max=700 mean=468.68 p1=323 p5=349 p10=375 p20=401 p30=427 p40=447 p50=466 p60=486 p70=505 p80=531 p90=570 p95=596 p99=656
seed=2 at=after_season_3 group=UNEMPLOYED bands: World class >=670: 0.68% (12) | Established 620-669: 2.73% (48) | Great 550-619: 10.45% (184) | Good 450-549: 45.68% (804) | Average 350-449: 34.72% (611) | Below average 250-349: 5.74% (101) | Unknown <250: 0.00% (0)
seed=2 at=after_season_3 group=UNEMPLOYED exactly700=1 above700=0
seed=2 at=after_season_5 group=ALL n=2199 min=200 max=700 mean=491.13 p1=224 p5=345 p10=424 p20=440 p30=453 p40=468 p50=488 p60=505 p70=525 p80=551 p90=596 p95=637 p99=692
seed=2 at=after_season_5 group=ALL bands: World class >=670: 2.82% (62) | Established 620-669: 4.18% (92) | Great 550-619: 13.64% (300) | Good 450-549: 53.75% (1182) | Average 350-449: 20.37% (448) | Below average 250-349: 3.41% (75) | Unknown <250: 1.82% (40)
seed=2 at=after_season_5 group=ALL exactly700=2 above700=0
seed=2 at=after_season_5 group=EMPLOYED n=439 min=200 max=700 mean=465.29 p1=207 p5=224 p10=253 p20=313 p30=370 p40=416 p50=465 p60=502 p70=582 p80=627 p90=674 p95=691 p99=698
seed=2 at=after_season_5 group=EMPLOYED bands: World class >=670: 11.85% (52) | Established 620-669: 9.79% (43) | Great 550-619: 12.30% (54) | Good 450-549: 19.82% (87) | Average 350-449: 20.05% (88) | Below average 250-349: 17.08% (75) | Unknown <250: 9.11% (40)
seed=2 at=after_season_5 group=EMPLOYED exactly700=2 above700=0
seed=2 at=after_season_5 group=UNEMPLOYED n=1760 min=414 max=699 mean=497.58 p1=420 p5=427 p10=434 p20=448 p30=466 p40=479 p50=492 p60=505 p70=518 p80=544 p90=570 p95=597 p99=654
seed=2 at=after_season_5 group=UNEMPLOYED bands: World class >=670: 0.57% (10) | Established 620-669: 2.78% (49) | Great 550-619: 13.98% (246) | Good 450-549: 62.22% (1095) | Average 350-449: 20.45% (360) | Below average 250-349: 0.00% (0) | Unknown <250: 0.00% (0)
seed=2 at=after_season_5 group=UNEMPLOYED exactly700=0 above700=0
```
Afterwards: `git checkout -- . && git clean -fd` removed the probe file and `git status --short` was empty.

Final tree: clean at be8ce65e. The result commit adds RESULT.md only.
