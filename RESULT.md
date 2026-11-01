Cloud run ofm-design-team-card-shots-2: DONE

**Setup: worked.** apt install exit 0; Rust 1.95.0 installed from rust-toolchain.toml; `npm ci` exit 0 in both trees (separate installs, no symlink). Result branch is based on ae5e94e7, the commit the session started on.

**1. AFTER** `job` @ `a83ae4e0 test(harness): the layout check measures the Teams cards too` / `0def0d3e Merge … into feat/team-card` / `d3f7ac96 Merge PR #1135`.
**2. BEFORE** upstream develop = `d3f7ac96c8247e29bbde0ab1f4dcf9a8a482d069` (#1135 merge).
**3.** Vite on 1473 (after) and 1474 (before): both served style-guide.html.

**4. Shots** in `shots/team-card-2/` (13): `{before,after}-teams-cards-{light,dark}-{1280,960}.png`, `{before,after}-teams-table-{light,dark}-1280.png`, `after-teams-card-focus-dark-1280.png`. Font check true every time. scrollHeight = innerHeight in all 13 (800/800 at 1280, 640/640 at 960). scrollWidth = innerWidth (no sideways scroll) in both trees at 960.
- Cards: BEFORE is the old gradient card: caps name, boxed "POSITION #n", a 5-cell strip (Squad/Avg OVR/Rep/Value/Pts), and a footer (formation, Est., W-D-L). AFTER is the EntityCard shell: kit-coloured left stripe and tint, a large plain position number, a W/D/L/Pts/Avg OVR band, and Squad and Rep facts. AFTER drops Value, formation and Est.
- At 960, BEFORE stays in 2 columns: names are cut off ("GLASGOW FC…", "EDINBURGH UNI…"), the city wraps, and the footer runs together ("Est. 1885 0W 0D 0L"). AFTER switches to 1 column with nothing cut off.
- Accordion: BEFORE light has no fill behind "Europe". AFTER has a surface strip in both themes, and the rows sit about 4px higher.
- Search box: about 4px shorter in AFTER. Otherwise it looks the same.
- Both themes are readable in both trees. In the table view the two trees look the same apart from that 4px shift.
- "Your Team" badge is present in all shots. It is hidden by the cut-off name in before-960.
- Focus: 32 Tabs to "Glasgow FC". A focus ring shows around the name, scrollY 0.

**5. Layout check** (1473): exit 0, "27 of 27 cases pass" (all `ok`; DPR 1; fonts Inter 400–700, Barlow Condensed 600/700, Fira Sans Extra Condensed 600/700).
**6. Green:** 3 files, 67 tests passed.
**7. Gates:** tsc exit 0. lint exit 0: "Found 147 infos", none in src/components/teams (4 files clean). format:check exit 0 (878 files). knip exit 0. Its full output is just 2 configuration hints: `tailwindcss` (Remove from ignoreDependencies) and `.css` (Compiled extension excluded). npm test exit 0: 353 files, 3248 tests passed, 0 failed, 278.30s. build exit 0 ("built in 1.86s"). audit:i18n exit 0: 0 candidates in src/components/teams.

No code was changed.
