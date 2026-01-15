# Testing Instructions

This file defines the testing philosophy.

## Mandatory Tests
- Simulation transitions
- Attribute influence logic
- Save/load integrity

## Rules
- Tests must be deterministic
- Randomness must be seeded
- Avoid snapshot tests for simulation

## Layers
- Unit tests for pure logic
- Integration tests for simulation flow
- No UI testing required initially
