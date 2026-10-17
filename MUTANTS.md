# Mutation testing — PR #901, shard 1 of 3

## Setup

- **Setup worked.** apt packages (libwebkit2gtk-4.1-dev, libgtk-3-dev, librsvg2-dev,
  libayatana-appindicator3-dev) installed with exit 0; rustc 1.95.0 installed via the repo's
  `rust-toolchain.toml`; `cargo install cargo-mutants --version 25.3.1 --locked` succeeded.
- PR tip: `3ef3ea820458bb9230c22f0b10f4a9972f769f21` (3ef3ea82, as expected). Fetched develop:
  `3ded373d`, which is also the merge base.
- Diff: `git diff --relative=src-tauri 3ded373d pr-901 -- src-tauri`. `--list` gives **285** mutants
  (development.rs 216, season-harness/ageing.rs 46, generator/generation.rs 15, aging.rs 3,
  training.rs 3, season-harness/distribution.rs 2).
- Command: `CARGO_INCREMENTAL=1 cargo mutants --workspace --in-diff /tmp/pr901.rel.diff --in-place
  --profile mutants --timeout 300 --shard 1/3 --output /tmp/out901-1`. The `mutants` profile exists
  in `src-tauri/Cargo.toml`. 4 cores: `--in-place` tests mutants one at a time, and the tests use all 4 cores.
- The first launch was stopped after its baseline and relaunched with `setsid` so it would not
  hit the sandbox's 2-hour limit on background commands. Only the relaunch's results are reported here.

## Result

- Shard 1/3: **95 mutants**. Wall time **49 min 20 s** (2963 s, including the baseline: 8.2 s build
  + 72.2 s test).
- **Caught 90 · Missed 2 · Timeout 0 · Unviable 3**

## Missed — classification

| Mutant | Verdict | Cluster |
|---|---|---|
| `development.rs:133:67: replace - with + in base_growth` | **EQUIVALENT** | New (growth-table indexing, not one of the four clusters) |
| `development.rs:212:57: replace < with <= in stochastic_round` | **EQUIVALENT (in practice)** | New (rounding, not one of the four clusters) |

1. **`base_growth`, `GROWTH_BY_AGE.len() - 1` → `len() + 1`.** The clamp in
   `GROWTH_BY_AGE[lower.min(len - 1)]` can never bind. `base_growth` returns early when
   `curve_age >= DECLINE_STARTS_AT` (27), so `position = curve_age - 16 < 11` and
   `lower = floor(position) <= 10`, which is the last valid index. Raising the clamp to 12 changes
   nothing. A NaN curve age would make `.max(0.0)` give 0 anyway, and a curve age is always
   finite (`i32` age minus finite offsets). The clamp would only matter if `DECLINE_STARTS_AT` were
   raised above 27 without extending the table. That is a defensive line, not a gap in the growth curve.
2. **`stochastic_round`, `rng < fraction` → `rng <= fraction`.** The two differ only when the
   uniform draw *equals* the fraction exactly. `random_range(0.0..1.0)` produces values on a
   2^-52 grid, so they match only with probability about 2^-52 per call: either the fraction is 0 and the
   draw is exactly 0.0, or the fraction happens to lie on that grid and the draw hits it. A rounding
   test with any reachable number of seasons cannot tell the two apart, and no game can either. The
   mean-preserving rounding that the growth and decline averages depend on is not weakened.

**No REAL GAP in shard 1.** Neither survivor belongs to the clusters from the 4b0ddc81 run
(growth shares, decline columns, luck/resilience, harness 33+). In this shard every mutant in
those clusters was **caught**: all 10 `growth_shares` mutants, which include the 9 tuple
replacements and the deleted `22..=25` arm. The 32 caught `decline_per_season`, `decline`, `grow`
and season-harness mutants include the luck multipliers (`268:62/78`, `289:50`), the resilience
divide (`283:20`) and the goalkeeper factor (`285:24`). The new per-cluster tests bite. This log
cannot say whether these two survivors were also among the 46 from that run.

## Timeout

(none)

## Raw `missed.txt`

