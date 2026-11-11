Cloud run ofm-profile-p3-2: DONE

Setup: apt libs OK; Rust 1.95.0 pinned; `npm ci` OK (0). Fixture `node scripts/ensure-page-fixture.mjs` exit 0 (wrote fixture.generated.ts, 659 KB, positionWeights incl.).
Source `job` = feat/profile-overview: 91c9afa5 fix(profile): the Overview's cards are positioned… / ce2268fa test(profile)… / d3dcb79c Merge upstream/develop.

2. `tsc --noEmit` exit 0. vitest (named dirs/files): Test Files 70 passed (70), Tests 782 passed (782), 0 failures.

4. Shots (1280×800 / 960×640, dpr 1, fonts check true, 2.5 s wait) in `shots/profile-p3-2/`: overview-{own,rival,scouted}-{light,dark}-{1280,960}.png (12) + overview-own-light-1280-bottom.png, overview-own-light-960-bottom.png, overview-own-dark-960-bottom.png.
All 12: scrollWidth=innerWidth, scrollHeight=innerHeight (800/800, 640/640), unanswered [], pastEdge []. The page no longer scrolls. The workspace scrolls inside: own 1280 792/725 (light & dark); own 960 1233/565; rival 960 1059/565; scouted 960 1075/565.
Seen:
- 1280: three columns: Now+Details | Previous matches+Season | Attributes+Traits. 960: two columns (Now+Details | Previous matches+Season), Attributes and Traits full width below.
- Radar: eight fixed axes, SHORT labels (PAC SHO DRI PAS VIS COM STR AER) as page text with values, not full names. No overlap, none cut at either width; the 1280 clipped label is gone. Key attributes are bold.
- Own: Now = condition bar 91, morale 47%, form L L W L L, role dropdown. Details: born, squad role, contract + STABLE, value, wage, Coaches' opinion (below the fold at 1280). Previous matches: 5 rows. Season: zeros, avg 0.0. Key for a Right Back: Teamwork 94, Strength 91, Dribbling 89. Traits: Dribbler, Team player.
- Rival: Condition "–", Morale "–". Details card has empty space at the bottom (wage "–").
- Scouted: Condition/Morale "–", "No recent match data", radar with values, Scout's opinion, wage "about €9,700/wk".
- Looks off: "1 goals", "1 assists" (no plural); fixed-width columns put Coaches' opinion below the fold at 1280.

5. `page-layout-check.mjs` http://localhost:1420: exit 0, 42 of 42 cases pass (was 36/42); all six profile 960×640 cases ok.

6. `npm run lint` exit 1: 1 error, 1 warning, 153 infos. Both are in src/components/playerProfile/overview/PlayerProfileOverview.tsx: line 283 `lint/a11y/noRedundantRoles` (role="list" on ul) and line 281 `suppressions/unused` (the biome-ignore comment sits in a JSX comment and doesn't suppress). Nothing in src/dev.
`format:check` exit 0 (969 files). `knip` exit 0 (2 config hints). `npm test` exit 0: 392 files, 3741 tests passed. `npm run build` exit 0.
