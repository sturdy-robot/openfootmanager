Cloud run ofm-profile-shots-1: DONE

Setup: apt libs, Rust 1.95.0 (rustup), `npm ci` (0) all worked. Tips: A `c673c374` (merge of #1343 5c53723a into #1342), B `8e517ec0`. `git log --oneline -3` A: c673c374, 5c53723a, 85bf3968; B: 8e517ec0, 22a75573, b9d9cfe3.

## Part A
- ensure-page-fixture: 0 (wrote fixture.generated.ts, 652 KB). `tsc --noEmit`: 0.
- vitest (named dirs/files): 97 files, 852 tests, 0 failures.
- 23 PNGs: `shots/profile-p1/` (20 matrix + own-attributes light/dark + own-contract light). Every shot: fonts check true, scrollHeight==innerHeight (800/640), scrollWidth==innerWidth, unanswered `[]`, pastEdge `[]`. No blank shots, no "left the dashboard" alert.
- States (Overview tab):
  - own: Lewis Johnston, green card, RB/RWB/CB, Scotland, Glasgow FC link, age 25, foot/weak foot, Actions, overall 73. Traits row + Role + stats.
  - rival: Ross Robertson, blue card, CB, Edinburgh United, 78, Scout + Actions.
  - scouted: Sergio Romero (LB/LWB/CB), Free Agent, Scout + Actions, overall "-". Odd: scouted also shows "-".
  - unknown: Nelson Carvalho (RB/RWB/CB), Free Agent, Scout + Actions, "-", Hot head trait.
  - retired: Marcel Koch, Free Agent age 18, header title "PLAYER", Scout button, "-"; NO Actions menu, no retired marker visible, looks like an unknown player rather than a retired one.
- At 960: nothing clipped or sideways-scrolling, but in rival/scouted/unknown the overall tile drops below the name block, leaving empty space on the right of the card (own and retired keep it on the right). Stats labels wrap ("CLEAN SH", "AVG RATING").
- Layout check: exit 0, 42 of 42 cases pass (15 profile cases pass).
- lint 0 (160 infos, none in playerProfile/dev); format:check 0; knip 0 (2 config hints); npm test 0: 385 files, 3643 tests, 0 failed; build 0.

## Part B (tree b, CARGO_TARGET_DIR shared)
Compiled without errors.
- turn_tests training_injuries: 1 passed.
- random_events_tests injuries: 18 passed.
- --lib --features mcp the_mcp_skip: 4 passed (seed loop `0..50`, `.find` stops early; count not visible).
- ofm_core --lib training: 93 passed.
Reds (each restored; `git status --porcelain` empty):
- a (delete roll): FAILS the_day_ends_with_the_training_injuries_its_roll_gives_in_both_paths, turn_tests/training_injuries.rs:58 `process_day, seed 5` left `[]` right `[("t1_def1","common.injuries.kneeBruise",2)]`.
- b (roll before progress_injury_recovery): same test fails at :58, left days 1, right 2.
- c (user_follows = followed_club only): 2 failed, 16 passed: a_sacked_manager_gets_news_from_another_club_in_his_last_clubs_league (random_events_tests/injuries.rs:386 "seed 11: another club of his last club's league was left out") and a_notable_player_hurt_in_training_in_the_users_league_makes_the_news (:262). All three reds bite.
