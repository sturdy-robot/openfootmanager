# Openfoot Data (Definitions + Validation) — AGENTS

## Scope

This crate (`openfoot-data`) loads and validates user-editable definition files (JSON/YAML).

## Rules

- Rust stable only.
- JSON/YAML only.
- Validation is mandatory at the boundary.
- No gameplay rules (keep validation structural + referential).
- No UI dependencies.

## Testing

- Deterministic tests (no RNG needed here).
