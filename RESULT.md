Cloud run tq-1202-1: DONE

**Setup: OK.** apt packages (libwebkit2gtk-4.1-dev, libgtk-3-dev, librsvg2-dev, libayatana-appindicator3-dev, patchelf) exit 0; rust 1.95.0 (rust-toolchain.toml) installed with clippy and rustfmt; Node v24.22.1 first on PATH. Started from commit ae5e94e7c56fd180c0873c07b9d51d42fc54c577.
**Disk:** the first fix-1203 workspace and clippy runs died with `No space left on device (os error 28)`, an environment problem. I deleted `target/` and reran those steps with `CARGO_INCREMENTAL=0`, wiping `target/` between branches. The reruns are the `_r` results below. No code was changed.

**Shas (all as expected)**
- fix-1202 5f338784fc64f1f45e4724737cb3cd8194abe722 ← dfb5eef50476c9a4b279607b8bc7c91b3df0fdc6 ← 5029fc668b1c659b9f3a096a03ba41ddc55b5255
- fix-1203 54ae445af21af4b5df56a9126907fc79aad7b84a ← 81632453b7e0b2cc2e653a84fb791a7f6603ac44 ← 5029fc66…
- fix-1205 2489538958d26bc607304af0d4f9ae33221ed73d ← 8d4be7b5014297c67c2c7b281d66e9467413768f ← 5029fc66…
- fix-1208 464d7348e3896d1f4377cd89aebd8bcb9884a23a ← 7d92b1699ee2442819d879d23667dea46048cb82 ← 5029fc66…

| Step | Exit | Secs | Decisive line |
|---|---|---|---|
| T red (fix-1202~1) | 101 | 183 | `FAILED. 13 passed; 3 failed; 0 ignored; 0 measured; 1898 filtered out` |
| T green | 0 | 68 | `ok. 16 passed; 0 failed; 0 ignored; 0 measured; 1898 filtered out` |
| 1202 fmt --check | 0 | 3 | |
| 1202 clippy -D warnings | 0 | 343 | |
| 1202 workspace --no-fail-fast | 0 | 1018 | 96 result lines, all ok, 0 failed (appendix) |
| 1202 --lib --features mcp | 0 | 281 | `ok. 686 passed; 0 failed; 1 ignored` |
| B red, filter as given | 0 | 72 | `ok. 0 passed; 0 failed; 0 ignored; 0 measured; 1913 filtered out` |
| B green, filter as given | 0 | 26 | same: 0 passed, 1913 filtered out |
| **B' red** `transfers::bids::` | 101 | 101 | `FAILED. 10 passed; 2 failed; 0 ignored; 0 measured; 1901 filtered out` |
| **B' green** | 0 | 149 | `ok. 12 passed; 0 failed; 0 ignored; 0 measured; 1901 filtered out` |
| 1203 --test backend_keys | 101 | 0 | **no such test target** (`error: no test target named `backend_keys` in default-run packages`) |
| 1203 workspace (_r) | 0 | 970 | 96 result lines, all ok, 0 failed (appendix) |
| 1203 clippy (_r) | 0 | 305 | |
| 1203 mcp (_r) | 0 | 269 | `ok. 686 passed; 0 failed; 1 ignored` |
| 1203 npm ci / vitest src/i18n | 0 / 0 | 10 / 10 | `Test Files  10 passed (10)` · `Tests  39 passed (39)` |
| L red (fix-1205~1) | 101 | 161 | `FAILED. 58 passed; 1 failed; 0 ignored; 0 measured; 1853 filtered out` |
| L green | 0 | 105 | `ok. 59 passed; 0 failed; 0 ignored; 0 measured; 1853 filtered out` |
| 1205 -p ofm_core --no-fail-fast | 0 | 142 | 39 result lines, all ok (lib: `1911 passed; 0 failed; 1 ignored`) |
| 1205 clippy -p ofm_core | 0 | 30 | |
| S red (fix-1208~1) | 101 | 564 | `FAILED. 6 passed; 1 failed; 0 ignored; 0 measured; 561 filtered out` |
| S green | 0 | 52 | `ok. 7 passed; 0 failed; 0 ignored; 0 measured; 561 filtered out` |
| 1208 --lib | 0 | 6 | `ok. 567 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out` |
| 1208 clippy --all-targets | 0 | 285 | |

