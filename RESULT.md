Cloud run ofm-harness-qm-4: DONE

Source: origin `cloud-src/ofm-harness/qm2` @ 7b26e0e7.

**Candidate constants.** The job's sed text was garbled: `const CEILING_MEAN: f64 = 70.1 5.0 a;` / `const CEILING_SD: f64 = ;`. Taken literally it would not compile. The only numbers in it, 70.1 and 5.0, match HEAD exactly, so I ran HEAD unmodified. grep at generation.rs:483 gives `CEILING_MEAN: f64 = 70.1;` and at :487 `CEILING_SD: f64 = 5.0;`.

**Setup**
- apt-get update + install: exit 0, 31s.
- Rust 1.95.0 installed by rustup from rust-toolchain.toml.
- npm ci: skipped, because this job runs no npm commands.

**Steps**
- diag_dist.rs created as given. It compiled with no changes. It was deleted afterwards and is not committed.
- `cargo test --release ... --test diag_dist --no-run`: exit 0, 183s (Finished in 3m 02s).
- `cargo test --release --manifest-path src-tauri/Cargo.toml -p season-harness --test diag_dist -- --nocapture --test-threads=1`: exit 0, 2039s wall. Output: `test result: ok. 1 passed; 0 failed; ... finished in 2038.11s`.

**DIST lines**
```
DIST seed 1    opening: seniors  9120 mean 69.72 S 2.57% A 9.50% ceilingS 3.15% ceilingA 11.80% wonderkids 0.38%
DIST seed 1   season 1: seniors  9088 mean 69.34 S 2.00% A 7.88% ceilingS 2.57% ceilingA 10.08% wonderkids 0.34%
DIST seed 1   season 3: seniors  9952 mean 69.04 S 1.68% A 6.68% ceilingS 2.07% ceilingA 8.48% wonderkids 0.11%
DIST seed 1   season 5: seniors 10839 mean 68.88 S 1.49% A 5.92% ceilingS 1.73% ceilingA 7.10% wonderkids 0.08%
DIST seed 1   season 8: seniors 11430 mean 68.74 S 1.14% A 5.51% ceilingS 1.21% ceilingA 6.17% wonderkids 0.07%
DIST seed 1  season 10: seniors 11313 mean 68.56 S 0.90% A 5.29% ceilingS 0.95% ceilingA 5.79% wonderkids 0.08%
DIST seed 1  season 12: seniors 11784 mean 68.46 S 0.92% A 5.35% ceilingS 1.00% ceilingA 5.70% wonderkids 0.12%
DIST seed 1  season 15: seniors 11187 mean 68.45 S 0.85% A 5.36% ceilingS 0.95% ceilingA 5.86% wonderkids 0.13%
DIST seed 1  season 18: seniors 10225 mean 68.67 S 0.91% A 5.84% ceilingS 1.00% ceilingA 6.24% wonderkids 0.07%
DIST seed 1  season 20: seniors 10621 mean 68.76 S 0.92% A 6.10% ceilingS 1.03% ceilingA 6.65% wonderkids 0.10%
DIST seed 2    opening: seniors  9181 mean 69.75 S 2.82% A 9.72% ceilingS 3.41% ceilingA 12.19% wonderkids 0.26%
DIST seed 2   season 1: seniors  9127 mean 69.29 S 2.17% A 8.34% ceilingS 2.74% ceilingA 10.64% wonderkids 0.19%
DIST seed 2   season 3: seniors 10071 mean 69.01 S 1.68% A 7.49% ceilingS 2.15% ceilingA 9.16% wonderkids 0.08%
DIST seed 2   season 5: seniors 10852 mean 68.85 S 1.33% A 6.39% ceilingS 1.68% ceilingA 7.55% wonderkids 0.09%
DIST seed 2   season 8: seniors 11435 mean 68.76 S 1.21% A 5.72% ceilingS 1.37% ceilingA 6.19% wonderkids 0.13%
DIST seed 2  season 10: seniors 11318 mean 68.55 S 1.02% A 5.22% ceilingS 1.14% ceilingA 5.58% wonderkids 0.07%
DIST seed 2  season 12: seniors 11707 mean 68.46 S 0.93% A 5.19% ceilingS 1.08% ceilingA 5.49% wonderkids 0.12%
DIST seed 2  season 15: seniors 11200 mean 68.52 S 1.05% A 4.94% ceilingS 1.18% ceilingA 5.32% wonderkids 0.11%
DIST seed 2  season 18: seniors 10239 mean 68.74 S 1.13% A 5.02% ceilingS 1.20% ceilingA 5.38% wonderkids 0.09%
DIST seed 2  season 20: seniors 10658 mean 68.81 S 1.11% A 5.38% ceilingS 1.20% ceilingA 5.95% wonderkids 0.10%
```

**Against the target band** (S 1.0–1.8%, A 5.9–8.2%)
- Seed 1 is inside the band only at seasons 3 and 5 (season 5: A 5.92%). From season 8 on, A is 5.29–5.84%. The exception is season 20, where A is 6.10%, but S is 0.92% there. S is below 1.0% from season 10 on.
- Seed 2 is inside the band at seasons 3 and 5. From season 8 on, A is 4.94–5.72%. S stays at 1.02–1.21% from season 8 on, except season 12 (0.93%). Season 1 A is 8.34%, above the band.
- Compared with the develop reference for seed 1:
  - Season 5: S 1.49% vs 1.37%, A 5.92% vs 6.58%, mean 68.88 vs 68.87.
  - Season 10: S 0.90% vs 1.00%, A 5.29% vs 6.11%, mean 68.56 vs 68.70.
- Settled verdict: this candidate settles below #965's A band, around 5.0–5.9%, and S drifts to about 0.9–1.1%.
- Push note: `cloud-run/ofm-harness-qm-4` already existed on origin and the push was refused as non-fast-forward. I delivered to `claude/cloud-run-ofm-harness-qm-4` instead.
