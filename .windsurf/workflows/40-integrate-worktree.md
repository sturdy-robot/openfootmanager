# integrate-worktree

Integrate an agent worktree/branch back into the main line safely.

## Steps

1. Identify the incoming branch and purpose:
   - branch name
   - domain

2. Pull/rebase strategy recommendation:
   - If branch is small and isolated: rebase onto main then merge.
   - If branch is large: merge main into branch, resolve, then merge.

3. Conflict prediction:
   - List likely conflicting files and mitigation steps.

4. Validation checklist:
   - rustfmt
   - clippy
   - tests
   - app builds (tauri/leptos if relevant)

5. Produce a merge-ready summary:
   - What changed
   - Risks
   - Post-merge follow-ups
