# Architecture Instructions

This file defines architectural constraints.

## Workspace
- Use Cargo workspaces
- Separate crates:
  - core
  - simulation
  - data
  - frontend

## Dependencies
- Prefer minimal dependencies
- No experimental crates
- Justify every dependency

## Refactoring
- Refactors are expected
- Keep commits focused
- Preserve behavior unless explicitly changing it

## Documentation
- Public APIs must be documented
- Internal architecture must be explainable
