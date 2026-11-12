Cloud run rename8: DONE

Setup: worked (apt libs installed; Rust toolchain built the page fixture; `npm ci` ok, `node scripts/ensure-page-fixture.mjs` exit 0, wrote fixture.generated.ts 665 KB).
1. `git log --oneline -2` on `job`:
   - ea2eed65 test(tactics): the backdrop case presses the backdrop the way the dialog needs
   - 72b91f71 test(tactics): the rename hook tests use one `t` per render, so a stale draft name is not repaired
2. `tsc --noEmit`: exit 0, no output.
   `vitest run src/components/tactics`: exit 0, Test Files 20 passed (20), Tests 257 passed (257), 71.48s. No failures.
   `TacticsCommandBar.test.tsx` x3: exit 0 each time, Tests 38 passed (38) (5.07s, 4.66s, 4.49s).
3. Reds (file restored after each; `git status` clean):
   (a) `onClose={onClose}`: exit 1, Tests 2 failed | 36 passed (38). Failed: "stays open on Escape while the save is out, and closes once it accepts the name" and "stays open on a backdrop click while the save is out". "closes on a backdrop click when no save is out" passed. As expected.
   (b) `dismissOnBackdrop` removed: exit 1, Tests 1 failed | 37 passed (38). Failed only: "closes on a backdrop click when no save is out". As expected.
4. `npm run lint`: exit 0 ("Checked 1083 files... Found 159 infos", no errors).
   `npm run format:check`: exit 0 ("Checked 1081 files... No fixes applied").
   `npm test`: exit 0, Test Files 443 passed (443), Tests 4307 passed (4307), 459.15s. No failures.
No tracked file changed.
