# Cloud run r1-1030-mutants: DONE

**Setup: worked.** apt-get install of the webkit/gtk/rsvg/appindicator packages exited 0. rustup installed the pinned toolchain 1.95.0 (rustc 1.95.0 59807616e, cargo 1.95.0). No npm commands were needed, so `npm ci` was not run.

**1. Fetch.** `git fetch … pull/1030/head:pr-1030 && git checkout pr-1030` → HEAD `927867dedcac14ba59ebbdd50f6f61ca6ad8208b` (matches the expected 927867de).

**2. GREEN on the PR**
- a. `cargo test -p ofm_core --lib -- finances::journal` → exit 0. `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 1529 filtered out; finished in 0.00s` (wall time 3m2.921s, including the build)
- b. `cargo test -p ofm_core --test finances_tests` → exit 0. `test result: ok. 83 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s` (wall time 1m4.625s)

**3. fmt.** `cargo fmt --all -- --check` → exit 0, no output.

**4. Mutants** (`cargo test -p ofm_core --test finances_tests -- levers`; after each one, `git checkout pr-1030 -- src-tauri` left `git status --short` empty)
- a. gateminus: applied (text was unique) → exit 101. `11 passed; 1 failed; 71 filtered out`. FAILED: `levers::the_finance_snapshot_adds_last_weeks_home_gate_to_sponsor_income`
- b. costmod: applied (text was unique) → exit 101. `11 passed; 1 failed; 71 filtered out`. FAILED: `levers::a_marketing_campaign_costs_a_quarter_of_its_gross_revenue`
- c. norunwaypitch: applied (text was unique) → exit 101. `11 passed; 1 failed; 71 filtered out`. FAILED: `levers::a_solvent_club_with_eight_weeks_of_cash_left_or_less_can_pitch_for_a_sponsor` (and nothing else in levers)

**5. Summary**
- gateminus: CAUGHT by the_finance_snapshot_adds_last_weeks_home_gate_to_sponsor_income
- costmod: CAUGHT by a_marketing_campaign_costs_a_quarter_of_its_gross_revenue
- norunwaypitch: CAUGHT by a_solvent_club_with_eight_weeks_of_cash_left_or_less_can_pitch_for_a_sponsor

Each mutant failed exactly the test that was expected to catch it, and no other. The working tree was restored after every mutant.
