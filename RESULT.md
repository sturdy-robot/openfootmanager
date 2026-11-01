Cloud run ofm-design-squad-sort-3: DONE

**Setup** worked: apt exit 0; Rust 1.95.0 installed; `npm ci` exit 0; Biome 2.5.5.

**1.** `job` @ 5257b67f (parents 00bfce74 + cd4da88e; #1122 49b83589, #1125 3fc0b200, #1126 cd4da88e in).
```
5257b67f Merge remote-tracking branch 'upstream/develop' into fix/squad-sort-stable
cd4da88e Merge pull request #1126 from sturdy-robot/feat/teams-table
00bfce74 Merge branch 'feat/teams-table' into fix/squad-sort-stable
096b844b test(lib): names that differ only by case are a tie to sortRows
7035ce71 fix(teams): a row shows its club's city, and names tell their accents apart
```

**2. GREEN** — a3d6fa92 `-t "persisted OVR"`: exit 0, 1 passed | 29 skipped (30).
Tip: exit 0, Files 7 passed (7), Tests 111 passed (111), 17.81s. sortRows.test.ts 10/10 (8 `sortRows` + 2 `nextSort`); SquadRosterView.sort.test.ts 4/4; "keeps a player with no shirt number at the foot of the roster in both directions" ✓; SquadCardsView.test.tsx 17/17.

**3. RED** (all restored, tree clean) — caught 5/5:
1. view reversal: exit 1, 1 failed | 31 passed — "keeps a player with no shirt number at the foot…".
2. jersey `?? 999`: exit 1, 2 failed | 34 passed — that test + "puts a player with no shirt number last in both directions".
3. contract: exit 1, 1 failed | 35 passed — "puts a player with no contract end last in both directions".
4. OVR sign: exit 1, 1 failed | 35 passed — "orders by position as XI first, then position order, then rating high to low".
5. sortRows: exit 1, 1 failed | 9 passed — "compares tuple values item by item, with no value still last".
Note: against SquadTab.test.tsx alone, mutants 3 and 4 pass 32/32; only the unit test catches them.

**4. GATES** — tsc exit 0. lint exit 0, "Found 149 infos", none in changed files. format:check exit 0 (879 files). knip exit 0, only 2 config hints (tailwindcss ignoreDependencies; .css excluded). npm test exit 0, Files 354 passed (354), Tests 3244 passed (3244), 317.75s. build exit 0, 2.10s.

**5. Sizes** (d1632265 → 5257b67f): sort.ts absent → 62; SquadRosterView.tsx 642 → 614; main function 574 → 542 lines.
