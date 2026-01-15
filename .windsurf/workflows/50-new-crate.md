# new-crate

Create a new crate in the Cargo workspace with clean boundaries.

## Steps

1. Ask: "What is the crate's responsibility in one sentence?"
   - If unclear, propose 2-3 options and pick the simplest.

2. Define:
   - public API surface (types/functions/modules)
   - dependencies (minimal)
   - what it must NOT depend on (avoid cycles)

3. Create:
   - crate skeleton
   - lib.rs structure
   - module layout

4. Add:
   - basic unit test scaffold
   - documentation comments on public items

5. Output:
   - file tree for the crate
   - recommended next tasks
