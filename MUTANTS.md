# cargo-mutants — PR #901, shard 2 of 3

## Setup
- Worked. apt packages (libwebkit2gtk-4.1-dev, libgtk-3-dev, librsvg2-dev, libayatana-appindicator3-dev) installed; Rust 1.95.0 installed by rustup from `rust-toolchain.toml`; `cargo install cargo-mutants --version 25.3.1 --locked` succeeded.
- PR tip: `3ef3ea82` (confirmed). Develop fetched at `3ded373d`. Diff = `git diff --relative=src-tauri $(git merge-base origin-develop pr-901) pr-901 -- src-tauri`; `--list` gave **285** mutants in total, **95** in shard 2/3.
- Command: `CARGO_INCREMENTAL=1 cargo mutants --workspace --in-diff /tmp/pr901.rel.diff --in-place --profile mutants --timeout 300 --shard 2/3 --output /tmp/out901-2` (the `mutants` profile exists in `src-tauri/Cargo.toml`, so `--profile` was kept).
- Jobs: 1. cargo-mutants 25.3.1 refuses the combination (`error: the argument '--in-place' cannot be used with '--jobs <JOBS>'`), so mutants ran one at a time; cargo itself still built and tested on all 4 cores.
- Baseline: ok, 184.7s build + 71.1s test.
- The first launch was stopped right after the baseline (one mutant tested) so it could be relaunched detached from the 2-hour background limit. The tree was checked clean at 3ef3ea82 before the identical command ran again from scratch.

## Wall time
- 56m 41s from the first launch to the end, including the restart; cargo-mutants itself reported 50m 50s for the complete run.

## Counts
| caught | missed | timeout | unviable | total |
|---|---|---|---|---|
| 88 | 3 | 0 | 4 | 95 |

## Missed — classification

1. `crates/ofm_core/src/development.rs:282:19: replace < with <= in decline` — **EQUIVALENT.** The branch also runs when `change == 0.0`. There `0.0 / resilience` and `0.0 * 0.5` both stay 0.0 (resilience is clamped to [0.5, 2.2], so it is never 0 or NaN), `stochastic_round(0.0 * luck)` is 0, and the luck draw happens outside the branch, so the RNG stream is the same. Behaviour cannot change. Area: decline / resilience. Cluster: in the luck/resilience cluster's code, but because the mutant is equivalent, no test could catch it. (I didn't have the 4b0ddc81 survivor list; the line has been unchanged since ed05474b.) It can be left as is, or the guard can be dropped.
2. `crates/season-harness/src/ageing.rs:88:41: replace >= with < in ageing_report` — **REAL GAP.** The numerator of `aged_33_plus_a_or_s_share` would count A/S players *under* 33 instead of over. `the_share_of_the_old_who_are_still_a_or_s_is_reported` has exactly one old A/S player (82) and exactly one young A/S player (the 25-year-old rated 90), so both versions give 1/4 = 0.25. Scenario: a world with two S-tier 34-year-olds and no young star reports 0.5 correctly, but the mutant reports 0.0, and no test notices. Area: the harness's retirement/longevity measurement (who is still good at 33+), not the game model. Cluster: **harness 33+, a test that did not bite.** d57aec39 rewrote this test (78→74, "and a star of 25") for this cluster, but the young-star count equals the old-star count. Fix: add a second young star, or remove the old S, so the two counts differ.
3. `crates/ofm_core/src/development.rs:133:67: replace - with / in base_growth` — **EQUIVALENT.** `lower.min(GROWTH_BY_AGE.len() - 1)` becomes `lower.min(11)`. The early return at `curve_age >= DECLINE_STARTS_AT` (27) guarantees `position < 11`, so `lower <= 10` and the clamp never binds (a NaN curve age becomes 0 through `.max(0.0)`). Both versions index the same element. Area: growth curve by age. Cluster: **new**. `base_growth` is not `growth_shares`, so this falls in none of the four named clusters. It is equivalent, so no test could catch it: the defensive `.min` is dead code and could be removed.

