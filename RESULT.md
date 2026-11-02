Cloud run xi2-1: DONE

Job: ofm-frontend #1149 after its CodeRabbit finding (MCP tool schema description).

## Setup
- apt-get install of libwebkit2gtk-4.1-dev, libgtk-3-dev, librsvg2-dev and libayatana-appindicator3-dev: exit 0.
- The Rust toolchain 1.95.0 (pinned in rust-toolchain.toml) was installed by rustup: rustc 1.95.0 (59807616e 2026-04-14).
- `npm ci` was not run because this job has no npm steps.

## Sources
- `git fetch https://github.com/sturdy-robot/openfootmanager cloud-src/ofm-frontend/xi2:fam` then `git checkout fam`.
- HEAD: `591bf81def22dcf4ec3562db541108e5680e246e` "docs(mcp): squad_set_starting_xi's schema states the eligible-pool contract". This commit changes only `src-tauri/src/mcp_server/tools.rs` (+2/-2).

## Commands (in src-tauri/)
1. `cargo fmt --all --check`: exit 0, with no output.
2. `cargo test --locked --lib --features mcp mcp_server`: exit 0.
   - `running 109 tests`
   - `test result: ok. 109 passed; 0 failed; 0 ignored; 0 measured; 575 filtered out; finished in 0.79s`
   - The first attempt was stopped by the runner's 30-minute background limit while it was still compiling from a cold cache, before any test ran. The rerun shown here took 77 s wall time ("Finished `test` profile ... in 1m 16s").
3. `cargo clippy --locked --workspace --all-targets --features mcp -- -D warnings`: exit 0.
   - It took 364 s wall time ("Finished `dev` profile [optimized + debuginfo] target(s) in 6m 03s").
   - There were no clippy lints.
   - ts-rs printed 6 warnings, "warning: failed to parse serde attribute", for `alias = "..."` attributes such as `alias = "first_season"` and `alias = "judging_ability"`. These are ts-rs macro notes ("It will be ignored"), not lints, so `-D warnings` does not turn them into errors.

No code was changed.
