Cloud run ofm-harness-ti-mut: DONE

Setup: apt libs installed (exit 0); Rust 1.95.0 per rust-toolchain.toml installed by rustup; npm not needed (cargo only).

Source: origin/test/ten-seasons-keep-the-world-supplied, `git rev-parse HEAD` = a8251109df7db67523b3fc79e9e7eadeb8604c0b

Mutation: `if true { return; }` as first statement of `pub fn apply_youth_intake` (youth_intake.rs).
`git diff --stat`:
 src-tauri/crates/ofm_core/src/youth_intake.rs | 1 +
 1 file changed, 1 insertion(+)

Command: cargo test --release --manifest-path src-tauri/Cargo.toml -p season-harness --test nightly -- --ignored --nocapture ten_seasons_keep_the_world_supplied_by_the_youth_intake
Exit code: 101. Wall time: real 4m23.840s (build 3m33s; test "finished in 49.96s").
Result: FAILED as expected (mutant caught; the test bites).

Complete failure text:
thread 'ten_seasons_keep_the_world_supplied_by_the_youth_intake' (3140) panicked at crates/season-harness/tests/nightly.rs:807:13:
seed 1 season 1: only 0 of 80 clubs took an intake
test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 11 filtered out; finished in 49.96s

Printed series:
seed 1: 3744 players at the start
seed 1 season 1: 3511 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 23
seed 1 season 2: 3276 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 23
seed 1 season 3: 3521 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 24
seed 1 season 4: 3452 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 25
seed 1 season 5: 3287 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 25
seed 1 season 6: 3052 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 26
seed 1 season 7: 3243 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 27
seed 1 season 8: 3183 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 28
seed 1 season 9: 2993 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 29
seed 1 season 10: 2734 players, 0 recruits, 0 of 80 clubs took an intake, median age at clubs 29

Restore: `git checkout -- .` run; tree clean. Nothing kept.
