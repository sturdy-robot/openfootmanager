Cloud run g1-1: DONE

**Setup worked.** apt-get update + install webkit/gtk/rsvg/appindicator: exit 0. Rust 1.95.0 (rust-toolchain.toml) installed by rustup. Node v22.23.4, npm 10.9.9. `npm ci`: exit 0. Biome 2.5.5 (the real one, not the 0.3.3 impostor).

**1. Sources.** fetched `cloud-src/ofm-frontend/g1` → `g1`. HEAD `4176fcbee47aec8a7ae3d2c1cd7c0fb66fd10808` "test(i18n): a test that renders a key no locale has fails, naming the key".

**2. `vitest run src/i18n/missingKeys.test.ts`**: exit 0. Test Files 1 passed (1), Tests 2 passed (2).

**3. RED** (deleted `src/i18n/index.ts:105` `reportMissingKey(languages[0] ?? "", key);`): exit 1. Tests 2 failed (2):
- `reports a key no locale has and stays quiet for one that exists`: expected [] to deeply equal [ 'be.msg.noSuchMessage.subject' ]
- `reports a missing key even when a default value hides it`: expected [] to deeply equal [ 'be.msg.noSuchMessage.body' ]

Restored with `git checkout -- src`. The tree was clean afterwards.

**4. FULL `npm test`**: exit 1. Test Files 6 failed | 363 passed (369). Tests 24 failed | 3376 passed (3400). Duration 273.68s (wall-clock 7m28s). 23 failures are the missing-key gate. 1 is not (marked †).

Key lists are copied verbatim. The gate joins keys with `", "`, and some keys contain commas themselves, so I had to split some lists by hand (see the distinct-key table).

`src/utils/backendI18n.test.ts` (14)
- resolveAction > does not re-normalize already formatted compact money params from resolveMessage: `€1.8M`
- resolveAction > falls back to raw label when key is not found in translations: `nonexistent.key`
- resolveMessage > localizes legacy delegated renewal messages without persisted i18n keys: `O estafe deles quer cerca de €25K/semana por 3 anos, acima dos limites da delegação., Você me disse para ainda não reabrir as conversas contratuais.`
- resolveNewsArticle > localizes transfer roundup articles through backend keys: `[{"player":"Adam Smith","fromTeam":"Alpha FC","toTeam":"Beta FC","fee":"€1.8M"}],   Adam Smith: de Alpha FC para Beta FC (€1.8M)`
- resolveNewsArticle > converts transfer roundup fees to the selected currency: `[{"player":"Adam Smith","fromTeam":"Alpha FC","toTeam":"Beta FC","fee":"€1.8M"}],   Adam Smith: Alpha FC -> Beta FC (£1.55M)`
- resolveNewsArticle > writes the scorers into a competition match report: `Alice (10. Min., Alpha FC), ` (ends with an empty key)
- resolveNewsArticle > localizes press conference articles from stored quote metadata: `"match.press.result.responses.win.humble.text","fallback"."The players worked hard. We prepared well and executed the game plan.","params".{}},{"key"."match.press.ahead.responses.focused.text","fallback"."First recovery, then preparation. We go one game at a time.","params".{}}], Os jogadores trabalharam duro. Nos preparamos bem e executamos o plano de jogo., • "Os jogadores trabalharam duro. Nos preparamos bem e executamos o plano de jogo."`
- resolveNewsArticle > localizes standings entries through backend keys: `  1. Alpha FC — 12 pts (SG: +5)`
- resolveNewsArticle > localizes roundup result lines and biggest winner copy through backend keys: ` O Alpha FC registrou a maior vitória do dia.`
- resolveNewsArticle > localizes preseason digest result lines and unbeaten copy through backend keys: `` (the empty key "")
- resolveNewsArticle > includes every unbeaten team when more than two clubs remain unbeaten: `` (the empty key "")
- resolveBoardObjective > falls back to raw description for unknown objective types: `boardObjectives.objective.CustomObjective`
- the weekly wage bill in the over-budget message > still reads a message saved with the old annualWages name and a formatted amount: `€1.7K, €1.5K`
- a compact string already in a saved message > keeps the figure it carries instead of rounding it to one decimal: `€1.25M`

`src/utils/errorMessage.test.ts` (1)
- resolveTranslatedErrorMessage > leaves a message that is not a known key as it was: `be.error.noSuchKey`

