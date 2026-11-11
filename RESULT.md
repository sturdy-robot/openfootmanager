Cloud run ofm-profile-shots-2: DONE

Setup: apt libs, Rust 1.95 toolchain, `npm ci` OK. Source `job` = fork feat/profile-shell-and-tabs: fa3ea049 Merge upstream/develop; 2c7ea9ab fix(profile): rating wraps with scouting button and Actions; 56c2bf92 test(profile): same. No code changed.
- ensure-page-fixture: exit 0 (652 KB).
- tsc --noEmit: clean. Vitest subset: 97 files, 855 tests, 0 failures.
- 24 shots, committed under shots/profile-p1-2/ (own commit 541c0bb8, then this file). Every shot: font Barlow Condensed true, scrollHeight=innerHeight, scrollWidth=innerWidth, unanswered [], pastEdge [], no alert, right player.
- Page-layout-check: exit 0, 42 of 42 cases pass (15 profile: 5 states x 3).
- lint: exit 0, 160 infos, none in playerProfile or src/dev. format:check exit 0. knip exit 0 (2 config hints only). npm test: 385 files, 3646 tests, 0 failures. build exit 0.

States (960 unless noted):
- own: green card; name, RB/RWB/CB badges, Scotland, Glasgow FC, age/foot/weak foot wrap to 2 lines; Actions then 73 tile on the right. No Scout button. Traits row below tabs.
- rival: blue card; CB badge, Edinburgh United, Scout + Actions + 78 tile all right. 3-line meta wrap, no clipping.
- scouted: white card; LB/LWB/CB, Greece, Free Agent, Scout + Actions, overall tile "-". Badges wrap to a second line.
- unknown: like scouted (Vanuatu, 32) with dash.
- retired: Marcel Koch, no Actions, Scout only, dash tile.
In all, the overall tile is now on the right beside the buttons, not alone under the avatar (the first-set problem is gone), unlike the first set. No sideways scroll, no overlap.
Extras: Career shows populated advanced stats (shots 14, passes 212/251...); Attributes shows coaches' opinion and lists; Contract shows expected rows.
Oddity: own Overview "Season Statistics" shows 0 apps/0 goals/0.0 rating while Recent Matches chart has five points and Career shows stats. Not fixed (no code changes).
