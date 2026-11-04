Cloud run prz-roles: DONE

**Setup:** worked. apt exit 0; rustup installed pinned 1.95.0; cargo-mutants 27.1.0 installed. No npm step requested, so `npm ci` not run. Disk filled once mid-step 6 (see 6).

**1.** HEAD 993709174d75b75e1304d993beff70b65682a99e. `99370917 fix(match): a role changed on the pre-match screen reaches the match` / `c354db21 test(match): …` / `ddb53055 fix(match): a dial changed …`.

**2. RED @c354db21**
- a. exit 101, 0 passed 1 failed: `every_wide_role_of_the_forward_group_suits_a_forward` — `assertion left == right failed: WideForward must suit a forward; left: Err("be.error.roleNotValidForPosition") right: Ok(())` (live_match_tests.rs:809).
- b. exit 101, 1 passed 2 failed. `a_role_changed_before_kick_off_reaches_the_match`: `the live session must play with the role set before kick-off; left: Standard right: SweeperKeeper` (time.rs:1950). `a_role_cleared_before_kick_off_leaves_the_match_on_standard`: `assertion left == right failed; left: Standard right: SweeperKeeper` (time.rs:1968). `a_saved_role_his_slot_in_the_match_refuses_is_left_out` ok.

**3. GREEN @head** (all exit 0): every_wide_role 1/0; lib 3 passed 0 failed; live_match_manager_tests 47 passed 0 failed (all 4 named ok); live_match_tests 81 passed 0 failed.

**4. Hand mutants** (restored after each; status empty)
| | Failing tests |
|-|-|
| R1 | lib: a_role_changed_before_kick_off_reaches_the_match, a_role_cleared_before_kick_off_leaves_the_match_on_standard |
| R2 | **NONE — survives** |
| R3 | lib: a_role_cleared_before_kick_off_leaves_the_match_on_standard (time.rs:1975) |
| R4 | every_wide_role_of_the_forward_group_suits_a_forward; ofm_core: a_saved_role_reaches_a_starter_of_a_waiting_match, saving_a_dial_leaves_a_role_changed_in_the_match_alone, saving_a_role_leaves_a_dial_changed_in_the_match_alone; engine: a_role_that_suits_the_position_is_applied (+ every_wide_role) |

R2 reason: the only slot-refusal tests use Poacher on a defender, which the later `.filter(|role| role.suits(starter.position))` also rejects, so `admits_role` is masked. Needs a role the coarse group admits but the fine slot refuses.

**5.** fmt --check exit 0; clippy exit 0; clippy --features mcp exit 0. Only the 6 known ts-rs "failed to parse serde attribute" warnings each.

**6.** `cargo test --workspace`: 96 result lines, 4571 passed, 0 failed, 63 ignored; log ends cleanly after `Doc-tests season_harness`, with no error lines. Its exit code was lost because the wrapper hit "No space left on device" after cargo finished; a rerun was stopped at <2G free. `--lib --features mcp`: exit 0, 693 passed 0 failed 1 ignored.

**7. Fingerprints** (both exit 0, identical):
```
FINGERPRINT gate seed 1 two seasons 5775029d54549864
FINGERPRINT gate seed 2 two seasons b33856a558913d0d
FINGERPRINT gate seed 3 two seasons 9263c787c520059b
FINGERPRINT authored-only club squads b8239a111741d47a
FINGERPRINT shipped seed 1 one season 24423b95ea27c6d3
FINGERPRINT shipped seed 1 one season every match real 47d90d083f3e0885
```

**8. cargo mutants** (profile and all 3 packages accepted): exit 0, 11 mutants in 23m: **10 caught, 0 missed, 0 timeout, 1 unviable** (`squad.rs:650 set_player_role_internal -> Ok(Default::default())`). Baseline 602s build + 131s test. `git diff` empty afterwards. cargo-mutants made no mutant for lines 348/351 (R2/R3), so R2 is covered only by step 4.
