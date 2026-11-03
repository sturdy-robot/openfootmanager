Cloud run ofm-design-staff-bell: DONE

**Setup: worked.** apt deps exit 0; toolchain 1.95.0 installed from rust-toolchain.toml; `npm ci` exit 0. All cargo runs used `CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0`, from `src-tauri/`.

Every step ran. Findings: GREEN is not green (step 2: 1 of 4 staff_bell tests fails), and `cargo test --workspace` has 2 failures (step 5), one of them caused by this commit.

## 1. Fetch
`git log --oneline -2`: `37dc47a2 feat(generator): staff are generated on a bell, as players are` / `9acdd0a4 test(staff): …`. Note that 37dc47a2 also changes `generator/mod.rs`, `seed.rs` (test-only `normal_cdf`) and `staff_rating.rs` (`ASSISTANT_WEIGHTS`), not only generation.rs and staff_bell.rs.

## 2. GREEN
`cargo test -p ofm_core --lib staff_bell`: exit 101, 3 passed, 1 failed.
- every_roles_rating_spreads_as_a_players_does: ok
- a_free_agent_rates_well_below_a_club_member_of_his_role: ok
- each_rated_attribute_keeps_the_mean_the_game_was_balanced_on: ok
- **every_roles_rating_has_a_normal_tail: FAILED** (seeded, so it is deterministic). Message: `panicked at crates/ofm_core/src/generator/staff_bell.rs:233:21: Club Scout, 2.5 sd above the mean (75.98, sd 6.45): 0.400% of ratings against 0.523% for a normal bell (ratio 0.76)`

`staff_rating`: exit 0, 5 passed. `delegat`: exit 0, 2 passed.

## 3. RED (generation.rs from 9acdd0a4)
exit 101, 2 passed, 2 failed, as expected. The dead-code warnings appeared (`AttributeDraws`, `Draw`, `club_staff_attributes`, `free_agent_staff_attributes`, …).
- every_roles_rating_has_a_normal_tail: FAILED: `Club Coach, 1 sd above the mean (74.46, sd 11.51): 22.230% of ratings against 16.876% for a normal bell (ratio 1.32)`
- every_roles_rating_spreads_as_a_players_does: FAILED: `Club Coach: sd 11.53`
- each_rated_attribute_keeps…, a_free_agent_rates_well_below…: ok

Restored; `git status` clean.

## 4. Fixture
`npm run fixture:pages`: exit 0, 3m17s, `wrote src/dev/pageHarness/fixture.generated.ts (617 KB)`. Only that file changed: `1 file changed, 386 insertions(+), 398 deletions(-)`. Committed as ee0f7ba2.

**Much more than staff attributes moved.** The world's RNG stream shifts after the staff draws. As a result:
- All 44 staff and 179 of 216 players have new UUIDs.
- 7 of the 8 SCO clubs have new UUIDs. The names are unchanged, and the user's Glasgow FC keeps its id.
- The user's squad keeps 22 of its 23 player ids. Its players' jersey numbers, attributes, ovr, wages, contracts and positions changed, and the squad's mean ovr went from 60.13 to 61.30.
- The following also differ: competitions, league, managers, national_teams, world_history, team finance/history/wage_budget, financeSnapshot (annual wage bill 246131→256964), contractWarningStages, playersPage, squadFitness and teamsDirectory.

## 5. Full checks (on ee0f7ba2)
- `cargo test --workspace`: exit 101. It stopped at the first failing crate, so I re-ran it with `--no-fail-fast`: exit 101, 89 test binaries, **4457 passed, 2 failed, 60 ignored**.
  - `ofm_core --lib generator::staff_bell::tests::every_roles_rating_has_a_normal_tail`: the message is as in step 2.
  - `season-harness --test opening_ratings the_opening_world_keeps_its_tiers_mean_and_rare_wonderkids`: `panicked at crates/season-harness/tests/opening_ratings.rs:81:9: wonderkids; seed 2: S 2.05% A 9.69% mean 69.49 wonderkids 0.40%` (the band is 0.15–0.35%; seed 1 gives `S 2.30% A 9.56% mean 69.50 wonderkids 0.31%`). **This failure comes from this commit.** With ofm_core/src at 9acdd0a4 it passes (exit 0, 2 passed): seed 1 `S 2.11% A 9.76% mean 69.61 wonderkids 0.34%`, seed 2 `S 2.41% A 10.10% mean 69.61 wonderkids 0.30%`. This is consistent with the RNG stream shifting (see the fixture UUID reshuffle in step 4).
