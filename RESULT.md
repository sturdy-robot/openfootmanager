Cloud run m2-1: DONE

Setup: apt-get update + install of libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev → exit 0 (Rust not needed for this frontend-only job). Node v22.23.4, npm 10.9.9. `npm ci` → exit 0. vitest 4.1.11, Biome 2.5.5.

1. Sources: fetched sturdy-robot/openfootmanager `cloud-src/ofm-frontend/m2` → branch `fam`.
   HEAD = `3d6944f708e0ece183d0e8626452e6d214deb9b5` "Merge feat/familiarity-projection into feat/familiarity-squad".

2. GREEN: `npm exec --no -- vitest run src/hooks src/components/squad src/components/tactics src/components/playerProfile src/components/match src/components/home src/pages/Dashboard.test.tsx src/i18n` → exit 1 (111s)
   - Test Files  1 failed | 110 passed (111)
   - Tests  5 failed | 991 passed (996), 0 skipped
   - Duration  109.93s

   Every failing test (all in src/components/squad/SquadTab.test.tsx > SquadTab):
   1. renders only the full roster table and not the moved tactics controls — `TestingLibraryElementError: Unable to find an element with the text: squad.coverageTitle.`
   2. claims no fit before the familiarity has loaded — `AssertionError: expected <p role="status" …(1)></p> to be null`
   3. counts natural fits from the backend's familiarity, and claims no count before it arrives — `TestingLibraryElementError: Unable to find an element with the text: /^[1-9]\d* squad\.naturalFit$/.`
   4. offers the needs-cover filter only once the position table has loaded — `TestingLibraryElementError: Unable to find an accessible element with the role "option" and name "squad.needsCover"`
   5. claims no coverage until the familiarity has loaded — `TestingLibraryElementError: Unable to find an element with the text: squad.coverageTitle.`

3. GATES:
   - `npm run build` (tsc && vite build) → exit 0, 25s; 2835 modules transformed, "✓ built in 1.96s".
   - `npm run lint` (biome lint --error-on-warnings) → exit 0; "Checked 890 files in 859ms", "Found 147 infos." (0 warnings, 0 errors).
   - `npm run knip` → exit 0; no unused findings, only 2 configuration hints (tailwindcss in ignoreDependencies removable; .css compiled extension excluded).

No code was changed; working tree clean after the run.
