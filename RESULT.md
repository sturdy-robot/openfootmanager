Cloud run fam1f: PARTIAL

## Setup — worked
- apt-get update + install webkit2gtk-4.1/gtk-3/rsvg2/ayatana-appindicator3: exit 0
- Rust 1.95.0 (rust-toolchain.toml) installed via rustup; node v22.23.4
- `npm ci`: exit 0

## 1. Sources
`git fetch https://github.com/sturdy-robot/openfootmanager cloud-src/ofm-frontend/fam1b:fam` → HEAD `0b493fcefd39b3b33e4f3c4d9069c3713520b33c` ("test(familiarity): the projection's fixture players use the shared uniform attributes")

## 2. GREEN — FAILED, run stopped here
`npm exec --no -- vitest run src/hooks src/pages/Dashboard.test.tsx src/architecture.test.ts src/components/ui/PositionBadge` → exit 1
- `Test Files  1 failed | 24 passed (25)`
- `Tests  61 failed | 193 passed (254)`
- `Duration  21.78s`
- Failing file: `src/pages/Dashboard.test.tsx (61 tests | 61 failed)` — every test in the file.
- All 61 share one error (vitest `[1/61]`):
```
TypeError: (players ?? []).filter is not a function
 ❯ src/hooks/useFamiliarity.ts:52:8   (.filter((player) => player.team_id === clubId))
 ❯ useFamiliarityRevision src/hooks/useFamiliarity.ts:48:10
 ❯ Dashboard src/pages/Dashboard.tsx:119:31
```
i.e. `useFamiliarityRevision` receives a non-null, non-array `players` value in the Dashboard tests' state (`??` doesn't guard it).

Failing tests (`Dashboard > …`):
- explains a refused save in en
- keeps the window after a refused Save & Quit in en
- keeps the career after a refused Save & Exit in en
- explains a refused save in es
- keeps the window after a refused Save & Quit in es
- keeps the career after a refused Save & Exit in es
- explains a refused save in pt
- keeps the window after a refused Save & Quit in pt
- keeps the career after a refused Save & Exit in pt
- explains a refused save in fr
- keeps the window after a refused Save & Quit in fr
- keeps the career after a refused Save & Exit in fr
- explains a refused save in de
- keeps the window after a refused Save & Quit in de
- keeps the career after a refused Save & Exit in de
- explains a refused save in it
- keeps the window after a refused Save & Quit in it
- keeps the career after a refused Save & Exit in it
- explains a refused save in ru
- keeps the window after a refused Save & Quit in ru
- keeps the career after a refused Save & Exit in ru
- explains a refused save in pt-BR
- keeps the window after a refused Save & Quit in pt-BR
- keeps the career after a refused Save & Exit in pt-BR
- explains a refused save in zh-CN
- keeps the window after a refused Save & Quit in zh-CN
- keeps the career after a refused Save & Exit in zh-CN
- explains a refused save in cs
- keeps the window after a refused Save & Quit in cs
- keeps the career after a refused Save & Exit in cs
- explains a refused save in tr
- keeps the window after a refused Save & Quit in tr
- keeps the career after a refused Save & Exit in tr
- explains a refused save in id
- keeps the window after a refused Save & Quit in id
- keeps the career after a refused Save & Exit in id
- moves the focus into the Exit confirmation and back on Escape
- moves the focus to the page heading after a page chosen from the drawer
- saves the player's fold of the sidebar
- moves the focus to the heading when the drawer chooses the page already open
- doesn't move the focus on a later navigation from the page
- closes the window after a successful save
- honors an explicit quit without saving
- keeps the window after another save failure
- opens on Home by default
- opens on the tab it is given
- shows the club's competition in the sidebar
- uses the backend cash verdict instead of a false local crisis
- shows a finance crisis when the backend verdict is critical
- keeps the last verdict during a same-club refetch but drops it for a different club
- ignores stale finance responses after the game state changes
- offers the end of season from the backend flag, not the first competition
- keeps the season running while the backend says it is not over
- shows the localized named cup in the match confirmation modal
- supports search selection, profile switching, back-navigation, and tab switching
- names the open profile in the header, not the tab it was opened from
- calls a retired player's profile a player's in the header
- loads game state when the active save id fetch fails
- clears a stale active save id when a later refresh cannot load it
- sends_a_career_awaiting_a_club_to_team_selection
- keeps_an_unemployed_manager_on_the_dashboard

## 3. MUTANTS — not run (stopped at GREEN per job)
## 4. GATES — not run (stopped at GREEN per job)

No source changes were made.
