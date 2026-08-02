# Baselines

Recorded bench output, kept so a change to the match engine can be compared
against a known state rather than judged by eye.

| File | What it is |
| --- | --- |
| `pre-overhaul.json` | Aggregate + per-position report, before the match-engine rework |
| `pre-overhaul-sweeps.json` | Player-impact sweeps, before the rework |

Both were produced with a pinned seed, so they can be regenerated exactly:

```sh
cargo run -p sim-bench --release -- -n 5000 --seed 20260802 --out crates/sim-bench/baselines/pre-overhaul.json
cargo run -p sim-bench --release -- --sweeps -n 2000 --seed 20260802 --out crates/sim-bench/baselines/pre-overhaul-sweeps.json
```

## What the pre-overhaul baseline records

The engine these were taken from is off target in four related ways, all
listed in `targets::KNOWN_FAILING`: it produces about 3.46 goals per game
against a 2.3–3.0 band, and the clean-sheet and both-teams-scored figures
follow from that.

The per-position and sweep numbers are the more interesting half, because they
are what the rework is meant to change:

- Forwards attempt **no passes at all** — 100% of forward appearances end with
  zero passes attempted.
- Midfielders manage under six passes per 90, against a real-football figure in
  the dozens.
- Goalkeepers record nothing whatsoever; a save is credited to the shooter.
- Every goal is scored by a forward.
- A striker's shooting moved from 50 to 90 — the whole usable range — changes
  goals per 90 by only 1.36×, and does not change his shot count at all,
  because who acts is chosen uniformly within a position.
- Forward roles are indistinguishable from one another: 1.01×.

Regenerate a matching pair after an engine change and diff them. Anything that
moves should be something the change intended to move.

## Tactics: `pre-overhaul-phase-sweep.txt`

```sh
cargo run -p sim-bench --release -- --phase-sweep -n 2000 --seed 20260802 \
  > crates/sim-bench/baselines/pre-overhaul-phase-sweep.txt
```

The event-mix columns are the point: they show whether a dial changes *how* a
side plays, not just how often it wins. Before the rework they mostly do not.

- Completed passes range from 25.2 to 26.9 across all twenty dial settings — a
  6% spread for every tactical choice in the game combined.
- `build_up Short` vs `Long`, the dial named for how a team builds play, moves
  passes by 1.5% and nothing else.
- Four arms are *identical* to the baseline row — `marking Zonal`,
  `counter_press None`, `tempo Direct`, `break_speed Slow` — because each is the
  default, and every default modifier is exactly 1.0 by construction.
- Only two dials do visible work: `width` moves crosses (8.3 → 13.6), and
  `counter_press Long` moves possession (51.6% → 54.4%).
