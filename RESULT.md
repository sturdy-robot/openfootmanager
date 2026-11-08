Cloud run ofm-harness-rt-12: PARTIAL

Source: origin/test/save-roundtrip-keeps-the-game, HEAD c1a995f446dfb65240f193cb6aec47ae5c3fd02e ("test(db): two seasons, so that mail is old enough for the inbox archive to take (#396)"). No code edited.
Setup: worked. apt packages installed (exit 0); Rust 1.95.0 from rust-toolchain.toml.

## DEBUG: cargo test -p db --test save_round_trip_tests -- --nocapture --test-threads=4
Exit 101, wall 155s (includes compile). "finished in 2.43s". 6 passed; 1 failed.
- a_career_at_its_start_loads_back_unchanged ... ok
- a_career_after_a_free_agent_signing_loads_back_unchanged ... ok
- known_bug_a_players_weak_foot_changes_by_one_step_on_a_reload ... ok
- known_bug_a_reload_reschedules_matches_the_live_game_scheduled ... ok
- known_bug_staff_made_during_a_season_have_no_nationality_until_a_reload ... ok
- a_reversed_archived_table_is_a_difference ... ok
- a_career_after_the_rollover_loads_back_unchanged ... FAILED

Failure (panicked at crates/db/tests/save_round_trip_tests.rs:509:5):
"after the rollover: what was read back differs from what was saved (1401 paths, first 40):"
Printed paths are all game.national_teams[nt-XX].fixtures[ntf-N-...] with three fields differing: advancing_team_id (saved null, loaded e.g. "nt-cz"), result (saved null, loaded a populated result object), status (saved "Scheduled", loaded "Completed"). First path: game.national_teams[nt-cz].fixtures[ntf-1-nt-cz-nt-kw]. Teams in the first 40: nt-cz, nt-ni, nt-bg, nt-gu, nt-br, nt-dk, nt-ie, nt-eng, nt-hn, nt-as. Only 40 of 1401 are printed, so the other paths are unknown.

## RELEASE: same command, --release
Exit 101, wall 192s (includes compile). "finished in 1.73s". 6 passed; 1 failed. Same test failed, same panic line (509:5), same "1401 paths, first 40".

## cargo clippy --locked -p db --all-targets -- -D warnings
Exit 0, wall 28s. No warnings.

## cargo fmt --all --check
Exit 0, wall 3s. No diff.
