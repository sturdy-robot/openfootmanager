# review-self

Perform a strict self-review before handoff.

## Steps

1. Re-open changed files and check:
   - Naming clarity
   - No unnecessary comments
   - Small, cohesive functions
   - No hidden global state
   - Errors handled intentionally (no silent ignores)

2. Validate constraints:
   - "No invented APIs" compliance
   - Rust stable only
   - Determinism where expected
   - Refactor-friendly boundaries

3. Testing review:
   - Are tests deterministic?
   - Do tests cover the critical paths?
   - Any missing edge cases?

4. If problems found:
   - Fix them now (preferred), then re-run this review.

5. Output a **Review Report**:
   - ✅ What is good
   - ⚠️ What is risky
   - 🧩 What should be refactored later (if any, max 3 items)

6. Then call **/handoff**.
