Cloud run ofm-profile-1429d: DONE
Setup OK: apt libs installed, Rust 1.95.0 (pinned), `npm ci` exit 0, page fixture generated. Branch jc = c6e2994b.
`git log --oneline -4 --first-parent`: c6e2994b, da1945ba, 27d3973e, e3784998.
`wc -l`: namesCases.ts 268, newsCases.ts 577, test.ts 435, types.ts 33 (total 1313).

1. da1945ba, unchanged golden, CI=true vitest backendTextGolden.test.ts + countryNames.test.ts: exit 0, 2 files passed, 648 passed (648). The move is pure.
2. c6e2994b, same command: exit 1, 4 failed | 646 passed (650). Failing:
 - the backend text golden file > is what the frontend resolver writes for the cases it lists (whole-file snapshot)
 - ... > a nationality param that is an English country name that is not the official one reads as the country's name
 - ... > a nationality param that is an English country name in lower case reads as the country's name
 - ... > a country param reads as the country's name, as a nationality param does
 The old case "an English country name" is gone from namesCases.ts, but the stale entry (golden.json:1253) is still in the golden file.
3. Regenerate: rm + run1 exit 1 (76 per-case rows failed, as expected); run2 exit 0 (78 passed); CI=true both files exit 0, 650 passed (650). Committed only the golden as GOLD=1f11ff9d: 1 file, +43/-5 (48 lines).
4. Expected text of the new cases (all correct):
 - Russia (nationality): body "J. Doe has been called up to the Russian Federation national team for an upcoming international window. ..." -> "Russian Federation": yes.
 - germany (nationality): "... called up to the Germany national team ..." -> "Germany": yes.
 - country param BR: body `Unknown country "Brazil".` -> yes.
5. Rust, GOLD on c6e2994b, `cargo test --lib --features mcp ...the_rust_resolver_writes_the_text_the_frontend_resolver_wrote`: exit 0, 1 passed (build 6m22s).
6. Mutations (each restored with git checkout):
 R1 (names.get -> None): CAUGHT. 2 mismatches: the "not the official one" case (Rust "Russia" vs golden "Russian Federation") and the "in lower case" case (Rust "germany" vs "Germany").
 R2 (COUNTRY_PARAMS -> nationality, nationality): CAUGHT. 1 mismatch: the country-param case (Rust `Unknown country "BR".` vs golden `Unknown country "Brazil".`).
 None survive. The first run of each used a log filter that hid the names, so I re-ran both for the exact text.
7. At c6e2994b + GOLD: `CI=true vitest run` exit 0, Test Files 458 passed (458), Tests 5041 passed (5041). `tsc --noEmit -p .` exit 0, no output. `npm run lint` (biome lint --error-on-warnings) exit 0: "Checked 1112 files ... No fixes applied. Found 156 infos."
8. Cherry-picking GOLD onto the start commit ae5e94e7 conflicted (the golden file does not exist there), so I took the golden file as GOLD wrote it. `git status --short` was empty after the mutations.
