# Openfoot Desktop App — AGENTS

## Scope

This directory contains the desktop application shell (Tauri + Leptos).

## Rules

- Rust stable only.
- UI renders state and calls backend commands; it must not contain domain rules.
- Domain rules live in `crates/core` and `crates/sim`.
- Save/session responsibilities live in `crates/save`.

## Boundaries

- `apps/desktop/src-tauri` may call into `crates/*`.
- `apps/desktop/ui` must not depend on `crates/*` directly; it communicates via Tauri commands.
