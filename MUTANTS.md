# cargo-mutants — PR #901, shard 0 of 3

PR #901 (player development and ageing rework), tip `3ef3ea820458bb9230c22f0b10f4a9972f769f21` (3ef3ea82), as expected.
Diff: `git diff --relative=src-tauri $(git merge-base origin-develop pr-901) pr-901 -- src-tauri`, where `origin-develop` = develop fetched at `3ded373d`. With that diff, `--list` gives **285** mutants for the workspace; this shard has **95** of them.

## Setup

**Setup worked.**
- apt: libwebkit2gtk-4.1-dev, libgtk-3-dev, librsvg2-dev and libayatana-appindicator3-dev installed (exit 0).
- Rust 1.95.0: installed automatically by rustup from the repo's `rust-toolchain.toml`.
- cargo-mutants 25.3.1: installed with `cargo install --locked`.
- `[profile.mutants]` exists in `src-tauri/Cargo.toml`, so `--profile mutants` was used.
- Machine: 4 cores, 15 GB RAM. `--in-place` limits cargo-mutants to one job, so the run was serial.

Command, run from `src-tauri/`:
```
CARGO_INCREMENTAL=1 cargo mutants --workspace --in-diff /tmp/pr901.rel.diff --in-place --profile mutants --timeout 300 --shard 0/3 --output /tmp/out901-0
```

## Result

- Wall time **54m 7s** (3249 s including startup). Unmutated baseline: 194.2 s build + 78.3 s test. Exit code 0.

| caught | missed | timeout | unviable |
|---|---|---|---|
| 93 | **0** | 0 | 2 |

Shard 0 left **no survivors**.

Shard 0 contains:
- 72 mutants in `development.rs`
- 16 in `season-harness/src/ageing.rs`
- 5 in `generator/generation.rs` (`shaped_ceiling`)
- 1 in `aging.rs` (`retirement_chance`)
- 1 in `training.rs` (`process_training`)

## Missed mutants and classification

None.

The previous run on 4b0ddc81 left 46 survivors, in these clusters: growth shares, decline columns, luck/resilience, and the harness's 33+ share. Every mutant from those clusters that falls in this shard is now caught, so the author's per-cluster tests bite here. Caught counts in this shard:

- `growth_shares`: 10
- `decline_per_season`: 9
- operators inside `decline` (luck multiplier, `/= resilience`, keeper `*=`, the `< 0.0` guard): 12
- operators inside `grow` (share and luck arithmetic, attribute total): 6
- `traits_of` and `standard_normal`: 2 and 4
- harness `ageing_report` and `share`, including the 33+ A/S share filter (`!=` → `==`): 2 and 12 matches

The ceiling-drift and youth-bell code is also all caught here: `shaped_ceiling` (5 of 5) and `ceiling_drift_still_to_come`. The two pre-existing functions the PR edits are caught too: `retirement_chance -> 0` and `process_training -> ()`.

This covers one third of the 285 mutants. Shards 1 and 2 report on the rest.

## Timeouts

None.

## Unviable mutants (do not compile, so they are not test gaps)

- `development.rs:221:5` `aspects_of` → `[(Box::leak(Box::new(1)), Default::default()); 19]`: `Aspect` has no `Default`, and `(&mut u8, Aspect)` is not `Copy` (E0277).
- `season-harness/src/ageing.rs:98:5` `band_changes` → `vec![Default::default()]`: `BandChange` has no `Default` (E0277).

## Raw output

### missed.txt
```
```

### timeout.txt
```
```

### unviable.txt
```
crates/season-harness/src/ageing.rs:98:5: replace band_changes -> Vec<BandChange> with vec![Default::default()]
crates/ofm_core/src/development.rs:221:5: replace aspects_of -> [(&mut u8, Aspect); 19] with [(Box::leak(Box::new(1)), Default::default()); 19]
```