**B finding:** the bids tests are in `transfers::bids::acceptance_tests`, so B's filter (`transfers::bids::tests::`) matches no tests. B' uses the filter `transfers::bids::` instead, and its red/green match the job's expectations.

**T red, FAILED lines** (red and green test lines are listed in full below):
```
test transfers::execution::tests::a_lapsed_agreement_is_reported_once ... FAILED
test transfers::execution::tests::an_agreed_sale_released_before_registration_is_reported_to_the_seller ... FAILED
test transfers::execution::tests::an_agreed_purchase_released_before_registration_is_reported_to_the_buyer ... FAILED
```
Panics (each ends in a stack backtrace, omitted here):
```
thread 'transfers::execution::tests::a_lapsed_agreement_is_reported_once' (4656) panicked at crates/ofm_core/src/transfers/execution.rs:930:9:
assertion `left == right` failed
  left: 0
 right: 1
thread 'transfers::execution::tests::an_agreed_sale_released_before_registration_is_reported_to_the_seller' (4661) panicked at crates/ofm_core/src/transfers/execution.rs:909:9:
assertion `left == right` failed
  left: 0
 right: 1
thread 'transfers::execution::tests::an_agreed_purchase_released_before_registration_is_reported_to_the_buyer' (4660) panicked at crates/ofm_core/src/transfers/execution.rs:886:9:
assertion `left == right` failed
  left: 0
 right: 1
```

**T test lines matching registration / released_before_registration / lapsed_agreement (red):**
```
test transfers::execution::tests::a_closed_window_does_not_report_a_registration_failure ... ok
test transfers::execution::tests::a_buyer_with_insufficient_cash_is_told_why_registration_failed ... ok
test transfers::execution::tests::a_buyer_with_insufficient_budget_is_told_why_registration_failed ... ok
test transfers::execution::tests::a_final_registration_refusal_is_not_silent ... ok
test transfers::execution::tests::a_future_agreement_is_not_reported_as_a_registration_failure ... ok
test transfers::execution::tests::a_pending_loan_explains_a_failed_transfer_registration ... ok
test transfers::execution::tests::a_successful_registration_has_no_failure_reason ... ok
test transfers::execution::tests::an_active_loan_explains_a_failed_transfer_registration ... ok
test transfers::execution::tests::a_failed_registration_survives_reload_without_duplicate_notifications ... ok
test transfers::execution::tests::an_ai_registration_failure_keeps_its_reason_without_an_unrelated_message ... ok
test transfers::execution::tests::an_unavailable_player_explains_a_failed_transfer_registration ... ok
test transfers::execution::tests::competing_registrations_explain_the_deal_that_cannot_be_funded ... ok
test transfers::execution::tests::the_user_selling_club_is_told_why_registration_failed ... ok
test transfers::execution::tests::a_lapsed_agreement_is_reported_once ... FAILED
test transfers::execution::tests::an_agreed_sale_released_before_registration_is_reported_to_the_seller ... FAILED
test transfers::execution::tests::an_agreed_purchase_released_before_registration_is_reported_to_the_buyer ... FAILED
```