```
crates/ofm_core/src/development.rs:133:67: replace - with + in base_growth
crates/ofm_core/src/development.rs:212:57: replace < with <= in stochastic_round
```

## Raw `timeout.txt`

```
```

## Raw `unviable.txt`

```
crates/season-harness/src/distribution.rs:45:5: replace distribution_of -> DistributionReport with Default::default()
crates/season-harness/src/ageing.rs:126:5: replace top_players_profile -> AgeingReport with Default::default()
crates/ofm_core/src/development.rs:86:5: replace traits_of -> DevelopmentTraits with Default::default()
```

## Raw `caught.txt`

```
crates/ofm_core/src/generator/generation.rs:498:5: replace shaped_ceiling -> u8 with 1
crates/ofm_core/src/development.rs:254:44: replace - with + in grow
crates/ofm_core/src/development.rs:122:85: replace - with + in curve_age
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (0.0, 0.0, 0.0)
crates/ofm_core/src/development.rs:78:26: replace - with + in standard_normal
crates/ofm_core/src/development.rs:128:5: replace base_growth -> f64 with 0.0
crates/ofm_core/src/development.rs:117:5: replace curve_age -> f64 with 0.0
crates/ofm_core/src/development.rs:211:26: replace - with + in stochastic_round
crates/ofm_core/src/generator/generation.rs:500:31: replace * with + in shaped_ceiling
crates/ofm_core/src/development.rs:245:5: replace is_physical -> bool with true
crates/ofm_core/src/development.rs:180:9: delete match arm ..= 26 in decline_per_season
crates/ofm_core/src/development.rs:297:5: replace ceiling_step_spread -> f64 with 0.0
crates/ofm_core/src/development.rs:182:21: delete - in decline_per_season
crates/season-harness/src/ageing.rs:65:26: delete ! in snapshot_of
crates/ofm_core/src/development.rs:179:5: replace decline_per_season -> f64 with 0.0
crates/ofm_core/src/development.rs:155:5: replace training_factor -> f64 with 0.0
crates/season-harness/src/ageing.rs:193:31: replace / with * in median
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (0.0, 1.0, 0.0)
crates/season-harness/src/ageing.rs:194:21: replace % with + in median
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (1.0, -1.0, 0.0)
crates/season-harness/src/ageing.rs:172:11: replace == with != in share
crates/ofm_core/src/development.rs:310:5: replace ceiling_drift_still_to_come -> (f64, f64) with (-1.0, 0.0)
crates/ofm_core/src/development.rs:320:15: replace == with != in drift_ceiling
crates/ofm_core/src/development.rs:336:14: replace < with > in develop_one_season
crates/ofm_core/src/development.rs:99:5: replace is_goalkeeper -> bool with true
crates/season-harness/src/ageing.rs:91:48: replace >= with < in ageing_report
crates/season-harness/src/ageing.rs:172:5: replace share -> f64 with 0.0
crates/ofm_core/src/development.rs:142:9: replace / with % in headroom_brake
crates/ofm_core/src/development.rs:169:53: replace / with * in training_factor
crates/ofm_core/src/development.rs:210:5: replace stochastic_round -> i32 with 0
crates/ofm_core/src/development.rs:105:5: replace position_offset -> f64 with 0.0
crates/season-harness/src/ageing.rs:197:29: replace + with - in median
crates/ofm_core/src/generator/generation.rs:499:43: replace / with % in shaped_ceiling
crates/ofm_core/src/development.rs:184:27: delete - in decline_per_season
crates/ofm_core/src/development.rs:135:47: replace * with + in base_growth
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (1.0, 0.0, 0.0)
crates/ofm_core/src/development.rs:323:37: replace * with + in drift_ceiling
crates/season-harness/src/ageing.rs:122:5: replace is_keeper -> bool with true
crates/ofm_core/src/development.rs:173:33: replace * with / in training_factor
crates/ofm_core/src/development.rs:268:70: replace / with % in grow
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (-1.0, 1.0, 0.0)
crates/ofm_core/src/development.rs:170:40: replace - with + in training_factor
crates/season-harness/src/ageing.rs:85:58: replace >= with < in ageing_report
crates/ofm_core/src/development.rs:88:60: delete - in traits_of
crates/ofm_core/src/development.rs:142:16: replace + with * in headroom_brake
crates/ofm_core/src/development.rs:185:27: delete - in decline_per_season
crates/ofm_core/src/training.rs:400:5: replace train_player with ()
crates/ofm_core/src/development.rs:128:18: replace >= with < in base_growth
crates/season-harness/src/ageing.rs:180:5: replace mean -> f64 with 0.0
crates/ofm_core/src/development.rs:183:33: delete - in decline_per_season
crates/ofm_core/src/development.rs:184:45: delete - in decline_per_season
crates/season-harness/src/ageing.rs:183:36: replace / with % in mean
crates/ofm_core/src/development.rs:283:20: replace /= with *= in decline
crates/ofm_core/src/development.rs:80:32: replace * with / in standard_normal
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (-1.0, -1.0, 0.0)
crates/ofm_core/src/development.rs:182:39: delete - in decline_per_season
crates/ofm_core/src/development.rs:135:32: replace - with / in base_growth
crates/ofm_core/src/development.rs:212:18: replace + with * in stochastic_round
crates/ofm_core/src/development.rs:80:6: delete - in standard_normal
crates/ofm_core/src/development.rs:183:9: delete match arm 32..= 33 in decline_per_season
crates/ofm_core/src/development.rs:310:5: replace ceiling_drift_still_to_come -> (f64, f64) with (1.0, 0.0)
crates/season-harness/src/ageing.rs:188:5: replace median -> f64 with 1.0
crates/ofm_core/src/generator/generation.rs:500:19: replace + with * in shaped_ceiling
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (1.0, 1.0, 0.0)
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (-1.0, 0.0, 0.0)
crates/ofm_core/src/development.rs:313:19: replace * with + in ceiling_drift_still_to_come
crates/ofm_core/src/development.rs:298:9: delete match arm ..= 18 in ceiling_step_spread
crates/ofm_core/src/development.rs:268:62: replace * with / in grow
crates/ofm_core/src/development.rs:216:41: replace + with * in nudge
crates/ofm_core/src/development.rs:310:5: replace ceiling_drift_still_to_come -> (f64, f64) with (0.0, 0.0)
crates/ofm_core/src/development.rs:169:66: replace - with + in training_factor
crates/ofm_core/src/development.rs:141:5: replace headroom_brake -> f64 with 0.0
crates/season-harness/src/ageing.rs:103:34: delete ! in band_changes
crates/ofm_core/src/development.rs:148:5: replace growth_points -> f64 with -1.0
crates/ofm_core/src/development.rs:122:41: replace - with / in curve_age
crates/ofm_core/src/development.rs:199:5: replace growth_shares -> (f64, f64, f64) with (0.0, -1.0, 0.0)
crates/ofm_core/src/aging.rs:24:5: replace retirement_chance -> u32 with 1
crates/ofm_core/src/development.rs:134:47: replace + with * in base_growth
crates/ofm_core/src/development.rs:285:24: replace *= with /= in decline
crates/ofm_core/src/development.rs:162:35: replace <= with > in training_factor
crates/season-harness/src/ageing.rs:197:24: replace - with / in median
crates/ofm_core/src/development.rs:324:48: replace + with * in drift_ceiling
crates/ofm_core/src/development.rs:282:19: replace < with > in decline
crates/ofm_core/src/development.rs:170:27: replace + with * in training_factor
crates/ofm_core/src/development.rs:106:9: delete match arm Position::Forward | Position::Striker | Position::RightWinger | Position::LeftWinger in position_offset
crates/ofm_core/src/development.rs:262:26: replace == with != in grow
crates/ofm_core/src/development.rs:255:40: replace + with * in grow
crates/ofm_core/src/generator/generation.rs:500:58: replace - with / in shaped_ceiling
crates/ofm_core/src/development.rs:78:5: replace standard_normal -> f64 with 0.0
crates/ofm_core/src/development.rs:200:9: delete match arm ..= 17 in growth_shares
```
