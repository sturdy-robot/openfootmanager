Cloud run tq-hg-survey-1: DONE

Base commit for this branch: 7459ee4b8a24faaba79e9c40568e393be3f2f361. The verbatim lists below run past the 300-word limit because the job asks for them in full.

## Setup — worked
- `apt-get update && apt-get install -y libwebkit2gtk-4.1-dev …`: exit 0
- Rust 1.95.0 (from rust-toolchain.toml) installed by rustup: `rustc 1.95.0 (59807616e 2026-04-14)`
- `cargo install cargo-mutants --locked --version 25.3.1`: exit 0, `cargo-mutants 25.3.1`
- npm was not needed, so `npm ci` was not run.

## 1. Sources
`git fetch … develop` + `git checkout 7459ee4b…`: HEAD = `7459ee4b8a24faaba79e9c40568e393be3f2f361` (as expected)

## 2. Baseline (src-tauri/)
`cargo test --locked -p ofm_core --lib`: exit 0
`test result: ok. 1802 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.75s`

## 3. Mutants
`--list | tee /tmp/hg-list.txt | wc -l`: **262** (exit 0)

| Shard | Found line | Final summary line | Exit | Wall time |
|---|---|---|---|---|
| 0/2 | `Found 131 mutants to test` | `131 mutants tested in 2h 16m 11s: 41 missed, 85 caught, 5 unviable` | 2 (missed mutants) | 8177s |
| 1/2 | `Found 131 mutants to test` | `131 mutants tested in 2h 22m 5s: 48 missed, 77 caught, 6 unviable` | 2 (missed mutants) | 8526s |

Totals: 89 missed, 162 caught, 11 unviable, 0 timeouts.

Interrupted first attempt: the container restarted at about 08:29 UTC, when shard 0 had finished 121 of its 131 mutants. The restart left one mutant applied to the source (line 660, `&&`→`||`). I restored the file with `git checkout`, set that partial output aside (not used here), and re-ran both shards from scratch with the exact commands above. All numbers here come from the clean re-run.

`git status --short` after both shards: *(empty — clean tree)*

### Shard 0 missed.txt (verbatim)
```
crates/ofm_core/src/history_generation.rs:22:5: replace deterministic_value -> u64 with 0
crates/ofm_core/src/history_generation.rs:28:5: replace deterministic_u32 -> u32 with 0
crates/ofm_core/src/history_generation.rs:28:15: replace == with != in deterministic_u32
crates/ofm_core/src/history_generation.rs:36:5: replace season_start_string -> String with "xyzzy".into()
crates/ofm_core/src/history_generation.rs:77:54: replace && with || in historical_league_groups
crates/ofm_core/src/history_generation.rs:132:19: replace > with >= in poisson
crates/ofm_core/src/history_generation.rs:223:52: replace + with - in advance_form
crates/ofm_core/src/history_generation.rs:224:39: replace < with <= in advance_form
crates/ofm_core/src/history_generation.rs:371:52: replace < with > in upsert_team_history
crates/ofm_core/src/history_generation.rs:393:41: replace == with != in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:395:54: replace && with || in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:395:30: replace == with != in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:395:69: replace == with != in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:407:34: replace == with != in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:457:52: replace && with || in upsert_manager_history
crates/ofm_core/src/history_generation.rs:465:53: replace < with == in upsert_manager_history
crates/ofm_core/src/history_generation.rs:465:53: replace < with <= in upsert_manager_history
crates/ofm_core/src/history_generation.rs:487:33: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:494:33: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:500:37: replace + with - in synthesize_player_season
crates/ofm_core/src/history_generation.rs:500:33: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:502:33: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:503:33: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:512:29: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:513:29: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:521:29: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:522:29: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:527:29: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:532:54: replace / with % in synthesize_player_season
crates/ofm_core/src/history_generation.rs:605:52: replace < with > in upsert_player_career
crates/ofm_core/src/history_generation.rs:630:5: replace map_manager_award_entry -> Option<HistoricalManagerAwardWinner> with None
crates/ofm_core/src/history_generation.rs:660:43: replace && with || in update_historical_rivalries
crates/ofm_core/src/history_generation.rs:660:64: replace == with != in update_historical_rivalries
crates/ofm_core/src/history_generation.rs:661:39: replace == with != in update_historical_rivalries
crates/ofm_core/src/history_generation.rs:670:21: replace + with - in update_historical_rivalries
crates/ofm_core/src/history_generation.rs:681:5: replace reset_player_stats with ()
crates/ofm_core/src/history_generation.rs:687:33: replace || with && in generate_past_world_history
crates/ofm_core/src/history_generation.rs:687:53: replace < with == in generate_past_world_history
crates/ofm_core/src/history_generation.rs:687:53: replace < with <= in generate_past_world_history
crates/ofm_core/src/history_generation.rs:701:55: replace - with + in generate_past_world_history
crates/ofm_core/src/history_generation.rs:711:43: replace + with - in generate_past_world_history
```