- `cargo test --lib --features mcp`: exit 0, 681 passed, 0 failed, 1 ignored.
- `cargo clippy --workspace --all-targets -- -D warnings`: exit 0.
- `cargo fmt --all -- --check`: exit 0.
- `npm test`: exit 1. Test Files: 1 failed, 354 passed (355). Tests: 1 failed, 3281 passed (3282). The only failure is the known Node 22 one: `src/pages/Dashboard.test.tsx > Dashboard > clears a stale active save id when a later refresh cannot load it`. The fixture freshness test passes.
- `npm exec --no -- tsc --noEmit`: exit 0.

## 6. Measure (whole shipped world, staff at clubs)
Each seed has 440 clubs and 1760 staff at clubs (440 per role, one per role per club) plus 12 free agents. Probe exit 0 both times. Each cell gives seeds 20261018 / 20261019 / 20261020. The seeds are close, but I give all three.

| | BEFORE (9acdd0a4) | AFTER (37dc47a2) |
|---|---|---|
| a. scout judging_ability ≥80 | 40.2 / 44.3 / 47.3% | 36.8 / 40.2 / 35.9% |
| 60–79 | 59.8 / 55.7 / 52.7% | 60.7 / 56.6 / 61.8% |
| 40–59 | 0 / 0 / 0% | 2.3 / 3.2 / 2.3% |
| <40 | 0 / 0 / 0% | 0.2 (1) / 0 / 0% |
| b. scout judging_potential ≥80 | 35.2 / 35.5 / 38.9% | 26.8 / 30.0 / 29.1% |
| 60–79 | 51.1 / 52.3 / 53.2% | 67.3 / 64.8 / 64.8% |
| 40–59 | 13.6 / 12.3 / 8.0% | 5.9 / 5.2 / 6.1% |
| <40 | 0 / 0 / 0% | 0 / 0 / 0% |
| c. coaches' judge ≥80 | 0 / 0 / 0% | 3.4 / 3.2 / 3.4% (15/14/15 clubs) |
| 60–79 | 65.2 / 64.8 / 60.9% | 60.2 / 58.0 / 60.5% |
| 40–59 | 34.8 / 35.2 / 39.1% | 35.0 / 38.2 / 35.0% |
| <40 | 0 / 0 / 0% | 1.4 / 0.7 / 1.1% (6/3/5 clubs) |
| d. AM quality mean (sd) | 64.96 (6.31) / 65.19 (7.06) / 64.97 (6.42) | 65.04 (6.83) / 65.72 (6.27) / 65.42 (6.47) |
| ≥70 / ≥75 / ≥80 | 25.7/6.8/0.7; 28.9/10.7/1.4; 25.7/8.2/0.9% | 24.5/9.3/2.0; 25.5/8.4/2.3; 25.2/8.4/1.8% |
| e. club mean coaching (sd) | 71.89 (8.45) / 71.12 (8.20) / 71.18 (8.07) | 72.14 (6.52) / 72.40 (6.18) / 72.10 (6.63) |
| club mean physiotherapy (sd) | 77.49 (9.97) / 77.07 (10.15) / 77.58 (10.33) | 77.20 (6.60) / 77.26 (6.66) / 77.27 (6.53) |

f. staff_rating at clubs. Each role has n = 440 per seed. Columns are mean, sd, min, max and the ratings at the top 2.5% / 11.5% / 51.5%.

| role | BEFORE | AFTER |
|---|---|---|
| Coach | 75.23/73.10/73.41; sd 11.58/11.23/11.44; min 55/55/55; max 94/94/94; top 94/93/94, 91/89/89, 75/72/73 | 74.61/74.95/74.47; sd 6.45/6.54/6.49; min 54/54/56; max 98/96/94; top 88/88/87, 82/83/82, 74/75/74 |
| AssistantManager | 64.96/65.19/64.97; sd 6.31/7.06/6.42; min 49/49/50; max 84/83/83; top 77/79/77, 73/74/73, 65/65/65 | 65.04/65.72/65.42; sd 6.83/6.27/6.47; min 46/44/48; max 84/84/82; top 79/79/79, 74/73/73, 65/66/65 |
| Scout | 75.40/76.27/76.89; sd 7.69/7.49/7.69; min 58/60/60; max 94/93/93; top 91/90/91, 86/86/87, 75/76/77 | 75.67/76.04/75.48; sd 6.33/6.67/6.19; min 54/59/50; max 93/93/94; top 87/89/88, 83/84/83, 76/76/75 |
| Physio | 77.49/77.07/77.58; sd 9.97/10.15/10.33; min 60/60/60; max 94/94/94; top 94/94/94, 90/91/91, 78/77/78 | 77.20/77.26/77.27; sd 6.60/6.66/6.53; min 56/61/56; max 95/99/98; top 92/92/90, 85/85/86, 77/77/77 |

