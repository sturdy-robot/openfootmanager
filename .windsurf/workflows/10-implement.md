# implement

Implement the planned changes safely. Prefer small diffs and deterministic behavior.

## Steps

1. If no plan exists in this session, call **/plan-task** and follow it.

2. Before edits:
   - Reprint the File Touch List.
   - Confirm no overlap with other agents (if overlap is likely, stop and propose a split).

3. Implement changes in the smallest possible increments:
   - Prefer introducing types & interfaces first.
   - Then implement logic.
   - Then wire integration points.

4. While implementing:
   - Do NOT invent APIs.
   - If unsure about a crate API, check docs in-repo or via available tooling; otherwise ask.
   - Keep logic out of UI layers.

5. Add tests alongside code:
   - Simulation: seeded RNG, deterministic assertions.
   - Data: schema validation tests, round-trip tests.
   - Core: rule unit tests.

6. Finish with an **Implementation Summary**:
   - Files changed
   - Behavior changes
   - Risks / TODOs (if any)

7. Then call **/review-self**.
