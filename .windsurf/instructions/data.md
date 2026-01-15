# Data & Persistence Instructions

This file defines rules for **data formats and persistence**.

## Game Sessions
- Each save has an isolated database
- No shared mutable global data
- Saves must be user-editable

## Data Formats
- JSON and YAML only
- Schemas must be documented
- Validation is mandatory

## Modding
Users may define:
- Players
- Teams
- Clubs
- Stadiums
- Tournaments
- Logos (license-clean only)

## Rules
- No hardcoded IDs
- Stable identifiers preferred
- Backward compatibility matters

## Generation
Procedural generation must:
- Be reproducible
- Be configurable
- Avoid real-world copyrighted content
