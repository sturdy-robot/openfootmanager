# Match Simulation Instructions

This file defines rules for **match simulation**.

## Simulation Philosophy
- Convincing > realistic
- Deterministic
- Testable
- Attribute-driven

## Core Model
- Simulation must be Markov Chain-based
- State transitions must be explicit
- Randomness must be seedable

## State
- Ball position must be tracked
- Team possession must be explicit
- Match clock must be authoritative

## Events
Examples:
- Pass
- Shot
- Cross
- Dribble
- Tackle
- Foul

(THESE ARE ONLY DEMONSTRATIVE EXAMPLES, YOU MUST DEFINE THE EVENTS AS YOU SEE FIT)

REMEMBER THE RULES IN SOCCER, SUCH AS PENALTY, OFFSIDE, GOAL, YELLOW CARD, RED CARD, ETC.

Each event:
- Consumes stamina
- Affects morale
- Has probabilistic outcomes (Miss, Intercept, Success, etc.)

## Influences
Event outcomes depend on:
- Player attributes (0–100)
- Fatigue
- Form
- Morale
- Tactical context

## Match Control
- Support instant simulation
- Support real-time simulation
- Allow substitutions and tactics mid-match

## Output
- Commentary must be:
  - Human-readable
  - Contextual
  - Varied
