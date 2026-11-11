Cloud run ofm-profile-p4-3: DONE

Setup: apt libs OK; Rust 1.95.0 present; `npm ci` exit 0. Source `feat/profile-attributes-tab`, `git log --oneline -3`: 1c4af751 fix(dev): the harness's key attributes are the game's three per position, generated from Rust / d468d9d9 test(profile): the tab's tests assert the painted dots and highlight and literal averages; weight_importance is pub(crate) / ff3d4143 feat(profile): the Attributes tab drops its explanatory line, says which rows are key, and stacks in a narrow card.
Fixture: `node scripts/ensure-page-fixture.mjs` exit 0, wrote fixture.generated.ts (662 KB); it contains `positionKeyAttributes`.
tsc --noEmit: exit 0.
Step-2 vitest: 69 files passed, 778 tests passed, 0 failures.
Layout check (vite 1420): exit 0, "45 of 45 cases pass", no failing case.
lint: exit 0, 153 infos, nothing in src/components/playerProfile or src/dev. format:check: exit 0 (967 files). knip: exit 0 (2 config hints only). `npm test`: 391 files / 3736 tests passed, 0 failures. build: exit 0.

Shots: 18 PNGs (16 + 2 bottoms) in `shots/profile-p4-3/` (attrs-<own|rival|scouted|keeper>-<light|dark>-<1280|960>.png, attrs-own-light-960-bottom.png, attrs-keeper-light-960-bottom.png). Every shot: font check true, scrollHeight=innerHeight, scrollWidth=innerWidth, unanswered [], pastEdge []. At 960 the workspace scrolls internally (e.g. own 1032 vs 565 visible; hence the 2 bottom shots).

Looking at them:
- 1280: three columns (Technical / Mental / Physical), each with an "average N" header; no header hint line. Nothing clipped or overlapping.
- 960: columns stack to one column (Technical, then Mental, then Physical). Names are whole ("Aggression", "Leadership"), no one-letter cuts: that is fixed. No sideways scroll.
- Own (right back): highlighted rows are Tackling, Defending, Positioning, as expected. Dots: Tackling 3/3, Defending 3/3, Positioning 2/3 (not all full; non-key Pace and Stamina show 3/3 and Passing 2/3, so full dots are not limited to key rows). Value colours: grey low, blue mid, green, amber/gold high. Footer: "Coaches' opinion" (Could be a useful squad player, Potential 75–81, Fairly sure) and "Scouted –".
- Keeper: first column is "Goalkeeper" with two rows, Handling (3 dots) and Reflexes (3 dots), both highlighted; Positioning highlighted in Mental (2 dots).
- Rival: footer has only "Scouted –", no opinion.
- Scouted: footer "Scout's opinion" with "Scouted on May 12, 2031" and "Scouted May 12, 2031" at right.
- Dark theme readable in all. Technical and Physical columns end shorter than Mental, leaving empty space. Nothing looks unfinished.