**B' red: every test line and panics:**
```
test transfers::bids::acceptance_tests::a_failed_transfer_sends_no_agreement_notice ... ok
test transfers::bids::acceptance_tests::a_declined_transfer_sends_no_agreement_notice ... ok
test transfers::bids::acceptance_tests::a_rejected_transfer_counter_sends_no_agreement_notice ... ok
test transfers::bids::acceptance_tests::a_deferred_bid_notifies_the_buyer_of_registration ... ok
test transfers::bids::acceptance_tests::a_transfer_counter_that_keeps_talking_sends_no_agreement_notice ... ok
test transfers::bids::acceptance_tests::accepting_a_deferred_sale_notifies_the_seller ... ok
test transfers::bids::acceptance_tests::accepting_an_immediate_sale_notifies_the_seller ... ok
test transfers::bids::acceptance_tests::an_accepted_deferred_counter_notifies_the_seller ... ok
test transfers::bids::acceptance_tests::an_accepted_immediate_counter_notifies_the_seller ... ok
test transfers::bids::acceptance_tests::an_immediate_bid_notifies_the_buyer ... ok
test transfers::bids::acceptance_tests::accepting_a_bid_the_buyer_has_no_budget_for_is_refused ... FAILED
test transfers::bids::acceptance_tests::accepting_a_bid_the_buyer_has_no_cash_for_is_refused ... FAILED
thread 'transfers::bids::acceptance_tests::accepting_a_bid_the_buyer_has_no_budget_for_is_refused' (11728) panicked at crates/ofm_core/src/transfers/bids.rs:1120:9:
assertion `left == right` failed
  left: Ok(())
 right: Err("be.error.transfers.buyerCannotAffordFee")
thread 'transfers::bids::acceptance_tests::accepting_a_bid_the_buyer_has_no_cash_for_is_refused' (11729) panicked at crates/ofm_core/src/transfers/bids.rs:1107:9:
assertion `left == right` failed
  left: Ok(())
 right: Err("be.error.transfers.buyerCannotAffordFee")
```

**L red: FAILED line and panic:**
```
test transfers::loans::acceptance_tests::a_loan_cannot_be_accepted_on_a_player_already_sold_for_the_window ... FAILED
thread 'transfers::loans::acceptance_tests::a_loan_cannot_be_accepted_on_a_player_already_sold_for_the_window' (13818) panicked at crates/ofm_core/src/transfers/loans.rs:1868:9:
assertion `left == right` failed
  left: Ok(())
 right: Err("be.error.transfers.playerAlreadyLoaned")
```

**S red: every test line and panic** :
```
test commands::season::tests::rolling_over_before_completion_is_refused ... ok
test commands::season::tests::rolling_the_season_over_for_a_replaced_career_is_refused ... ok
test commands::season::tests::the_board_can_fire_at_rollover ... ok
test commands::season::tests::an_unemployed_manager_rolling_the_season_over_is_not_fired_again ... FAILED
test commands::season::tests::season_advance_rolls_the_season_over ... ok
test commands::season::tests::rolling_over_twice_is_refused ... ok
test commands::season::tests::the_tool_and_the_command_agree ... ok
thread 'commands::season::tests::an_unemployed_manager_rolling_the_season_over_is_not_fired_again' (30235) panicked at src/commands/season.rs:330:9:
Some(String("fired"))
```

**T green: matching test lines:**
```
test transfers::execution::tests::a_closed_window_does_not_report_a_registration_failure ... ok
test transfers::execution::tests::a_buyer_with_insufficient_cash_is_told_why_registration_failed ... ok
test transfers::execution::tests::a_buyer_with_insufficient_budget_is_told_why_registration_failed ... ok
test transfers::execution::tests::a_failed_registration_survives_reload_without_duplicate_notifications ... ok
test transfers::execution::tests::a_future_agreement_is_not_reported_as_a_registration_failure ... ok
test transfers::execution::tests::a_lapsed_agreement_is_reported_once ... ok
test transfers::execution::tests::a_pending_loan_explains_a_failed_transfer_registration ... ok
test transfers::execution::tests::an_active_loan_explains_a_failed_transfer_registration ... ok
test transfers::execution::tests::a_final_registration_refusal_is_not_silent ... ok
test transfers::execution::tests::an_agreed_purchase_released_before_registration_is_reported_to_the_buyer ... ok
test transfers::execution::tests::a_successful_registration_has_no_failure_reason ... ok
test transfers::execution::tests::an_ai_registration_failure_keeps_its_reason_without_an_unrelated_message ... ok
test transfers::execution::tests::an_agreed_sale_released_before_registration_is_reported_to_the_seller ... ok
test transfers::execution::tests::an_unavailable_player_explains_a_failed_transfer_registration ... ok
test transfers::execution::tests::competing_registrations_explain_the_deal_that_cannot_be_funded ... ok
test transfers::execution::tests::the_user_selling_club_is_told_why_registration_failed ... ok
```

