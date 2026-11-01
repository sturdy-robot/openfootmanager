Cloud run ofm-perf-acad-gates: DONE

**Headline:** RED and both mutants were caught. The only new failure is clippy (`unscaled` dead code). Every test failure was already present at HEAD~1.

**Setup:** worked. apt install exit 0; toolchain 1.95.0 installed from rust-toolchain.toml. No npm commands were needed, so `npm ci` was not run.

**1. Sources:** HEAD `de8f76580e6c32701e91beb4077b672616cac927`, HEAD~1 `746e9070f0c24bcb30ad45b8a086d2a1d5e05c20`. Diff stat: generation.rs +41/-, youth.rs +119/-, "2 files changed, 155 insertions(+), 5 deletions(-)". Matches what was expected.

**2. RED** (`unscaled(age)`): exit 101. `test result: FAILED. 2 passed; 1 failed; 0 ignored; 0 measured; 1729 filtered out; finished in 1.61s`. Failed: `a_big_clubs_academy_recruits_higher_ceilings_than_a_small_clubs`, with "big club 69.49 against small club 69.49". Matches expectation. Restored; status empty.

**3. MUTANT A** (CLUB_LIFT): caught, exit 101. `test result: FAILED. 1 passed; 2 failed; ...; finished in 1.59s`. Failed:
- `an_average_clubs_academy_recruits_on_the_world_bells_mean` ("average club 70.52 against the world bell 69.45")
- **also** `the_worlds_academies_produce_s_tier_ceilings_at_the_world_bells_rate` ("academies 0.0117 against the world bell 0.0050")

Restored.

**4. MUTANT B** (damps_the_young, line 600): caught, exit 101. `test result: FAILED. 2 passed; 1 failed; ...; finished in 1.86s`. Failed: the S-tier-rate test ("academies 0.0015 against the world bell 0.0050"). Restored; status empty.

**5. GREEN:**
- youth tests: `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 1729 filtered out; finished in 1.58s`
- ofm_core lib: exit 101, `test result: FAILED. 1728 passed; 4 failed; ...; finished in 4.27s`. Failed: `generator::generation::tests::{a_generated_teenager_is_an_earlier_version_of_his_ceiling, a_generated_veteran_is_at_his_ceiling, a_new_world_opens_near_the_intended_mean_rating, the_ceilings_of_senior_players_follow_the_tier_targets}`. **These were already failing at HEAD~1** (1725 passed; 4 failed; same 4 names).
- fmt --check: exit 0.
- clippy: **exit 101. This is a new failure, introduced by de8f7658.** `error: associated function \`unscaled\` is never used` at generation.rs:567 (`-D dead-code`). Before the commit, youth.rs was the only non-test caller of `PlayerRoll::unscaled`; now `unscaled` is called only from `#[cfg(test)]` code. Fix it by deleting the function or marking it `#[cfg(test)]`.
- workspace: exit 101. Cargo stopped at the first failing target, so only one "test result:" line printed: `FAILED. 379 passed; 1 failed; 1 ignored` (db lib). Failed: `save_manager::tests::loading_a_save_applies_the_wonderkid_rule` ("the S-tier prospect was not tagged on load"). **This was already failing at HEAD~1.** Other crates did not run. Re-run with `--no-fail-fast`: exit 101, 84 "test result:" lines, **4187 passed, 5 failed**, 58 ignored. The 5 failures are the 4 ofm_core generation tests above and the db wonderkid test, and all 5 were already failing at HEAD~1. Nothing new fails.

**6. FINGERPRINTS** (both exit 0, test ok):

| line | HEAD~1 | HEAD |
|---|---|---|
| gate seed 1 two seasons | 5d7841f8de7b1652 | 2e2ae365f2deabe1 |
| gate seed 2 two seasons | cd173efe4d65607d | c198f18c96b2936d |
| gate seed 3 two seasons | 4b9b23610de593e8 | 3f65de45ac6e1bf7 |
| shipped seed 1 one season | 159b7d0cc4ef2062 | 80a4842baa780f34 |
| shipped seed 1 one season every match real | 051dae43441cd1c9 | 7eebc7bdbb676eb2 |

Raw lines:
```
HEAD~1: FINGERPRINT gate seed 1 two seasons 5d7841f8de7b1652
HEAD~1: FINGERPRINT gate seed 2 two seasons cd173efe4d65607d
HEAD~1: FINGERPRINT gate seed 3 two seasons 4b9b23610de593e8
HEAD~1: FINGERPRINT shipped seed 1 one season 159b7d0cc4ef2062
HEAD~1: FINGERPRINT shipped seed 1 one season every match real 051dae43441cd1c9
HEAD:   FINGERPRINT gate seed 1 two seasons 2e2ae365f2deabe1
HEAD:   FINGERPRINT gate seed 2 two seasons c198f18c96b2936d
HEAD:   FINGERPRINT gate seed 3 two seasons 3f65de45ac6e1bf7
HEAD:   FINGERPRINT shipped seed 1 one season 80a4842baa780f34
HEAD:   FINGERPRINT shipped seed 1 one season every match real 7eebc7bdbb676eb2
```
All 5 lines differ, including the two one-season lines. Run times: 78.51s / 81.84s.
