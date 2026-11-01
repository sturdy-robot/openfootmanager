Cloud run ofm-design-picker-a11y-1: DONE

**Setup:** worked. apt install exit 0. Rust 1.95.0 (pinned). `npm ci` exit 0. Biome 2.5.5.

**1.** HEAD `5577cddf3f5da66334b73a2b01b9d5ce2665c7dd`.

**2. GREEN:** picker.test.tsx exit 0, Tests 18 passed (18), 4.14s. All passed:
- order picker shows: lists the order with the line after the kickers, and previews it on the sheet; draws no line when everyone kicks; shows the taker badge, shooting, composure and condition on each row; skips the picker when the setting is on; goes straight to the kicks when spectating / when the user's side has no order / once a kick has been taken; takes no kick while the picker shows
- keyboard: moves the focus between players with the arrow keys; lifts, moves and drops a player, announcing each step; swaps who kicks when a player is moved across the line; puts a lifted player back where she started on Escape; moves a player by dragging his row onto another's; restores the auto order
- starting: starts with the auto order without sending it; sends a changed order, then starts the kicks; sends the away side's order for an away manager; shows a refused order and stays on the picker

**3. RED** (restored):
- A `sr-only`→`hidden`: exit 1, 1 failed | 17 passed (18). The failing test is "lists the order with the line after the kickers…" at `toHaveClass("sr-only")` (:219). CAUGHT.
- B delete `title={name}`: exit 1, 1 failed | 17 passed (18). The same test fails at `toHaveAttribute("title","Alice")` (:220). CAUGHT.

**4. Gates:**
- tsc --noEmit: exit 0 (21s)
- lint: exit 0, 148 infos, no errors or warnings
- format:check: exit 0, 822 files
- knip: exit 0, 2 config hints only
- npm test: exit 0, Test Files 327 passed (327), Tests 3021 passed (3021), 247.38s

No code changed.
