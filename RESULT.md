Cloud run ofm-profile-ds-port-1: DONE

Setup: apt libs installed; Rust 1.95.0 installed (first rustup attempt crashed, retry worked); `npm ci` in both trees; `ensure-page-fixture.mjs` exit 0 in both (cargo example built).
- BEFORE `5d261e45 feat(dev): the page harness shows an injured and a loaned-out player` / `3365b0a7 test(dev): ... banners (red)`
- AFTER `4534d82c docs(design): the harness's injured and loaned profile states` / `edc9099a Merge branch 'dev/harness-injured-loaned' into refactor/profile-ds-port`

1. AFTER `tsc --noEmit`: exit 0. vitest (named dirs): 70 files, 786 tests passed, 0 failures.
2. Vite AFTER 1473, BEFORE 1474: both served.
3. Shots (1280×800, DSF 1, fonts.check Barlow Condensed 700 = true, 2.5 s wait) in `shots/ds-port/{before,after}-<name>-<light|dark>.png`. Scout clip = name card 971×114 at (284,100). Harness did not answer `preview_contract_termination` (dialog shows "Loading…" + red error); renewal inputs showed.

| pair | px >0 / >16 (light) | verdict |
|---|---|---|
| banner-injured | 0.342% / 0.111% | same look, slightly different shades (icon tile) |
| banner-loaned | 0.473% / 0.298% | same look, slightly different shades (icon tile greener) |
| scout-rival | 1.866% / 1.826% | different shade: BEFORE dim teal button, AFTER brighter mint; layout same |
| stats-career | 33.032% / 0.136% | same look, tile fill shade shift (max channel diff 31) |
| dialog-renewal | 3.488% / 1.096% | REAL difference: dialog 4 px shorter (320→316 px light, 322→318 dark), content ~2 px tighter top and bottom; width identical |
| dialog-termination | 3.668% / 1.214% | REAL difference: 4 px shorter (250→246); disabled "Terminate Contract" was red text, now grey |

Dark: same pattern (banner 0.342/0.354%, scout 1.814%, stats 32.164%, renewal 5.209%, termination 2.820%).

4. `page-layout-check.mjs http://localhost:1420`: exit 0, "51 of 51 cases pass"; all injured/loaned cases ok. Vite stopped.
5. `npm run lint` exit 0: 153 infos, 0 errors; `biome lint src/components/playerProfile`: none. `format:check` exit 0 (969 files). `knip` exit 0 (2 config hints). `npm test` exit 0: 392 files, 3762 tests passed. `npm run build` exit 0.
