# The engine contract

How to write a match engine the game can play on.

The engine that ships with OpenFoot Manager is one implementation of a contract, not a fixed
part of the game. A different engine — a rewrite, an experiment, a 2D or 3D visual one — can be
compiled in and selected by name, and the rest of the game does not need to know which one it is
talking to.

**Scope.** Engines are Rust crates compiled into the build and listed in
`crates/engine/src/registry.rs`. Loading one from a shared library at runtime would need a stable
ABI and a security model, and is deliberately not what this is.

---

## The two entry points

An engine implements one or both. Most will want both, because the game uses them for different
things.

| Trait | Used for | Called by |
|---|---|---|
| `InstantEngine` | Resolving a fixture nobody is watching, in one call | league simulation, `ofm-sim-bench` |
| `LiveEngine` | A match the player watches, minute by minute, and interrupts | the live match screen |

Both require `EngineInfo`, which is what stops an engine from describing itself two different
ways on its two paths. That divergence is not hypothetical: batch and live simulation in this
project drifted apart once already, and the single descriptor is there so it cannot happen
between engines.

---

## What you must implement

### `EngineInfo`

```rust
fn descriptor(&self) -> EngineDescriptor
```

One value describing the engine: its id, its own behaviour version, which contract version it
speaks, the finest slice of play it resolves, which commands it accepts, and which optional
capabilities it has.

The **id must be unique and stable**. It is stamped on every fixture the engine plays so a replay
knows what produced the result. Two engines sharing an id would reconstruct each other's matches
and present the output as history.

### `InstantEngine`

```rust
fn simulate(&self, setup: &MatchSetup, rng: &mut dyn Rng) -> Result<MatchReport, EngineError>
```

Same seed and same inputs must produce the same report. See *Determinism* below. The only failure
is a setup carrying a config written for another engine — see *Your own tuning*.

### `LiveEngine` / `LiveState`

`kickoff` returns your state, or declines the setup; `LiveState` is the match in progress.

| Method | Meaning |
|---|---|
| `advance(request, rng) -> LiveUpdate` | Resolve some play. See *Cadence* below |
| `apply_command(cmd) -> Result<(), CommandRejection>` | A decision from the dugout, between minutes |
| `progress() -> MatchProgress` | Where the match stands: phase, clock, score, who has the ball |
| `phase() -> MatchPhase` | Which part of the match this is |
| `squad() -> Option<SquadState>` | Who is on the pitch and the bench. Optional — see below |
| `is_finished() -> bool` | Whether the match is over |
| `events() -> &[MatchEvent]` | The match so far |
| `engine_id() -> &'static str` | Which engine is playing |
| `minute() -> u8` | The running match minute |
| `report() -> MatchReport` | The report as it stands |
| `into_report(self: Box<Self>) -> MatchReport` | The final report, consuming the match |

### Cadence

`advance` is where the caller says how much play it wants and the engine says what it actually
resolved. The bargain:

- Resolve **at least one native step** unless a boundary intervenes. A caller that asks for a
  millisecond must still get progress, or it spins on a match that never moves.
- Stop as soon as you have resolved **at least** the budget. You may overshoot by at most one
  native step, never by more.
- Stop at a **phase boundary** whatever the budget says. Half time is when substitutions are made
  and the player has to be shown it; a half time that goes past inside a longer call is a half
  time nobody saw.
- You **may** stop early at a natural boundary of your own with budget left — the end of a
  possession, of a frame batch, of a shootout round — and `StopReason::NativeBoundary` says so.

`resolved_ms` of zero is a legitimate answer. An interval and a penalty kick both move the match on
without the clock running.

Commands and the dugout AI act **between** advance calls. So the granularity at which anyone can
intervene is the caller's chosen budget, bounded below by your native step — which is the honest
version of what `step_minute` used to fix at exactly one minute.

`LiveUpdate` deliberately carries no running minute. That is the built-in engine's way of counting,
not the contract's, and it cannot be recovered from the clock in a shootout, where the period opens
at minute 121 while the engine still reads 120. A caller that needs it asks `minute()`.

`into_report` takes `Box<Self>` on purpose. With a bare `self` receiver the method is left out of
the vtable, and an erased match can be played to full time and then never finished
(`error[E0161]`).

Your state must be `Send`. The game shares the live session between the Tauri command pool and,
under the `mcp` feature, the MCP server's runtime.

---

## What you may advertise

Optional, and declared in the descriptor.

`compliance::check_capabilities` verifies two claims in both directions today.

**Positions.** It fails an engine that advertises telemetry and returns none, and equally one that
returns telemetry it never advertised, because nothing will ever ask for it. It also rejects
coordinates that are not real numbers or are off the field of play.

**Squads.** It fails an engine that accepts `Substitute` but reports no squad — the game would
offer a change with nothing to pick from — and equally one that reports a squad no command can
change.

`extra_time`, `penalty_shootout` and `in_match_ai` are declarations the suite does not yet check.
Treat them as promises you are expected to keep, and expect the checks to arrive.

| Capability | What it means |
|---|---|
| `spatial_telemetry` | You know where the players are. Implement `LiveState::telemetry()` returning `SpatialTelemetry`, in normalised pitch coordinates. |
| `extra_time`, `penalty_shootout` | You resolve knockout ties. |
| `in_match_ai` | You manage the dugout yourself rather than expecting the caller to. |
| `commands` | Which `MatchCommandKind`s you accept. Anything absent must be refused with `CommandRejection::Unsupported` rather than ignored, so a caller can stop offering it. |
| *(implied)* `squad()` | Listing `Substitute` among your commands obliges you to implement `LiveState::squad()`, and implementing it obliges you to accept `Substitute`. Checked in both directions. |