### Shard 0 timeout.txt (verbatim)
```
```
(empty file, 0 bytes)

### Shard 1 missed.txt (verbatim)
```
crates/ofm_core/src/history_generation.rs:22:5: replace deterministic_value -> u64 with 1
crates/ofm_core/src/history_generation.rs:28:5: replace deterministic_u32 -> u32 with 1
crates/ofm_core/src/history_generation.rs:36:5: replace season_start_string -> String with String::new()
crates/ofm_core/src/history_generation.rs:62:13: replace || with && in historical_league_groups
crates/ofm_core/src/history_generation.rs:225:24: replace += with -= in advance_form
crates/ofm_core/src/history_generation.rs:371:52: replace < with == in upsert_team_history
crates/ofm_core/src/history_generation.rs:371:52: replace < with <= in upsert_team_history
crates/ofm_core/src/history_generation.rs:393:52: replace && with || in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:395:74: replace && with || in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:395:35: replace && with || in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:395:49: replace == with != in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:395:90: replace == with != in prepare_seeded_managers
crates/ofm_core/src/history_generation.rs:440:35: replace += with *= in upsert_manager_history
crates/ofm_core/src/history_generation.rs:441:36: replace += with *= in upsert_manager_history
crates/ofm_core/src/history_generation.rs:442:37: replace += with *= in upsert_manager_history
crates/ofm_core/src/history_generation.rs:449:49: replace < with <= in upsert_manager_history
crates/ofm_core/src/history_generation.rs:457:41: replace == with != in upsert_manager_history
crates/ofm_core/src/history_generation.rs:459:27: replace += with *= in upsert_manager_history
crates/ofm_core/src/history_generation.rs:460:24: replace += with *= in upsert_manager_history
crates/ofm_core/src/history_generation.rs:461:25: replace += with *= in upsert_manager_history
crates/ofm_core/src/history_generation.rs:462:26: replace += with *= in upsert_manager_history
crates/ofm_core/src/history_generation.rs:465:53: replace < with > in upsert_manager_history
crates/ofm_core/src/history_generation.rs:487:37: replace + with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:487:33: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:494:33: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:500:37: replace + with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:500:33: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:502:38: replace + with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:502:33: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:503:38: replace + with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:503:33: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:512:33: replace + with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:512:29: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:513:33: replace + with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:513:29: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:521:33: replace + with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:521:29: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:522:33: replace + with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:522:29: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:527:29: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:532:54: replace / with * in synthesize_player_season
crates/ofm_core/src/history_generation.rs:605:52: replace < with == in upsert_player_career
crates/ofm_core/src/history_generation.rs:605:52: replace < with <= in upsert_player_career
crates/ofm_core/src/history_generation.rs:661:17: replace || with && in update_historical_rivalries
crates/ofm_core/src/history_generation.rs:660:32: replace == with != in update_historical_rivalries
crates/ofm_core/src/history_generation.rs:661:50: replace && with || in update_historical_rivalries
crates/ofm_core/src/history_generation.rs:661:71: replace == with != in update_historical_rivalries
crates/ofm_core/src/history_generation.rs:711:43: replace + with * in generate_past_world_history
```

### Shard 1 timeout.txt (verbatim)
```
```
(empty file, 0 bytes)
