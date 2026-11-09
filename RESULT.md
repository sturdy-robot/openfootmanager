Cloud run ofm-harness-ti-mut2: DONE

Setup: apt libs installed (exit 0); Rust 1.95.0 per rust-toolchain.toml (cargo 1.95.0). No npm needed (Rust-only job).
Source: origin/test/ten-seasons-keep-the-world-supplied, HEAD 28ad5d0b55fcacf1844caa1d1f5f1f8e4a06ecd1 ("test(season-harness): doc wording (#528)"). Checked out detached from my start commit ae5e94e7c56fd180c0873c07b9d51d42fc54c577.

Command (both steps): cargo test --release --manifest-path src-tauri/Cargo.toml -p season-harness --test nightly -- --ignored --nocapture ten_seasons_keep_the_world_supplied_by_the_youth_intake

0. Baseline: exit 0, PASS (1 passed; 0 failed), test time 159.82s, wall 6m2.8s (incl. build).
   Every season of seeds 1-3: "80 of 80 clubs took an intake".
   Seed 1 players: 3744 start, s1 3744 (239 recruits), s2 3642 (132), s3 4027 (103), s4 4050 (113), s5 4000 (132), s6 3875 (118), s7 4208 (110), s8 4242 (120), s9 4131 (114), s10 3977 (118); median club age 21->23.
   Seed 2: 3632 start -> 3647, 3516, 3925, 3951, 3869, 4167, 4205, 4107, 3961 (s10 3961, 114 recruits).
   Seed 3: 3563 start -> 3595, 3505, 3836, 3863, 3827, 3721, 4109, 4147, 4043, 3921 (s10 117 recruits).

1. Mutation: `    if true { return; }` inserted as first statement of apply_youth_intake.
   git diff --stat: src-tauri/crates/ofm_core/src/youth_intake.rs | 1 +  (1 file changed, 1 insertion)
   Result: exit 101, FAIL (as EXPECTED: the test bites). Test time 49.02s, wall 3m46.1s.
   Printed series (seed 1, every season 0 recruits, 0 of 80 clubs took an intake):
   start 3744; s1 3511 (median age 23); s2 3276 (23); s3 3521 (24); s4 3452 (25); s5 3287 (25); s6 3052 (26); s7 3243 (27); s8 3183 (28); s9 2993 (29); s10 2734 (29).
   Complete failure text:
   thread 'ten_seasons_keep_the_world_supplied_by_the_youth_intake' (3310) panicked at crates/season-harness/tests/nightly.rs:811:9:
   seed 1: the player count fell below 90% of the start (3744): [3744, 3511, 3276, 3521, 3452, 3287, 3052, 3243, 3183, 2993, 2734]
   test ten_seasons_keep_the_world_supplied_by_the_youth_intake ... FAILED
   test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 11 filtered out; finished in 49.02s
   (It failed on seed 1 first, so seeds 2-3 never ran.)

Mutation reverted with `git checkout -- .`; nothing kept.
