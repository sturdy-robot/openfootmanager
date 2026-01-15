# Core Domain Instructions

This file defines rules for **core game logic** in Openfoot Manager.

## Scope
- Manager progression
- Club management
- Player lifecycle
- Finances
- Board expectations
- Staff & training logic

## Design Rules
- Domain logic MUST be UI-agnostic
- No frontend or database assumptions
- Prefer pure functions where possible
- Use explicit domain types, not primitives

## Modeling Rules
- Avoid "god structs"
- Use composition over inheritance
- Separate:
  - Rules
  - State
  - Effects

## Manager & Club
- Managers have reputation, traits, and history
- Clubs have identity, finances, expectations
- Board expectations must affect job security

## Player Lifecycle
- Players age
- Players improve or regress
- Training affects attributes over time
- Injuries and fatigue must be future-proofed

## Forbidden
- Hardcoded values without configuration
- Hidden global state
- Logic embedded in UI layers
