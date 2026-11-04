# Tactics tab audit screenshots

Today's Tactics tab, from the page harness (`/style-guide.html?page=tactics`). Job tip fc2ef4d5,
plus two answers added to `fixtureAnswers.ts` in the working tree only, never committed:
`get_tactics_blueprint_status` → `{ modified: false }`, and `auto_select_set_pieces` → all four
takers `null`. Headless Chromium, deviceScaleFactor 1.

| File | What it shows |
|------|---------------|
| `a-1280x800-light.png` | 1280×800, light theme |
| `b-1280x800-dark.png` | 1280×800, `&theme=dark` |
| `c-960x640-light.png` | 960×640, light |
| `d-1920x1080-light.png` | 1920×1080, light |
| `e-960x640-xlarge-de-light.png` | 960×640, `&scale=xlarge&lang=de`, light |
| `f-1280-full-height-light.png` | 1280 wide, the whole tab at once. The document does not scroll; the dashboard's content scroller (`div.min-h-0.flex-1.overflow-auto`, scrollHeight 1287 / clientHeight 725) does. Captured by growing the window to 1280×1362 so the scroller shows all 1287px. Side effect: the taller window shows the whole sidebar nav, and the sidebar draws 17px narrower (239 vs 256px), so the content columns sit slightly left of their place in `a` |
| `g-after-click-first-list-player.png` | 1280×800 after clicking the first player in the list (Starting XI, "GK 1 Martins 67"): the row turns highlighted and a "Clear" link appears in the pitch header. No inspector panel opens in view |
| `h-right-click-list-player-context-menu.png` | 1280×800 after right-clicking that same list row: the context menu (Select for swap, Move to bench, Make captain, Make vice-captain, Set penalties, Set free kicks, Set corners, View profile) |
| `i-after-40-tabs.png` | 1280×800 after 40 Tab presses from the top of the document (focus on "LM 8 Gonzalez 81" in the list) |
| `j-right-panel-scrolled-to-bottom.png` | 1280×800, the content scroller scrolled until the right-hand column's bottom is in view (scrollTop 538 of 562): Team roles (penalty, free kick, corner) and the Phase blueprint dials. The right-hand column has no scroller of its own |
