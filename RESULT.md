Cloud run ofm-design-tactics-table-1: DONE

**Setup** — worked. apt packages installed (exit 0); Rust 1.95.0 installed from rust-toolchain.toml; `npm ci` exit 0 (12.8s). Biome 2.5.5.

**1. Checkout** — `job` @ 70533bfe:
```
70533bfe feat(tactics): the player table replaces the list, grouped Starting eleven, Substitutes and Reserves
cf881f9a Merge branch 'feat/tactics-workbench-frame' into feat/tactics-player-table
fcc0caf1 Merge branch 'feat/tactics-lineup-projection' into feat/tactics-player-table
1a73d01f Merge branch 'feat/saved-tactic-holds-everything' into feat/tactics-player-table
2d120f09 Merge pull request #1237 from sturdy-robot/fix/accepted-bid-buyer-affordability
```

**2. Targeted vitest** — exit 1. Files 1 failed | 27 passed (28); Tests 3 failed | 292 passed (295); 49.33s.
- TacticsPlayerTable.test.tsx: all 8 pass — buildTableRows › orders the eleven by slot, the substitutes as the match ranks them, then the reserves; › claims no fit for a slot the backend hasn't described yet; TacticsPlayerTable › groups the rows into the eleven, the substitutes and the reserves; › says in words when a starter is out of position; › changes a starter's role from his slot's roles; › picks a starter or a substitute for a swap from his name; › lets only an available player be dragged to the pitch; › scrolls inside itself and marks the picked player's row.
- DataTable new tests: all 3 pass.
- Failures (all TacticsTab.test.tsx):
  - "shows a bench player's natural position on the pitch bench cards when it differs from position" — `Unable to find an element with the text: common.posAbbr.Defender` (:576)
  - "localizes the selected player position in the comparison panel" — `Found multiple elements with the text: common.positions.Forward` (two sr-only spans + one span)
  - "shows the deployed slot position for a starter played out of his natural position" — `Unable to find an element with the text: common.posAbbr.RightMidfielder` (:946)

**3. Mutations** — 3/3 caught, each restored (tree clean).
- a: "orders the eleven by slot…" — `AssertionError: expected [ Array(5) ] to deeply equal [ Array(5) ]` (1 failed | 7 passed)
- b: "says in words when a starter is out of position" — `Unable to find an element with the text: squad.outOfPosition` (1 failed | 7 passed)
- c (line 235, column `<th>`): "scrolls inside itself with its header kept in view when asked" — `expect(element).toHaveClass("sticky top-0")` (1 failed | 21 passed)

**4. Gates**
- `tsc --noEmit`: exit 2, 1 error — `src/components/tactics/TacticsTab.tsx(170,46): error TS2345: Argument of type 'string' is not assignable to parameter of type 'PlayerRole | null'.` — the `onRoleChange` call site is new in the F2 commit (not in its parent cf881f9a).
- `npm run lint`: exit 0, 141 infos; in touched files only `src/components/ui/DataTable.tsx:365:21 lint/a11y/useKeyWithClickEvents` (line predates F2, blame 82a6d928a).
- `npm run format:check`: exit 0, 918 files.
- `npm run knip`: exit 0, no findings; 2 configuration hints (tailwindcss ignoreDependencies; .css extension).
- `npm test`: exit 1. Files 1 failed | 371 passed (372); Tests 3 failed | 3399 passed (3402); 310.41s. Failures = the same 3 TacticsTab tests.
- `npm run audit:i18n`: exit 0; 205 frontend / 865 Rust candidates; none in the changed files.
