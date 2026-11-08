Cloud run w1-1: PARTIAL

Setup: worked. apt install (webkit2gtk-4.1, gtk-3, rsvg2, appindicator) exit 0; rust pinned 1.95.0 (rust-toolchain.toml); `npm ci` exit 0 (10.2s).
Source: w1 fetched from sturdy-robot/openfootmanager cloud-src/ofm-frontend/w1. HEAD = 44f1145037b441ce596145c2676fdde57598cd2d "test(tactics): a later write that saves clears the alert".

2. GREEN `vitest run src/components/tactics`: exit 1. Test Files 1 failed | 8 passed (9); Tests 76 passed (76); 17.3s.
 FAIL src/components/tactics/TacticsTab.test.tsx (suite failed to load, 0 tests ran): `[vitest] No "initReactI18next" export is defined on the "react-i18next" mock` (src/i18n/index.ts:89 via src/utils/backendI18n.ts:1).

3. MUTANTS (TacticsTab.preset.test.tsx + useTacticsLibrary.test.ts; each reverted with git checkout -- src):
 a. delete useTacticsLineup.ts:257 onWriteError(error): exit 1, 2 failed | 31 passed (33):
   - TacticsTab.preset > tells the manager that a preset did not save
   - TacticsTab.preset > clears the alert once a later write saves
 b. delete useTacticsLibrary.ts:276 onWriteError(error): exit 1, 2 failed | 31 passed (33):
   - useTacticsLibrary (#1189) > keeps the current setup when the backend refuses to apply a saved tactic
   - TacticsTab.preset > tells the manager that a saved tactic did not save
 c. TacticsTab.tsx:37 setWriteError(null) -> void 0: exit 1, 1 failed | 32 passed (33). Expected none; one test DID fail:
   - TacticsTab.preset > clears the alert once a later write saves

4. GATES
 - npm run build: exit 0 (3m38.8s, "✓ built in 2.11s").
 - npm run lint: exit 0 (biome, 919 files, 141 infos, no errors).
 - npm run knip: exit 0 (2 configuration hints only: tailwindcss in ignoreDependencies; .css extension).
 - npm test (full): exit 1. Test Files 1 failed | 368 passed (369); Tests 3359 passed (3359); 317.48s. Only failure: the same TacticsTab.test.tsx suite load error (initReactI18next mock).

Delivery: branch cloud-run/w1-1 from ae5e94e7c56fd180c0873c07b9d51d42fc54c577 + this commit only. Note the w1 source commits are not in that branch.
