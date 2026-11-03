Cloud run ofm-profile-m2c: DONE

Setup: apt deps installed (exit 0); Rust 1.95.0 per rust-toolchain.toml installed; Node v22.23.4; `npm ci` exit 0.

1. HEAD (detached on m2c): `2ede5290 feat(managers): the managers directory, with each reputation's band` / `68a928cb Merge pull request #1170 from sturdy-robot/fix/familiarity-review-findings`.
2. wire_types with OFM_UPDATE_TS_TYPES=1: exit 0, 9 passed. Re-run: exit 0, 9 passed. New files (all `??`, none changed) under src/store/generated/: ManagerClub.ts, ManagerRecord.ts, ManagerReputation.ts, ManagerSummary.ts, ManagersPage.ts, ManagersStatus.ts, ReputationBand.ts, Vacancy.ts.
3. Backend (CARGO_INCREMENTAL=0): fmt --check 0; clippy -D warnings 0 (550s); clippy --features mcp 0 (62s).
   - manager_reputation: 11 passed; 0 failed; 1911 filtered out.
   - slices::managers: 7 passed; 0 failed; 1915 filtered out.
   - managers_page (lib): 1 passed (`the_managers_page_adapter_answers_a_key_for_no_session_and_lists_the_user`); 567 filtered out.
   - workspace: exit 0, no failures; ofm_core lib 1921 passed/1 ignored; openfootmanager_lib 567 passed/1 ignored; db 408/1 ignored; wire_types 9; season_harness 102; all other binaries ok.
   - --lib --features mcp: exit 0.
4. Frontend: format:check 0 (903 files); lint 0 (147 infos, no warnings/errors); knip 0 (only 2 configuration hints); tsc 0 errors; focused vitest 11 files/42 tests passed; npm test Test Files 362 passed (362), Tests 3339 passed (3339) (Dashboard stale-save did not fail); build 0.
5. Red steps (tree restored after each):
   - A (620→621): each_band_starts_at_its_floor FAILED — CAUGHT.
   - B (filter → true): the_directory_lists_every_active_manager_by_club_then_name FAILED — CAUGHT; the_user_is_listed_from_his_live_record FAILED — CAUGHT; also the_status_filter_splits_employed_from_between_jobs FAILED.
   - C (delete en below_average, JSON valid): "has a word for every reputation band" FAILED (`expected [ 'below_average' ] to deeply equal []`) — CAUGHT.
   - D cargo-mutants 27.1.0: 16 mutants tested in 37m: 9 caught, 0 missed, 7 unviable (all `Default::default()`/`vec![Default::default()]` replacements). First attempt aborted on "No space left on device" during baseline; src-tauri/target was deleted and the run repeated cleanly.
