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
