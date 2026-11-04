Cloud run prf-finish2: DONE

Setup: apt install exit 0; Rust 1.95.0 (rust-toolchain.toml) installed; cargo-mutants 27.1.0 installed.

1. HEAD e1aa18fe63e9cf07aea6a55a7cc9935bf0ac965d
```
e1aa18fe fix(match): finishing a live match early has the AI manage the user's side
c0fa97f2 test(match): finishing a live match early has the AI manage the user's side
218dd942 Merge pull request #1217 from sturdy-robot/fix/load-xi-formation-rows
```
2. RED c0fa97f2: exit 101, 0 passed; 1 failed; 568 filtered out
```
panicked at src/commands/live_match.rs:2016:9:
only 11 of the user's players appeared: nobody managed their side after the finish
```
3. GREEN head: exit 0, 1 passed; 0 failed; 568 filtered out. `-- live_match`: exit 0, 58 passed; 0 failed; 0 ignored; 511 filtered out.

4. Hand mutant (deleted `self.user_side = None;`, 1 deletion): exit 101, test FAILED (mutant caught), same message at live_match.rs:2016:9. Restored; `git status --short` empty.

5. fmt --check exit 0. clippy -D warnings exit 0; with --features mcp exit 0. Each prints only the 6 known ts-rs `warning: failed to parse serde attribute`.

6. `cargo test --workspace` exit 0 (8m00s): 97 result lines, 4582 passed, 0 failed, 64 ignored. `cargo test --lib --features mcp` exit 0: 688 passed; 0 failed; 1 ignored.

7. Fingerprints exit 0 at both; identical (1 passed each, 81.26s / 81.82s):
```
218dd942 and e1aa18fe:
FINGERPRINT gate seed 1 two seasons f43cf0647dabd2ad
FINGERPRINT gate seed 2 two seasons 69ac6b445f9b99c4
FINGERPRINT gate seed 3 two seasons 8e029c0ee4eb1889
FINGERPRINT authored-only club squads b8239a111741d47a
FINGERPRINT shipped seed 1 one season cdd5fb7e9e8e159d
FINGERPRINT shipped seed 1 one season every match real 17dc291019e6c49f
```
8. cargo mutants --in-place (-p ofm_core -p openfootmanager --profile mutants accepted), exit 2, 18m: 3 mutants; 0 caught, 1 missed, 2 unviable, 0 timeout. Baseline ok (614s build + 143s test).
- MISSED: `crates/ofm_core/src/live_match_manager.rs:214:9: replace LiveMatchSession::play_out_unmanaged -> Vec<MinuteResult> with vec![]`
- Unviable: play_out_unmanaged -> `vec![Default::default()]`; `src/application/live_match.rs:25:5` finish_live_match -> `Ok(Default::default())`

- Scoping: by default cargo-mutants runs only the mutated package's tests (ofm_core); the catching test is in openfootmanager_lib. Rerun of that mutant with `--test-package openfootmanager --baseline skip`: exit 0, 1 caught (2m17s). So the MISSED was a scoping artifact.

After: `git diff` empty; untracked mutants.out/ removed; status empty.