**S green: every test line:**
```
test commands::season::tests::rolling_over_before_completion_is_refused ... ok
test commands::season::tests::rolling_the_season_over_for_a_replaced_career_is_refused ... ok
test commands::season::tests::an_unemployed_manager_rolling_the_season_over_is_not_fired_again ... ok
test commands::season::tests::season_advance_rolls_the_season_over ... ok
test commands::season::tests::the_board_can_fire_at_rollover ... ok
test commands::season::tests::the_tool_and_the_command_agree ... ok
test commands::season::tests::rolling_over_twice_is_refused ... ok
```

### Appendix: every `test result` line, 1202_ws
```
test result: ok. 408 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 28.42s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s
test result: ok. 88 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.12s
test result: ok. 69 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.82s
test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.21s
test result: ok. 80 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.62s
test result: ok. 4 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 4.10s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s
test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.65s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.51s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.16s
test result: ok. 50 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.37s
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 11.03s
test result: ok. 27 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.58s
test result: ok. 0 passed; 0 failed; 9 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 3 passed; 0 failed; 13 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 28 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 1913 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 5.32s
test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.18s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.45s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 81 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.55s
test result: ok. 114 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.72s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 83 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 38 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.23s
test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.67s
test result: ok. 93 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s
test result: ok. 25 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 84 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.25s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 2 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 47 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 53 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 28 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 39.07s
test result: ok. 1 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.54s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 60 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 137 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 112 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.38s
test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.50s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.65s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 566 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 6.10s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.27s
test result: ok. 102 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.18s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.10s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.70s
test result: ok. 0 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 11 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.00s
test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.67s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### Appendix: every `test result` line, 1203_ws_r
```
test result: ok. 408 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 27.39s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s
test result: ok. 88 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s
test result: ok. 69 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.82s
test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.16s
test result: ok. 80 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.61s
test result: ok. 4 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 3.26s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.11s
test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.56s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.11s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.83s
test result: ok. 50 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.32s
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 10.88s
test result: ok. 27 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.37s
test result: ok. 0 passed; 0 failed; 9 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 3 passed; 0 failed; 13 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 28 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 1912 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 4.08s
test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.17s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.32s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 81 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.83s
test result: ok. 114 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.68s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 83 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 38 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.21s
test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.59s
test result: ok. 93 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s
test result: ok. 25 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 84 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.19s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 2 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 47 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 53 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 28 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 38.39s
test result: ok. 1 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.49s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 60 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 137 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 112 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.41s
test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.47s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.79s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 566 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 5.68s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.21s
test result: ok. 102 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.91s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.45s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.76s
test result: ok. 0 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 11 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.90s
test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.51s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### Appendix: every `test result` line, 1205_core
```
test result: ok. 1911 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 4.09s
test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.19s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.34s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 81 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.78s
test result: ok. 114 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.60s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 83 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 38 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.22s
test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.61s
test result: ok. 93 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.04s
test result: ok. 25 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 84 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.21s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 2 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 47 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 53 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 28 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 37.49s
test result: ok. 1 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.46s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 60 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 137 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 112 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.38s
test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.44s
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.70s
test result: ok. 0 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```