g. Free agents (12 per seed: 4 Coach, 2 AM, 3 Scout, 3 Physio; too few to read bands from):
- No free-agent scout reaches ≥80 in either version; most fall in 40–59.
- AM quality is below 70 throughout.
- Rating means AFTER: Coach 54.00/54.25/57.75, AM 53.50/52.00/47.00, Scout 48.33/53.67/54.67, Physio 52.33/46.67/53.00.
- Rating means BEFORE: Coach 65.25/61.25/54.50, AM 49.00/59.50/39.50, Scout 54.67/54.00/62.33, Physio 33.67/50.67/48.33.
- The spread is narrower AFTER, for example Coach sd 4.12/4.09/7.63 against 8.84/13.66/13.74 BEFORE.

Probe source (`src-tauri/crates/ofm_core/examples/staff_band_probe.rs`, not committed):

```rust
//! Throwaway probe (cloud run ofm-design-staff-bell): staff band shares in the shipped world.
use domain::manager::Manager;
use domain::staff::{Staff, StaffRole};
use ofm_core::career::{CareerScope, begin_career};
use ofm_core::clock::GameClock;
use ofm_core::game::Game;
use ofm_core::generator::{
    DefinitionSources, ReputationBasis, WorldGenConfig, generate_world_data_seeded_with,
};
use ofm_core::staff_rating::staff_rating;
use ofm_core::world::build::{PastHistory, build_game_from_world_data};
use ofm_core::world::start_date_for_year;
use std::collections::BTreeMap;

const NATION: &str = "SCO";
const OPENING_YEAR: i32 = 2031;
const HISTORY_YEARS: u32 = 2;

fn build_career(seed: u64) -> Result<Game, String> {
    let sources = DefinitionSources::embedded_only();
    let mut config = WorldGenConfig::standard();
    config.opening_year = u32::try_from(OPENING_YEAR).ok();
    let world = generate_world_data_seeded_with(seed, &config, &sources);
    let clock = GameClock::new(start_date_for_year(OPENING_YEAR)?);
    let manager = Manager::new(
        "page-harness-manager".to_string(),
        "Alex".to_string(),
        "Morgan".to_string(),
        "1980-04-12".to_string(),
        "Scotland".to_string(),
    );
    let history = PastHistory {
        start_year: OPENING_YEAR,
        depth_years: HISTORY_YEARS,
    };
    let (mut game, stats) =
        build_game_from_world_data(clock, manager, history, world, ReputationBasis::Stored);
    let club = ofm_core::world::strongest_club(&game.teams, NATION)
        .map(str::to_string)
        .ok_or_else(|| format!("the world has no {NATION} club"))?;
    begin_career(&mut game, &club, CareerScope::default(), stats)?;
    Ok(game)
}

fn bands(values: &[u8]) -> String {
    let n = values.len().max(1) as f64;
    let c = |lo: u8, hi: u8| values.iter().filter(|v| **v >= lo && **v <= hi).count();
    let parts = [
        ("≥80", c(80, 255)),
        ("60–79", c(60, 79)),
        ("40–59", c(40, 59)),
        ("<40", c(0, 39)),
    ];
    parts
        .iter()
        .map(|(l, k)| format!("{l} {k} ({:.1}%)", *k as f64 * 100.0 / n))
        .collect::<Vec<_>>()
        .join(", ")
}

fn mean_sd(v: &[f64]) -> (f64, f64) {
    let n = v.len().max(1) as f64;
    let m = v.iter().sum::<f64>() / n;
    let s = (v.iter().map(|x| (x - m).powi(2)).sum::<f64>() / n).sqrt();
    (m, s)
}

fn quality(s: &Staff) -> i32 {
    (i32::from(s.attributes.coaching) * 4
        + i32::from(s.attributes.judging_ability) * 3
        + i32::from(s.attributes.judging_potential) * 3)
        / 10
}

fn report(label: &str, staff: &[&Staff], per_club: bool) {
    println!("--- {label}: {} staff", staff.len());
    let scouts: Vec<&&Staff> = staff
        .iter()
        .filter(|s| s.role == StaffRole::Scout)
        .collect();
    let ja: Vec<u8> = scouts.iter().map(|s| s.attributes.judging_ability).collect();
    let jp: Vec<u8> = scouts
        .iter()
        .map(|s| s.attributes.judging_potential)
        .collect();
    println!("a. scouts (n={}) judging_ability: {}", ja.len(), bands(&ja));
    println!("b. scouts judging_potential: {}", bands(&jp));
    if per_club {
        let mut judge: BTreeMap<&str, u8> = BTreeMap::new();
        let mut coach: BTreeMap<&str, Vec<f64>> = BTreeMap::new();
        let mut physio: BTreeMap<&str, Vec<f64>> = BTreeMap::new();
        for s in staff {
            let club = s.team_id.as_deref().unwrap_or("");
            match s.role {
                StaffRole::Coach | StaffRole::AssistantManager => {
                    let e = judge.entry(club).or_insert(0);
                    *e = (*e).max(s.attributes.judging_potential);
                    coach
                        .entry(club)
                        .or_default()
                        .push(f64::from(s.attributes.coaching));
                }
                StaffRole::Physio => physio
                    .entry(club)
                    .or_default()
                    .push(f64::from(s.attributes.physiotherapy)),
                StaffRole::Scout => {}
            }
        }
        let j: Vec<u8> = judge.values().copied().collect();
        println!("c. clubs (n={}) by coaches' judge: {}", j.len(), bands(&j));
        let cm: Vec<f64> = coach.values().map(|v| mean_sd(v).0).collect();
        let pm: Vec<f64> = physio.values().map(|v| mean_sd(v).0).collect();
        let (a, b) = mean_sd(&cm);
        let (c, d) = mean_sd(&pm);
        println!(
            "e. per-club mean coaching (Coach+AM, clubs={}): mean {a:.2} sd {b:.2}; per-club mean physiotherapy (clubs={}): mean {c:.2} sd {d:.2}",
            cm.len(),
            pm.len()
        );
    } else {
        let coaching: Vec<f64> = staff
            .iter()
            .filter(|s| matches!(s.role, StaffRole::Coach | StaffRole::AssistantManager))
            .map(|s| f64::from(s.attributes.coaching))
            .collect();
        let physio: Vec<f64> = staff
            .iter()
            .filter(|s| s.role == StaffRole::Physio)
            .map(|s| f64::from(s.attributes.physiotherapy))
            .collect();
        let (a, b) = mean_sd(&coaching);
        let (c, d) = mean_sd(&physio);
        println!(
            "e. (no clubs) Coach+AM coaching: mean {a:.2} sd {b:.2}; physio physiotherapy: mean {c:.2} sd {d:.2}"
        );
    }
    let q: Vec<i32> = staff
        .iter()
        .filter(|s| s.role == StaffRole::AssistantManager)
        .map(|s| quality(s))
        .collect();
    let qf: Vec<f64> = q.iter().map(|x| f64::from(*x)).collect();
    let (m, s) = mean_sd(&qf);
    let n = q.len().max(1) as f64;
    let share = |t: i32| q.iter().filter(|x| **x >= t).count() as f64 * 100.0 / n;
    println!(
        "d. AM quality (n={}): mean {m:.2} sd {s:.2}; ≥70 {:.1}%, ≥75 {:.1}%, ≥80 {:.1}%",
        q.len(),
        share(70),
        share(75),
        share(80)
    );
    for role in [
        StaffRole::Coach,
        StaffRole::AssistantManager,
        StaffRole::Scout,
        StaffRole::Physio,
    ] {
        let mut r: Vec<u8> = staff
            .iter()
            .filter(|s| s.role == role)
            .map(|s| staff_rating(s))
            .collect();
        if r.is_empty() {
            continue;
        }
        r.sort_unstable_by(|a, b| b.cmp(a));
        let rf: Vec<f64> = r.iter().map(|x| f64::from(*x)).collect();
        let (m, s) = mean_sd(&rf);
        let at = |p: f64| {
            let rank = ((p / 100.0) * r.len() as f64).ceil().max(1.0) as usize;
            r[rank.min(r.len()) - 1]
        };
        println!(
            "f. {role:?}: n {} mean {m:.2} sd {s:.2} min {} max {} top2.5% {} top11.5% {} top51.5% {}",
            r.len(),
            r[r.len() - 1],
            r[0],
            at(2.5),
            at(11.5),
            at(51.5)
        );
    }
}

fn main() {
    for seed in [20_261_018u64, 20_261_019, 20_261_020] {
        let game = build_career(seed).expect("career builds");
        println!("===== seed {seed}");
        let at_clubs: Vec<&Staff> = game.staff.iter().filter(|s| s.team_id.is_some()).collect();
        let free: Vec<&Staff> = game.staff.iter().filter(|s| s.team_id.is_none()).collect();
        report("AT CLUBS", &at_clubs, true);
        report("FREE AGENTS (g)", &free, false);
    }
}
```
