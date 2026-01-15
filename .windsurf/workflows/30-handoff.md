# handoff

Prepare a clean handoff message for the coordinator/merger.

## Steps

1. Provide a short summary:
   - What you built/changed
   - Why it exists

2. Provide a **Change List**:
   - Bullet list by file, with 1-line description per file.

3. Provide **How to validate**:
   - Exact commands to run (fmt/clippy/test) appropriate to Rust workspace
   - Mention any feature flags or env requirements if relevant

4. Provide **Integration Notes**:
   - Any expected merge conflicts
   - Any follow-up tasks needed
   - Any migration steps for other crates

5. Provide **Commit suggestion**:
   - Proposed conventional-ish message (e.g., `sim: add seeded markov transition table`)
