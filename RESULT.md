Cloud run t3-1: PARTIAL

## Setup — worked
- `apt-get update && apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev`: exit 0
- Rust: rust-toolchain.toml pins 1.95.0; rustup installed it → `rustc 1.95.0 (59807616e 2026-04-14)`, `cargo 1.95.0 (f2d3ce0bd 2026-03-21)`
- `npm ci`: exit 0 (real 0m12.970s)

## 1. Sources
- `git fetch https://github.com/sturdy-robot/openfootmanager cloud-src/ofm-frontend/t3:fam && git checkout fam`: OK
- HEAD `933634ab46de300b9837fb230b53dda1b3af47e6` — "refactor(tactics): the pitch is a presenter of the screen's one familiarity table, and its tone waits on lineupReady; a test per entry point keeps the selection"

## 2. GREEN — FAILED (so I stopped here)
`npm exec --no -- vitest run src/components/tactics src/components/squad src/components/match src/hooks src/pages/Dashboard.test.tsx`: exit 1
- Test Files  1 failed | 64 passed (65)
- Tests  2 failed | 745 passed (747)
- Duration  80.60s

Failing tests (both in src/components/tactics/TacticsTab.test.tsx):
1. `TacticsTab > shows a tactics token summary when its name is hovered`
   - `expect(tooltip).toHaveTextContent("squad.pitchTokenTooltip")` (line 304)
   - Expected `squad.pitchTokenTooltip`, received `squad.pitchTokenConditionOnly`
2. `TacticsTab > describes a tactics token and shows its summary on focus`
   - `expect(control).toHaveAccessibleDescription("squad.pitchTokenTooltip…")` (line 317)
   - Expected `squad.pitchTokenTooltip`, received `squad.pitchTokenConditionOnly`

It's deterministic: running TacticsTab.test.tsx alone fails the same 2 tests (Tests 2 failed | 51 passed (53)).

## 3. MUTANTS — not run (GREEN failed)
## 4. GATES — not run (GREEN failed)

No source files were changed. The only commit on top of the HEAD above is the one that adds this file.
