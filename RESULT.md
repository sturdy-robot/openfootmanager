Cloud run t4-1: DONE

Mutation verdict: 2 of 5 persist-site mutants caught. **Sites 1 (best fit), 2 (promote), 3 (demote) are NOT caught.**

**Setup — worked.** apt-get install: exit 0. Rust 1.95.0 (pinned) installed. Node v22.23.4. `npm ci`: exit 0.

**1. Sources.** fetched `cloud-src/ofm-frontend/t4` → `fam`. HEAD `04b66e55220fe3bd53b626067eb3e26795787267` "test(tactics): the token summary tests wait for the squad's answer".

**2. GREEN** (tactics, squad, match, hooks, Dashboard.test.tsx): exit 0. Test Files 66 passed (66); Tests 749 passed (749); Duration 75.62s.

**3. MUTANTS** (TacticsTab.test.tsx, 53 tests; `git checkout -- src` after each). Sites at useTacticsLineup.ts lines 261/282/299/394/453 = handleAssignBestFit / handlePromoteBenchPlayer / handleDemoteStarter / handleSlotDrop / handleConfirmSwap (order confirmed).
- M1 best fit: exit 0, 53 passed — **MISSED**
- M2 promote: exit 0, 53 passed — **MISSED**
- M3 demote: exit 0, 53 passed — **MISSED**
- M4 drop: exit 1, 1 failed | 52 passed — CAUGHT by "keeps the selection when a dropped lineup is not saved"
- M5 confirm swap: exit 1, 1 failed | 52 passed — CAUGHT by "…not saved because the familiarity has not arrived > keeps the selection when Confirm swap is pressed"
- T6 TacticsPitch getFitTone `if (!player) {`: exit 1, 1 failed | 52 passed — CAUGHT by "rings no token while the squad has not answered, though the familiarity has" (as expected)

Note: tests named "keeps the selection when a starter is given his best-fit slot", "…a bench player is promoted", "…a starter is moved to the bench" exist (TacticsTab.test.tsx:1036–1055) and pass under M1–M3, so they do not discriminate those sites.

**4. GATES**
- `npm run build`: exit 0 (25s), "✓ built in 2.06s".
- `npm run lint`: exit 0, "Checked 910 files in 1052ms. No fixes applied. Found 141 infos." (no errors/warnings).
- `npm run knip`: exit 0, 2 configuration hints only.
- `npm test`: exit 0 (310s). Test Files 365 passed (365); Tests 3376 passed (3376); Duration 309.40s.
