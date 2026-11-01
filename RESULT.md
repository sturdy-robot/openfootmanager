Cloud run tq-tr-gates-2: DONE

## Setup — worked
- apt-get packages: exit 0. rustc 1.95.0 (pinned). cargo-mutants 25.3.1 installed, exit 0. No npm commands were needed, so `npm ci` was not run.

## Sources
HEAD `20ffdc66e22e80cd22b37a00f9386e5d9cd5e49d` (as expected)

## Gates (in src-tauri/)
- a. `cargo fmt --all --check`: exit 0
- b. `cargo clippy --locked -p ofm_core --all-targets -- -D warnings`: exit 0, no warnings
- c. `cargo test --locked --no-fail-fast -p ofm_core --lib --test training_tests`: exit 0
  - lib: `test result: ok. 1702 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.75s`
  - training_tests: `test result: ok. 54 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s`
- d. `cargo test --locked -p ofm_core --lib -- training::tests::`: exit 0
  - `test result: ok. 77 passed; 0 failed; 0 ignored; 0 measured; 1625 filtered out; finished in 0.04s`
  - 77 = 54 `training::tests::` (as expected) + 23 `ai_training::tests::` (substring match). FAILED: none.

## Mutants
- `--list`: exit 0, 45 mutants listed (job expected about 40)
- In-place run (`--in-place --no-shuffle --timeout 600 --output /tmp/tr-mutants3 -- --lib --test training_tests`): exit 2 (cargo-mutants exits 2 when mutants were missed)
  - `Found 45 mutants to test`
  - `45 mutants tested in 25m 37s: 3 missed, 42 caught`
  - unviable 0, timeout 0. Wall time: real 25m38.300s
- An earlier attempt was stopped during its baseline build, before any mutant was applied. The run above is a full clean rerun.

missed.txt (verbatim):
```
crates/ofm_core/src/training.rs:496:21: replace < with <= in apply_fitness_change
crates/ofm_core/src/training.rs:503:21: replace < with <= in apply_fitness_change
crates/ofm_core/src/training.rs:512:25: replace < with <= in apply_fitness_change
```
timeout.txt (verbatim): empty (0 lines)

The 3 survivors are exactly the expected equivalent `roll <` comparisons. All 3 mutants at 344:30 were caught.

`git status --short` after: empty (clean tree)
