# Openfoot Sim (Match Simulation) — AGENTS

## Scope

This crate (`openfoot-sim`) contains deterministic, testable match simulation logic.

## Rules

- Rust stable only.
- Deterministic and seedable randomness.
- Explicit state transitions (Markov-chain style).
- No UI dependencies.
- No persistence (DB/filesystem) in simulation logic.

## Testing

- Tests must be deterministic.
- No snapshot tests for simulation output.
