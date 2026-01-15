# Openfoot Save (Sessions) — AGENTS

## Scope

This crate (`openfoot-save`) manages save/session folders and save metadata.

## Rules

- Rust stable only.
- Each save is isolated under its own directory.
- No global shared mutable save state.
- Database integration is optional; if added later it must remain per-save.
- No UI dependencies.

## Testing

- Tests must be deterministic.
- Save/load integrity must be covered by tests.