### caught.txt
```
crates/ofm_core/src/development.rs:105:5: replace position_offset -> f64 with -1.0
crates/ofm_core/src/development.rs:148:5: replace growth_points -> f64 with 1.0
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (-1.0, -1.0, -1.0)
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (0.0, -1.0, -1.0)
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (0.0, 1.0, -1.0)
crates/ofm_core/src/development.rs:80:32: replace * with + in standard_normal
crates/ofm_core/src/development.rs:80:57: replace * with / in standard_normal
crates/ofm_core/src/development.rs:89:49: replace * with / in traits_of
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (1.0, 0.0, -1.0)
crates/ofm_core/src/development.rs:289:50: replace * with / in decline
crates/ofm_core/src/generator/generation.rs:500:19: replace + with - in shaped_ceiling
crates/ofm_core/src/development.rs:185:21: delete - in decline_per_season
crates/ofm_core/src/development.rs:135:17: replace + with * in base_growth
crates/ofm_core/src/development.rs:170:27: replace + with - in training_factor
crates/ofm_core/src/development.rs:283:20: replace /= with %= in decline
crates/ofm_core/src/development.rs:268:78: replace * with / in grow
crates/ofm_core/src/development.rs:319:5: replace drift_ceiling with ()
crates/ofm_core/src/development.rs:128:5: replace base_growth -> f64 with -1.0
crates/ofm_core/src/development.rs:117:5: replace curve_age -> f64 with -1.0
crates/ofm_core/src/development.rs:183:27: delete - in decline_per_season
crates/ofm_core/src/development.rs:99:49: replace == with != in is_goalkeeper
crates/ofm_core/src/development.rs:88:36: replace * with / in traits_of
crates/ofm_core/src/development.rs:173:20: replace * with / in training_factor
crates/ofm_core/src/development.rs:210:5: replace stochastic_round -> i32 with -1
crates/ofm_core/src/development.rs:184:39: delete - in decline_per_season
crates/ofm_core/src/development.rs:297:5: replace ceiling_step_spread -> f64 with -1.0
crates/ofm_core/src/aging.rs:24:5: replace retirement_chance -> u32 with 0
crates/ofm_core/src/development.rs:184:21: delete - in decline_per_season
crates/ofm_core/src/development.rs:122:41: replace - with + in curve_age
crates/ofm_core/src/generator/generation.rs:500:58: replace - with + in shaped_ceiling
crates/ofm_core/src/development.rs:181:21: delete - in decline_per_season
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (-1.0, 0.0, -1.0)
crates/season-harness/src/ageing.rs:148:35: delete ! in top_players_profile
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (1.0, 1.0, -1.0)
crates/ofm_core/src/development.rs:282:19: replace < with == in decline
crates/season-harness/src/ageing.rs:219:9: replace <impl SeasonObserver for AgeingLog>::on_season_end with ()
crates/ofm_core/src/development.rs:254:5: replace grow with ()
crates/ofm_core/src/development.rs:323:46: replace + with * in drift_ceiling
crates/ofm_core/src/development.rs:169:40: replace - with / in training_factor
crates/season-harness/src/ageing.rs:194:21: replace % with / in median
crates/ofm_core/src/development.rs:300:9: delete match arm 22..= 24 in ceiling_step_spread
crates/ofm_core/src/development.rs:202:9: delete match arm 22..= 25 in growth_shares
crates/ofm_core/src/development.rs:336:14: replace < with == in develop_one_season
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (1.0, -1.0, -1.0)
crates/season-harness/src/ageing.rs:197:24: replace - with + in median
crates/ofm_core/src/development.rs:182:9: delete match arm 30..= 31 in decline_per_season
crates/season-harness/src/ageing.rs:175:22: replace / with * in share
crates/ofm_core/src/development.rs:268:62: replace * with + in grow
crates/ofm_core/src/development.rs:46:27: delete -
crates/ofm_core/src/development.rs:310:5: replace ceiling_drift_still_to_come -> (f64, f64) with (1.0, -1.0)
crates/ofm_core/src/development.rs:131:31: replace - with / in base_growth
crates/season-harness/src/ageing.rs:188:5: replace median -> f64 with 0.0
crates/ofm_core/src/development.rs:212:18: replace + with - in stochastic_round
crates/ofm_core/src/generator/generation.rs:500:48: replace * with / in shaped_ceiling
crates/ofm_core/src/development.rs:179:5: replace decline_per_season -> f64 with -1.0
crates/season-harness/src/ageing.rs:180:5: replace mean -> f64 with -1.0
crates/ofm_core/src/development.rs:80:11: replace * with / in standard_normal
crates/season-harness/src/ageing.rs:172:5: replace share -> f64 with -1.0
crates/season-harness/src/ageing.rs:62:5: replace snapshot_of -> Snapshot with Default::default()
crates/ofm_core/src/development.rs:135:32: replace - with + in base_growth
crates/ofm_core/src/development.rs:255:40: replace + with - in grow
crates/ofm_core/src/development.rs:285:24: replace *= with += in decline
crates/season-harness/src/ageing.rs:193:31: replace / with % in median
crates/ofm_core/src/development.rs:310:5: replace ceiling_drift_still_to_come -> (f64, f64) with (-1.0, -1.0)
crates/ofm_core/src/development.rs:155:5: replace training_factor -> f64 with -1.0
crates/season-harness/src/ageing.rs:80:26: delete ! in ageing_report
crates/ofm_core/src/development.rs:216:41: replace + with - in nudge
crates/ofm_core/src/generator/generation.rs:498:5: replace shaped_ceiling -> u8 with 0
crates/ofm_core/src/development.rs:212:57: replace < with > in stochastic_round
crates/ofm_core/src/generator/generation.rs:499:26: replace - with / in shaped_ceiling
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (-1.0, 1.0, -1.0)
crates/ofm_core/src/development.rs:170:53: replace * with / in training_factor
crates/ofm_core/src/training.rs:246:5: replace process_training with ()
crates/ofm_core/src/development.rs:107:13: delete - in position_offset
crates/ofm_core/src/development.rs:173:33: replace * with + in training_factor
crates/ofm_core/src/development.rs:135:59: replace - with / in base_growth
crates/ofm_core/src/development.rs:122:20: replace - with / in curve_age
crates/ofm_core/src/development.rs:141:5: replace headroom_brake -> f64 with -1.0
crates/ofm_core/src/development.rs:310:5: replace ceiling_drift_still_to_come -> (f64, f64) with (0.0, -1.0)
crates/ofm_core/src/development.rs:257:41: replace * with / in grow
crates/ofm_core/src/development.rs:148:28: replace * with / in growth_points
crates/ofm_core/src/development.rs:134:47: replace + with - in base_growth
crates/ofm_core/src/development.rs:142:16: replace + with - in headroom_brake
crates/ofm_core/src/development.rs:324:48: replace + with - in drift_ceiling
crates/ofm_core/src/development.rs:78:5: replace standard_normal -> f64 with -1.0
crates/season-harness/src/ageing.rs:108:56: replace - with / in band_changes
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (0.0, 0.0, -1.0)
crates/ofm_core/src/development.rs:182:33: delete - in decline_per_season
crates/ofm_core/src/development.rs:169:53: replace / with % in training_factor
crates/season-harness/src/ageing.rs:89:63: replace != with == in ageing_report
crates/season-harness/src/ageing.rs:122:49: replace == with != in is_keeper
crates/season-harness/src/ageing.rs:197:47: replace / with * in median
crates/ofm_core/src/development.rs:185:39: delete - in decline_per_season
```