### Errors

`EngineError` is closed, for the same reason `CommandRejection` is: the game renders these, and an
engine returning a string of its own puts text on screen that no locale file contains. Two
variants today — an unknown engine id, and a config written for another engine — each owning a
static translation key checked against `en.json`.

That check is not theoretical. `be.error.liveMatch.unknownEngine` was first written as a bare
`format!` string in `ofm_core` and shipped in **zero** of the eleven locales, because nothing was
looking.

**Do not fabricate what you do not model.** The built-in engine advertises no spatial telemetry
because it resolves bands and lanes, not coordinates. A made-up position is worse than an absent
one: whatever draws it will believe it.

---

## Your own tuning

`MatchSetup` used to carry a `MatchConfig` — ten constants with names like `shot_accuracy_base`
and `goal_conversion_base`. Those are the built-in engine's, and their own doc comments say so:
one is "calibrated against the effective shooting skill the engine actually produces". Every
engine inherited them anyway.

Now the setup carries config the way a courier carries a parcel. It holds it; it does not open it.

```rust
impl EngineConfig for MyConfig {
    fn engine_id(&self) -> &'static str { "my-engine" }
    fn as_any(&self) -> &dyn std::any::Any { self }
}

// in kickoff / simulate
let config = engine::read_config::<MyConfig>(setup.engine_config.as_ref(), "my-engine")?
    .cloned()
    .unwrap_or_default();
```

`Ok(None)` means the caller had no opinion — use your defaults, which is what every path in the
game does today. `Err` means the parcel is addressed to somebody else: **decline the match**.
Falling back to your defaults would run a fixture under settings nobody chose and tell nobody.

The type is what matches, not the id — a downcast cannot be fooled. `engine_id()` exists so an
engine declining somebody else's config can say whose it was.

---

## What you get for free

- **The dugout AI.** `ai_decide` runs on `&dyn LiveState`, so substitutions and tactical changes
  work on any engine. It reads `progress()`, `squad()`, `minute()` and `minutes_under_pressure()`,
  and nothing else. An engine reporting no squad gets no AI — every decision a manager makes is about the team,
  so there is nothing to decide — which is consistent with such an engine accepting no commands.
- **The match screen.** `MatchSnapshot::compose(state, context)` builds the game's whole match view
  out of contract calls, so what the player sees works for any engine. An engine with no squad
  simply produces a view with no squad rather than being unable to produce one. `SnapshotContext`
  is the short list of things the caller supplies because they are facts about the *fixture* and
  not about the simulation: whether the tie goes to extra time, and what the two clubs are called.
  Never invent a team name — the match screen renders it, and the engine crate is the one place
  the game's eleven locales cannot reach.
- **The compliance suite.** `compliance::run_all` checks determinism, report and event agreement,
  discipline, substitution legality and shootout resolution.
- **The benchmark.** `ofm-sim-bench --engine <id>` measures any registered engine against the same
  calibration bands, sweeps and performance harness.
- **Replay.** Fixtures record your engine id and version. A stored match is only re-simulated by
  an engine that matches both; otherwise it stays readable as a summary.

---

## Determinism

Replay works by re-simulating from a stored seed, so the same seed and inputs must produce the
same match. In practice:

- No wall-clock time, no thread-local RNG, no entropy the caller did not supply.
- **No simulation-affecting iteration over a hash-ordered collection.** Use a `Vec` for anything
  whose order can change an outcome. `HashMap` and `HashSet` are fine for lookups.
- A behaviour change means bumping your engine's version in its descriptor. Old replays then
  degrade to a readable summary rather than silently reconstructing a different match.

---

## Registering an engine

Add it to `crates/engine/src/registry.rs`:

```rust
pub fn instant(id: &str) -> Option<Box<dyn InstantEngine>> {
    match id {
        DEFAULT_ENGINE_ID => Some(Box::new(DefaultEngine)),
        "my-engine" => Some(Box::new(MyEngine)),
        _ => None,
    }
}
```

Then add the id to `ids()`. A test asserts every listed id resolves on both paths and has a
descriptor, so a half-registered engine fails the build rather than at runtime.

Unknown ids are declined, never substituted. A silent fallback to the built-in engine would stamp
the wrong id on the fixture.

---

## Rough edges, honestly

The contract is not finished. These are known and being worked on; they are written down so
nobody discovers them the hard way.

- **A config is not recorded on the fixture.** Replay re-simulates from a stored seed and engine
  id, but not from stored tuning, so a match replays under whatever the running build's defaults
  are. Nothing varies tuning in the game today, so nothing is wrong yet; the moment league or
  difficulty settings pick a config, replay needs it persisted — which needs a serialized form,
  and `EngineConfig` is deliberately not one. This is the next thing to fix.
- **`LiveEngine::kickoff` drops `MatchSetup::seed` and both `AiProfile`s.** The instant path uses
  them; the live path currently expects the caller to own the RNG and drive the AI. Fixing this is
  a behaviour change and is scheduled with the other engine-behaviour work.

---

## See also

- `crates/engine/src/traits.rs` — the contract itself
- `crates/engine/src/descriptor.rs` — capabilities and versioning
- `crates/engine/src/compliance.rs` — what an engine is checked against
- `crates/engine/src/view.rs` — what a caller can see of a match in progress
- `crates/engine/src/config.rs` — tuning an engine defines for itself
- `crates/engine/src/error.rs` — why a match could not start
- `crates/engine/tests/contract_tests.rs` — two deliberately unlike fake engines, driven through
  trait objects
- [`MATCH_SIMULATION.md`](MATCH_SIMULATION.md) — how the built-in engine works
