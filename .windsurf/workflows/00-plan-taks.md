# plan-task

Create a safe, merge-friendly plan for a single task. Output MUST be short and actionable.

## Steps

1. Restate the task in 1-2 lines (no fluff).

2. Identify the domain:
   - core / simulation / data / frontend / testing / architecture

3. Produce a **File Touch List**:
   - List the exact files you expect to edit or create.
   - If you are unsure, list directories and the file patterns.
   - If any file overlaps with another agent's work, STOP and propose a split.

4. Constraints checklist (must answer YES/NO):
   - Compiles?
   - Type-safe domain model?
   - No invented APIs?
   - Deterministic simulation paths (if applicable)?
   - Tests included or explicitly deferred with reason?

5. Plan (max 8 bullets):
   - Bullet steps that map to commits.
   - Mention any migration/refactor considerations.

6. Finish with:
   - "Ready to implement." OR
   - "Needs clarification: <question(s)>"
