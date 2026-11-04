Cloud run ofm-perf-e1201-gates: DONE

**Setup** worked. apt install exit 0; rustup installed toolchain 1.95.0 (from rust-toolchain.toml); `npm ci` exit 0; `npm exec --no -- biome --version` → `Version: 2.5.5`.

**Source** `origin/cloud-src/ofm-perf/e1201-fix` = `cfcf7aafb38c110986ea83b73fe121327cc85bbe` ("fix(editor): an asset file is named for its entity's kind as well as its id"). `git diff --stat HEAD~1 HEAD`: 7 files changed, 128 insertions(+), 7 deletions(-) (package_editor.rs +117/-, CompetitionForm/MetadataForm/PlayerForm/TeamForm.tsx +1 each, useAssetPicker.test.ts +2, useAssetPicker.ts 12).

**1. Green**
- cargo (3 named tests): exit 0, `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 567 filtered out; finished in 0.00s`
- vitest useAssetPicker.test.ts: exit 0, `Test Files  1 passed (1)`, `Tests  7 passed (7)`

**2. Reds** (all caught; `git status --short` empty after each restore)
- a (`{entity_id}.{ext}`): exit 101, `test result: FAILED. 2 passed; 1 failed; ... 567 filtered out; finished in 0.38s`. Failed: `same_id_assets_of_two_kinds_do_not_overwrite_each_other` — `assertion left != right failed`, left/right `"assets/images/premier-league.png"`.
- b (`if true || !same_file`): exit 101, `FAILED. 2 passed; 1 failed; ... finished in 0.40s`. Failed: `re_picking_the_asset_already_in_place_keeps_its_bytes` — `left: ""`, `right: "logo bytes"`.
- c (`if false {`): exit 101, `FAILED. 2 passed; 1 failed; ... finished in 0.41s`. Failed: `an_asset_for_an_unknown_kind_is_refused` — `left: Ok("assets/images/stadium-fc-a.png")`, `right: Err("be.error.invalidPath")`.
- d (deleted `entityKind,`): exit 1, `Test Files  1 failed (1)`, `Tests  1 failed | 6 passed (7)`. Failed: "useAssetPicker > copies the chosen file and commits the returned path" — `expected "vi.fn()" to be called with arguments: [ 'copy_package_asset', …(1) ]`, missing `"entityKind": "team"`.

**3. Gates** (unmodified tree)
- `cargo fmt --all -- --check`: exit 0, no output.
- `cargo clippy --locked --workspace --all-targets -- -D warnings`: exit 0, finished in 5m 16s. Only 6 non-rustc warnings, from ts-rs ("failed to parse serde attribute" `alias = "first_season"/"judging_ability"/"judging_potential"`, each twice).
- `cargo test --locked --lib -- commands::package_editor`: `test result: ok. 25 passed; 0 failed; 0 ignored; 0 measured; 545 filtered out; finished in 0.01s`
- `npm run format:check`: exit 0, `Checked 901 files in 396ms. No fixes applied.`
- `npm run lint`: exit 0, `Checked 903 files in 860ms. No fixes applied. Found 147 infos.` None of the infos are on lines this commit changed.
- `npm run build`: exit 0, `✓ built in 1.95s`
- `npm run knip`: exit 0, no findings. It printed 2 configuration hints (tailwindcss in ignoreDependencies; .css extension excluded).
- vitest src/components/menu/PackageEditor: `Test Files  18 passed (18)`, `Tests  278 passed (278)`, Duration 19.14s.