**Summary:** 1 real gap (harness 33+ share, a test that did not bite) and 2 equivalent. None of the shard-2 survivors weakens the growth curve, the decline columns, the peak offset / resilience traits, the goalkeeper offset, the ceiling drift, `shaped_ceiling`, `ceiling_drift_still_to_come` or the retirement modifiers (`aging.rs`, 1 mutant, caught): every mutant in those areas in this shard was caught or unviable.

## Timeout
(none)

## Raw files

### missed.txt
```
crates/ofm_core/src/development.rs:282:19: replace < with <= in decline
crates/season-harness/src/ageing.rs:88:41: replace >= with < in ageing_report
crates/ofm_core/src/development.rs:133:67: replace - with / in base_growth
```

### caught.txt
```
crates/ofm_core/src/development.rs:173:20: replace * with + in training_factor
crates/ofm_core/src/development.rs:80:57: replace * with + in standard_normal
crates/season-harness/src/ageing.rs:175:22: replace / with % in share
crates/ofm_core/src/development.rs:122:20: replace - with + in curve_age
crates/ofm_core/src/development.rs:184:33: delete - in decline_per_season
crates/ofm_core/src/development.rs:323:46: replace + with - in drift_ceiling
crates/ofm_core/src/aging.rs:86:5: replace apply_seasonal_aging with ()
crates/season-harness/src/ageing.rs:122:5: replace is_keeper -> bool with false
crates/ofm_core/src/training.rs:448:69: replace == with != in train_player
crates/ofm_core/src/development.rs:135:17: replace + with - in base_growth
crates/ofm_core/src/development.rs:148:5: replace growth_points -> f64 with 0.0
crates/ofm_core/src/development.rs:135:59: replace - with + in base_growth
crates/ofm_core/src/development.rs:245:5: replace is_physical -> bool with false
crates/ofm_core/src/development.rs:99:5: replace is_goalkeeper -> bool with false
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (0.0, 0.0, 1.0)
crates/season-harness/src/ageing.rs:183:36: replace / with * in mean
crates/ofm_core/src/development.rs:289:50: replace * with + in decline
crates/ofm_core/src/development.rs:284:23: replace && with || in decline
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (-1.0, 0.0, 1.0)
crates/ofm_core/src/development.rs:148:28: replace * with + in growth_points
crates/season-harness/src/ageing.rs:98:5: replace band_changes -> Vec<BandChange> with vec![]
crates/ofm_core/src/development.rs:313:19: replace * with / in ceiling_drift_still_to_come
crates/ofm_core/src/development.rs:80:11: replace * with + in standard_normal
crates/ofm_core/src/development.rs:183:21: delete - in decline_per_season
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (0.0, 1.0, 1.0)
crates/ofm_core/src/development.rs:179:5: replace decline_per_season -> f64 with 1.0
crates/ofm_core/src/development.rs:135:47: replace * with / in base_growth
crates/ofm_core/src/generator/generation.rs:499:43: replace / with * in shaped_ceiling
crates/season-harness/src/ageing.rs:108:56: replace - with + in band_changes
crates/season-harness/src/ageing.rs:172:5: replace share -> f64 with 1.0
crates/ofm_core/src/generator/generation.rs:499:26: replace - with + in shaped_ceiling
crates/ofm_core/src/development.rs:170:53: replace * with + in training_factor
crates/ofm_core/src/generator/generation.rs:500:31: replace * with / in shaped_ceiling
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (1.0, -1.0, 1.0)
crates/season-harness/src/ageing.rs:138:46: replace >= with < in top_players_profile
crates/ofm_core/src/development.rs:257:41: replace * with + in grow
crates/ofm_core/src/development.rs:201:9: delete match arm 18..= 21 in growth_shares
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (0.0, -1.0, 1.0)
crates/ofm_core/src/development.rs:299:9: delete match arm 19..= 21 in ceiling_step_spread
crates/ofm_core/src/development.rs:211:26: replace - with / in stochastic_round
crates/ofm_core/src/development.rs:210:5: replace stochastic_round -> i32 with 1
crates/ofm_core/src/development.rs:128:5: replace base_growth -> f64 with 1.0
crates/ofm_core/src/development.rs:297:5: replace ceiling_step_spread -> f64 with 1.0
crates/ofm_core/src/development.rs:334:5: replace develop_one_season with ()
crates/ofm_core/src/development.rs:78:5: replace standard_normal -> f64 with 1.0
crates/ofm_core/src/development.rs:89:49: replace * with + in traits_of
crates/ofm_core/src/development.rs:117:5: replace curve_age -> f64 with 1.0
crates/ofm_core/src/development.rs:122:85: replace - with / in curve_age
crates/ofm_core/src/development.rs:310:5: replace ceiling_drift_still_to_come -> (f64, f64) with (0.0, 1.0)
crates/ofm_core/src/generator/generation.rs:500:48: replace * with + in shaped_ceiling
crates/ofm_core/src/development.rs:182:27: delete - in decline_per_season
crates/ofm_core/src/development.rs:323:37: replace * with / in drift_ceiling
crates/ofm_core/src/development.rs:212:57: replace < with == in stochastic_round
crates/season-harness/src/ageing.rs:194:25: replace == with != in median
crates/ofm_core/src/development.rs:336:14: replace < with <= in develop_one_season
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (-1.0, -1.0, 1.0)
crates/ofm_core/src/development.rs:183:39: delete - in decline_per_season
crates/ofm_core/src/development.rs:169:66: replace - with / in training_factor
crates/ofm_core/src/development.rs:310:5: replace ceiling_drift_still_to_come -> (f64, f64) with (1.0, 1.0)
crates/ofm_core/src/development.rs:131:31: replace - with + in base_growth
crates/ofm_core/src/development.rs:170:40: replace - with / in training_factor
crates/ofm_core/src/development.rs:155:5: replace training_factor -> f64 with 1.0
crates/ofm_core/src/development.rs:184:9: delete match arm 34..= 35 in decline_per_season
crates/ofm_core/src/development.rs:88:36: replace * with + in traits_of
crates/season-harness/src/distribution.rs:45:64: delete ! in distribution_of
crates/ofm_core/src/development.rs:181:9: delete match arm 27..= 29 in decline_per_season
crates/ofm_core/src/development.rs:141:5: replace headroom_brake -> f64 with 1.0
crates/season-harness/src/ageing.rs:180:5: replace mean -> f64 with 1.0
crates/ofm_core/src/development.rs:185:15: delete - in decline_per_season
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (1.0, 1.0, 1.0)
crates/season-harness/src/ageing.rs:197:29: replace + with * in median
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (1.0, 0.0, 1.0)
crates/ofm_core/src/development.rs:268:78: replace * with + in grow
crates/ofm_core/src/development.rs:216:5: replace nudge with ()
crates/ofm_core/src/development.rs:105:5: replace position_offset -> f64 with 1.0
crates/season-harness/src/ageing.rs:197:47: replace / with % in median
crates/ofm_core/src/development.rs:78:26: replace - with / in standard_normal
crates/ofm_core/src/development.rs:268:70: replace / with * in grow
crates/ofm_core/src/development.rs:185:33: delete - in decline_per_season
crates/ofm_core/src/development.rs:279:5: replace decline with ()
crates/ofm_core/src/development.rs:254:44: replace - with / in grow
crates/ofm_core/src/development.rs:169:40: replace - with + in training_factor
crates/ofm_core/src/development.rs:310:5: replace ceiling_drift_still_to_come -> (f64, f64) with (-1.0, 1.0)
crates/ofm_core/src/development.rs:142:9: replace / with * in headroom_brake
crates/season-harness/src/ageing.rs:188:5: replace median -> f64 with -1.0
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (-1.0, 1.0, 1.0)
crates/ofm_core/src/development.rs:167:36: replace <= with > in training_factor
crates/ofm_core/src/development.rs:109:9: delete match arm Position::CenterBack | Position::Defender in position_offset
```

### timeout.txt
```
```

### unviable.txt
```
crates/ofm_core/src/development.rs:221:5: replace aspects_of -> [(&mut u8, Aspect); 19] with [(Box::leak(Box::new(0)), Default::default()); 19]
crates/season-harness/src/ageing.rs:78:5: replace ageing_report -> AgeingReport with Default::default()
crates/season-harness/src/ageing.rs:210:9: replace AgeingLog::starting_from -> Self with Default::default()
crates/ofm_core/src/generator/generation.rs:518:5: replace generate_random_player_from_def -> Player with Default::default()
```
