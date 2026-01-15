# AGENTS.md

This document defines the rules, scope, and expectations for **AI agents** and **human contributors** working on **Openfoot Manager**.

Openfoot Manager is a **free and open-source football manager-style game**, inspired by Football Manager, built with **Rust (stable) + Tauri + Leptos (latest stable)**.

The goal is to create a **fun, playable, moddable, and maintainable** football management game — not a simulation for extreme realism, but one that is *convincing, coherent, and enjoyable*.

---

## 1. Core Principles

All agents and contributors **must respect** the following principles:

- **Clean, correct, compiling code**
- **Type-safe design**
- **Refactor-friendly architecture**
- **No invented APIs**
- **No hallucinated libraries or functions**
- **No copyrighted or protected content**
- **Test-driven where feasible**
- **Readable and documented internals**

This project is expected to evolve over time. Design decisions must assume **future refactoring is inevitable**.

---

## 2. Technology Stack

### Backend / Core
- **Rust (stable only)**
- Modular architecture using **Cargo workspaces**
- Strong typing and domain-driven structures
- Deterministic simulation logic

### Frontend
- **Leptos (latest stable)**
- **Tauri** for desktop packaging
- **TailwindCSS** or equivalent modern CSS tooling
- Responsive, modern, and visually clean UI

---

## 3. Game Scope

### Manager Experience
The user can:

- Create a custom manager
- Select and manage a club
- Hire and sell players
- Discover youth talents
- Manage finances and budgets
- Meet (or fail) board expectations
- Be fired or switch clubs
- Train players and staff
- Define formations, strategies, and bench
- Promote youth players to the main squad

National team management may be introduced later and **must be designed extensibly**, but is not required initially.

---

## 4. Player Model

Players use **0–100 attributes**, inspired by Football Manager and FIFA.

Players must include:
- Technical, physical, and mental attributes
- Fitness
- Morale
- Form
- Stamina consumption rate
- Recovery rate

These values must meaningfully affect:
- Match performance
- Fatigue
- Injury likelihood (future-proofed)

---

## 5. Match Simulation

The match engine must be:

- **Convincing**, not ultra-realistic
- **Markov Chain-based**
- Event-driven
- Deterministic and testable

### Key Requirements
- Ball position tracked (enum-based is acceptable)
- Events such as:
  - Pass
  - Shot
  - Cross
  - Dribble
  - Tackle
- Outcomes depend on:
  - Player attributes
  - Morale
  - Fitness
  - Stamina
  - Tactical context

### Match Modes
- Instant simulation
- Real-time simulation with:
  - Adjustable speed
  - Live substitutions
  - Tactical changes

### Output
- Human-readable commentary
- Variation in descriptions
- Clear context (teams, players, situations)

---

## 6. Data & Persistence

### Game Sessions
- Each new save creates its **own isolated database**
- No save should affect global or other saves
- Users may edit or inspect their save data

### Data Generation
The engine must support generation of:
- Clubs
- Teams
- Players
- Staff
- Stadiums
- Tournaments

### Modding
Users can define and override data using:
- **JSON**
- **YAML**

This includes:
- Teams
- Players
- Logos
- Tournaments
- Competitions
- Metadata

The data format must be:
- Documented
- Validated
- Backward-compatible where possible

---

## 7. Code Quality Rules

All agents and contributors **must**:

- Ensure code **compiles**
- Avoid dead or speculative code
- Avoid unnecessary comments
- Prefer clear naming over comments
- Write tests for:
  - Simulation logic
  - Domain rules
- Document:
  - Simulation flow
  - Data schemas
  - Engine responsibilities

Refactoring must be **safe and deliberate**, not rushed.

---

## 8. Forbidden Actions

Agents and contributors must **NOT**:

- Invent APIs
- Guess undocumented behavior
- Use unstable Rust features
- Introduce proprietary or copyrighted material
- Add assets without a clear license
- Over-optimize prematurely
- Hardcode data that should be configurable

---

## 9. Contribution Mindset

Openfoot Manager is:

- Community-driven
- Open to experimentation
- Focused on maintainability

Every change should answer:
> *Will this still make sense in 2 years?*

If not, rethink it.

---

## 10. License & Ethics

This project:
- Is **free and open source**
- Must remain legally distributable
- Must avoid real-world likenesses, logos, or names unless explicitly permitted

---

## 11. Final Note to AI Agents

You are not here to generate volume.

You are here to:
- Think carefully
- Design intentionally
- Write code that humans can trust

If something is unclear:
- Ask
- Document assumptions
- Do not hallucinate

---

**Openfoot Manager exists to prove that great football management games can be free, open, and community-built.**
