Cloud run r2-1025-gates-1: DONE

**Setup:** apt deps installed (exit 0); Rust 1.95.0 (rust-toolchain.toml) installed; `npm ci` exit 0; `biome --version` → `Version: 2.5.5` (real).

**Sources:** pr-1025 = 00108545834a02ec368a2dfe307a9edbb5269cc4 (expected); pr-1014 = bc547c6fb439ef16d91189103e3aa930a36b2044 (expected). **up-develop differs:** fetched develop is c8f29f320e2d587e81840057ba8e51897ec98dde (36b12ae8 is its ancestor; 4 merges newer: #1033, #935, #1019, #1016). Ran on 36b12ae8 as instructed. Merge 36b12ae8 + pr-1025: clean → 3885e818.

**Step 2 gates (#1025 merge):**
- a. lint: exit 0 (147 infos, no errors)
- b. format:check: exit 0 (799 files)
- c. knip: exit 0 (2 configuration hints only)
- d. build: exit 0, 0 type errors (25.4s)
- e. vitest: exit 0 — `Test Files 39 passed (39)`, `Tests 375 passed (375)`
- f. cargo fmt --check: exit 0; clippy -p ofm_core --examples -D warnings: exit 0 (1m06s)

**Step 3 mutants** (`git status --short` clean afterwards; all 9 applied):

| id | result | failing tests |
|----|--------|---------------|
| J1 | CAUGHT | SquadTab: "clears an earlier failure once a menu action succeeds", "shows why a listing from the roster menu failed" |
| J2 | MISSED | — (70/70 pass) |
| J3 | CAUGHT | DataTable: "draws the name's aside beside its open button"; SquadTab: "says in words who starts, who is hurt and where each is from", "shows progressive injury details in the roster" |
| J4 | MISSED | — |
| J5 | MISSED | — |
| J6 | CAUGHT | SquadTab: "says in words who starts, who is hurt and where each is from" |
| J7 | MISSED | — |
| J8 | CAUGHT | DataTable: "shows the folded columns in a row's details" |
| J9 | CAUGHT | designSystem: "design system rules in finished folders > keeps each vocabulary in its one home" (1 failed, 27 passed) |

Caught 5/9; missed J2, J4, J5, J7.

**Step 4 (#1014 + #1025 on 36b12ae8):** both merges clean → 320d9b8a. `npm ci` exit 0.
- a. build: exit 0, no type errors
- b. npm test: exit 0 — `Test Files 316 passed (316)`, `Tests 2889 passed (2889)`, Duration 261.37s; no failures
- c. src/designSystem.test.ts: passed in the full run; re-run alone: `Tests 32 passed (32)`
