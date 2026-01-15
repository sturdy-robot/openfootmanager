# Openfoot Core (Domain) — AGENTS

## Scope

This crate (`openfoot-core`) contains pure, UI-agnostic domain types and rules.

## Rules

- Rust stable only.
- No database or filesystem access.
- No Tauri/Leptos/web dependencies.
- Prefer explicit domain types over primitives.
- Avoid hidden global state.
- Public APIs must be documented.

## Testing

- Tests must be deterministic.
- Prefer unit tests for pure validation and domain invariants.
