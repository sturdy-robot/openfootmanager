Cloud run u8-1: PARTIAL

Setup: worked. apt libs installed (exit 0); `npm ci` exit 0. Rust toolchain (1.95.0 pinned) not needed for this frontend-only job, not installed.
Sources: fetched cloud-src/ofm-frontend/u8 from origin (fork); `git checkout u8`. HEAD = 7f7c5b66b1f9d3d6bbacd190e36c03e93c251210.

RED (isHighPriority mutated to `priority === "High"`): vitest exit 1, Test Files 2 failed, Tests 2 failed | 29 passed (31).
- FAIL messagePriority.test.ts > needsAttention > Urgent needs attention: true (expected false to be true)
- FAIL advanceRecap.test.ts > treats an Urgent inbox item as at least High: it is listed and it pauses (expected [] to deeply equal ['urgent'])
Both expected tests failed. Reverted with `git checkout -- src` (tree clean).

GREEN `vitest run src/components/dashboard`: exit 0, Test Files 15 passed (15), Tests 162 passed (162), no failures.

GATES (on unmodified u8):
- npm run build: exit 2. src/components/dashboard/advanceRecap.ts(2,30): error TS6196: 'MessageData' is declared but never used.
- npm run lint: exit 1. Same unused import (advanceRecap.ts line 2) reported as the 1 warning (Found 1 warning, 141 infos); "Some warnings were emitted".
- npm run knip: exit 0 (only 2 config hints: tailwindcss ignoreDependencies, .css extension).
- npm test (full): exit 0. Test Files 369 passed (369), Tests 3414 passed (3414), Duration 428.20s.

Verdict: behaviour tests are discriminating and green, but build and lint are red on u8 because of an unused `MessageData` import in advanceRecap.ts.
