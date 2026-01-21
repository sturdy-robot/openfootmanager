![Openfoot logo](images/openfoot.png)

# OPENFOOT MANAGER

**OpenFoot Manager** is a free and open source football/soccer manager game written in Rust. It is licensed under the [GPLv3](LICENSE.md), inspired by the famous franchise Football Manager&trade;, and also draws some ideas from the source code of [Bygfoot](https://bygfoot.sourceforge.io/new/), an open source football manager game written in C.

The purpose of this project is to provide an interesting and fun game for simulating a manager's life in a simple way: managing a team, dealing with players, finances and many other features. Inspired by the core mechanics of Football Manager, FIFA Manager, Championship Manager, Elifoot, Bygfoot, Brasfoot etc. this game aims to become a complete alternative to these games.

## Running

### Rust workspace

Run tests for the core crates:

```bash
cargo test
```

### Core + DB quickstart

Use the `openfootmanager_db` crate to load a data pack and persist season state:

```rust
use openfootmanager_core::simulation::engine::MatchConfig;
use openfootmanager_core::simulation::season::SeasonState;
use openfootmanager_db::Db;
use uuid::Uuid;

# async fn example() -> Result<(), Box<dyn std::error::Error>> {
let db = Db::in_memory().await?;
let _summary = db
    .import_data_pack_from_path("db/tests/fixtures/sample_pack.json")
    .await?;

let clubs = db.clubs().await?;
let home = clubs.get(0).expect("club");
let away = clubs.get(1).expect("club");

let mut state = SeasonState::new(Uuid::new_v4(), &[home.id, away.id]);
let fixture = state.schedule.rounds[0].fixtures[0].clone();

state.simulate_fixture(fixture.id, home, away, MatchConfig::new(42))?;
db.save_season_state(&state).await?;
# Ok(())
# }
```

### Desktop app (Tauri v2 + Leptos + Trunk + Tailwind)

The desktop app lives under `app/`:

- `app/ui`: Leptos (CSR) frontend built with Trunk.
- `app/src-tauri`: Tauri v2 backend.

Prerequisites:

- Rust target for WASM:

```bash
rustup target add wasm32-unknown-unknown
```

- Trunk:

```bash
cargo install trunk
```

Then run the Tauri dev workflow from `app/src-tauri`:

```bash
cargo tauri dev
```

The UI includes a `Seed demo database` button that calls the `seed_demo_db` command end-to-end.

## INSTALLATION

The game is still under development and it is not even close to ready for gameplay action. However, we already have a debug version of the game for testing purposes.

## CONTRIBUTING

Check the [CONTRIBUTING](CONTRIBUTING.md) file for more information on how to contribute.

## FEATURES

The game will have a number of features inspired by other established games on the market. The following features are planned:

### MAIN PLANNED FEATURES

- [ ] Choose any team and any league to manage
- [ ] Manage the team's finances
- [ ] Manage team's roster, being able to hire/fire players, choose team's formations and which players are going to play
- [ ] Organize practice sections, developing players even further
- [ ] Find new talents from Youth Academy
- [ ] Qualify for major leagues and championships, win important trophies
- [ ] Get the chance to become a national team's manager
- [ ] Simulation of games with Match Live Events (Descriptions of most important match events)
- [ ] Simulate results of other games
- [ ] Talk to the press
- [ ] Database of fictitious players

### ADDITIONAL FEATURES

- [ ] 3D simulation of matches
- [ ] Expand database
- [ ] Sponsorship with products that boost player's performances
- [ ] Mod support

## LICENSE

    OpenFoot Manager - A free and open source soccer management game
    Copyright (C) 2020-2025  Pedrenrique G. Guimarães

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

Check [LICENSE](LICENSE.md) for more information.