`src/components/dashboard/advanceRecap.test.ts` (2)
- advanceRecap > keeps key news but drops routine and transfer-duplicate categories: `news.injury`
- advanceRecap > draws a press-conference headline with the quote the resolver builds: `"match.press.result.responses.win.humble.text","fallback"."","params".{}}], The players worked hard. We prepared well and executed the game plan., • "The players worked hard. We prepared well and executed the game plan."`

`src/components/inbox/InboxTab.test.tsx` (3)
- InboxTab > renders delegated renewal report details with settings-aware money formatting: `Their camp want around £26K/wk for 4 years, which is beyond the delegation limits., They are not willing to commit through me under the current relationship and contract situation.`
- InboxTab > formats delegated renewal money values only once in dot-separated locales: `Board wage policy blocks this renewal. Keep annual wages near 24.000 € while we recover.`
- † InboxTab > asks the backend once while a response is in flight: **not a missing-key failure.** It fails with `TestingLibraryElementError: Unable to find an element with the text: No renewal.` It also fails when run alone with `-t`. It fails the same way on the parent commit `0b57b623` ("fix(inbox): a response is sent once while its answer is on its way"), which comes before the gate. So it was already failing and is not caused by the gate.

`src/components/match/commentary.test.ts` (1)
- getCommentary > falls back from a missing variant key to the base key: `match.commentary.ShotBlocked.speculative.lines`

`src/dev/styleGuide/StyleGuide.test.tsx` (3)
- style guide > sets each type specimen with its role class: `common.injuries.Hamstring strain, common.injuries.Metatarsal fracture`
- style guide > renders every section without a backend: same
- style guide > opens the dialog when the URL asks for it: same

**Distinct keys (count of tests that hit each one):**

| Tests | Key |
|---|---|
| 3 | `common.injuries.Hamstring strain` |
| 3 | `common.injuries.Metatarsal fracture` |
| 3 | `""` (the empty key) |
| 2 | `[{"player":"Adam Smith","fromTeam":"Alpha FC","toTeam":"Beta FC","fee":"€1.8M"}]` |
| 1 each | `€1.8M` · `nonexistent.key` · `O estafe deles quer cerca de €25K/semana por 3 anos, acima dos limites da delegação.` · `Você me disse para ainda não reabrir as conversas contratuais.` · `  Adam Smith: de Alpha FC para Beta FC (€1.8M)` · `  Adam Smith: Alpha FC -> Beta FC (£1.55M)` · `Alice (10. Min., Alpha FC)` · the press-quote JSON blob starting `"match.press.result.responses.win.humble.text","fallback"."The players…` · the second blob `"match.press.result.responses.win.humble.text","fallback"."","params".{}}]` · `Os jogadores trabalharam duro. Nos preparamos bem e executamos o plano de jogo.` · `• "Os jogadores trabalharam duro. …jogo."` · `The players worked hard. We prepared well and executed the game plan.` · `• "The players worked hard. …game plan."` · `  1. Alpha FC — 12 pts (SG: +5)` · ` O Alpha FC registrou a maior vitória do dia.` · `boardObjectives.objective.CustomObjective` · `€1.7K` · `€1.5K` · `€1.25M` · `be.error.noSuchKey` · `news.injury` · `match.commentary.ShotBlocked.speculative.lines` · `Their camp want around £26K/wk for 4 years, which is beyond the delegation limits.` · `They are not willing to commit through me under the current relationship and contract situation.` · `Board wage policy blocks this renewal. Keep annual wages near 24.000 € while we recover.` |

Observations:
- Most of these "keys" are prose, money strings or JSON that was passed through `t()`, or an empty key.
- Four tests look up a missing key on purpose (nonexistent.key, CustomObjective, noSuchKey, the ShotBlocked variant fallback).
- In the JSON blobs, `:` shows up as `.`, and the leading `[{"key"` is missing. That looks like i18next splitting on its `:` namespace separator.

**5. GATES**
- `npm run build`: exit 0 (tsc clean, built in 1.87s, 22.8s wall-clock).
- `npm run lint`: exit 0. "Checked 919 files in 987ms. No fixes applied. Found 141 infos."
- `npm run knip`: exit 0. Only 2 configuration hints: `tailwindcss` "Remove from ignoreDependencies", and `.css` "Compiled extension excluded by project".
