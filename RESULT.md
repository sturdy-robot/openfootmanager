Cloud run ofm-design-team-card-shots: DONE

**Setup:** worked. apt exit 0. AFTER log -3: 8520180c, d2596301, 4b643028; BEFORE worktree at upstream develop cd4da88e. `npm ci` exit 0 in both (236 packages; 14s AFTER, 13s BEFORE). Vite on 1473 (AFTER) and 1474 (BEFORE) answered.

**Shots:** pre-installed Playwright 1.63.0, DPR 1, script exit 0. Barlow Condensed font check true on all 13; no page errors. Paths: `shots/team-card/{before,after}-teams-{cards-light-1280,cards-light-960,cards-dark-1280,cards-dark-960,table-light-1280,table-dark-1280}.png` and `shots/team-card/after-teams-card-focus-dark-1280.png`.

**Deviations:**
- The harness can't save settings (`save_settings`), so Cards snapped back to Table in both trees. I answered that call in the browser; no repo code changed.
- Content scrolls inside an inner panel, so instead of full-page capture I grew the viewport to fit, same height per pair: cards 1280×1181, cards 960×1800 (AFTER loses its last 33px), table 1280×800.
- Focus: 3 Tabs reached "Glasgow FC"; the ring shows on the dark kit wash.

**Pairs:**
- **Card:**
  - BEFORE: gradient header, "POSITION #1" box, five stats, footer.
  - AFTER: kit stripe, soft washed header (hatched for some kits), crest, big plain position number, W/D/L/Pts/Avg OVR band, Squad and Rep. Value, Est. and formation gone; city only.
- **Accordion:** same; AFTER's Europe header is filled in light too.
- **Search:** AFTER's box is about 4px shorter.
- **Readability:** BEFORE light has white city text on pale gradients, hard to read. AFTER reads fine in both themes.
- **960:** BEFORE has two columns with truncated names, which hide "Your Team". AFTER has one column. Neither tree scrolls sideways.
- **"Your Team":** visible in every other shot.

**New AFTER issue:** the hidden "Position" label (`sr-only`, `TeamCard.tsx:44`) escapes the card root (`EntityCard.tsx:59`, no `relative`). The page grows to 852px at 1280×800 and 1644px at 960×640, so the whole shell can scroll.

**Teardown:** pkill exit 144 (killed its own shell); both ports returned 000.

PNGs and RESULT.md are in one commit.
