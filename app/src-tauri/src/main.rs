#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::error::Error;

use openfootmanager_core::models::club::Club;
use openfootmanager_core::models::schedule::{Fixture, Round};
use openfootmanager_core::simulation::season::SeasonState;
use openfootmanager_db::{DataPack, Db, ImportSummary};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use uuid::Uuid;

const SAMPLE_PACK_JSON: &str = include_str!("../../../db/tests/fixtures/sample_pack.json");
const DEFAULT_RATING: u8 = 30;

#[derive(Clone)]
struct AppState {
    db: Db,
}

#[derive(Debug, Serialize)]
struct LeagueInfo {
    id: String,
    name: String,
    short_name: String,
    country: String,
    club_count: usize,
}

#[derive(Debug, Serialize)]
struct ClubInfo {
    id: String,
    code: String,
    name: String,
    league: String,
    country: String,
    rating: u8,
}

#[derive(Debug, Deserialize)]
struct CreateSessionPayload {
    club_id: String,
}

#[derive(Debug, Serialize)]
struct SessionSnapshot {
    session_id: String,
    club: ClubSnapshot,
    league: LeagueSnapshot,
    season: SeasonSnapshot,
    next_fixture: Option<FixtureSnapshot>,
    schedule: Vec<RoundSnapshot>,
    standings: Vec<StandingSnapshot>,
    squad: Vec<PlayerSnapshot>,
}

#[derive(Debug, Serialize)]
struct ClubSnapshot {
    id: String,
    name: String,
    short_name: String,
    country: String,
    rating: u8,
}

#[derive(Debug, Serialize)]
struct LeagueSnapshot {
    id: String,
    name: String,
    short_name: String,
    country: String,
}

#[derive(Debug, Serialize)]
struct SeasonSnapshot {
    id: String,
    name: String,
    year: i32,
    current_round: u8,
    total_rounds: usize,
}

#[derive(Debug, Serialize)]
struct FixtureClubSnapshot {
    id: String,
    name: String,
    short_name: String,
}

#[derive(Debug, Serialize)]
struct FixtureResultSnapshot {
    home_score: u8,
    away_score: u8,
}

#[derive(Debug, Serialize)]
struct FixtureSnapshot {
    id: String,
    round: u8,
    leg: u8,
    home: FixtureClubSnapshot,
    away: FixtureClubSnapshot,
    result: Option<FixtureResultSnapshot>,
}

#[derive(Debug, Serialize)]
struct RoundSnapshot {
    number: u8,
    leg: u8,
    fixtures: Vec<FixtureSnapshot>,
    bye: Option<FixtureClubSnapshot>,
}

#[derive(Debug, Serialize)]
struct StandingSnapshot {
    position: usize,
    club: FixtureClubSnapshot,
    played: u16,
    wins: u16,
    draws: u16,
    losses: u16,
    goals_for: u16,
    goals_against: u16,
    goal_difference: i16,
    points: u16,
}

#[derive(Debug, Serialize)]
struct PlayerSnapshot {
    id: String,
    name: String,
    short_name: String,
    nationality: String,
    form: u8,
    morale: u8,
    energy: u8,
    injured: bool,
}

#[tauri::command]
async fn seed_demo_db(state: State<'_, AppState>) -> Result<ImportSummary, String> {
    let db = state.db.clone();
    let pack = DataPack::from_json_str(SAMPLE_PACK_JSON).map_err(|err| err.to_string())?;
    db.import_data_pack(&pack)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
async fn list_leagues(state: State<'_, AppState>) -> Result<Vec<LeagueInfo>, String> {
    let db = state.db.clone();
    let leagues = db.leagues().await.map_err(|err| err.to_string())?;
    let payload = leagues
        .into_iter()
        .map(|league| LeagueInfo {
            id: league.id.to_string(),
            name: league.name,
            short_name: league.short_name,
            country: league.country,
            club_count: league.club_ids.len(),
        })
        .collect();
    Ok(payload)
}

#[tauri::command]
async fn create_session_snapshot(
    state: State<'_, AppState>,
    payload: CreateSessionPayload,
) -> Result<SessionSnapshot, String> {
    let club_id =
        Uuid::parse_str(&payload.club_id).map_err(|err| format!("Invalid club id: {err}"))?;
    let db = state.db.clone();

    let leagues = db.leagues().await.map_err(|err| err.to_string())?;
    let league = leagues
        .into_iter()
        .find(|league| league.club_ids.contains(&club_id))
        .ok_or_else(|| "No league found for selected club.".to_string())?;

    let seasons = db.seasons().await.map_err(|err| err.to_string())?;
    let season = seasons
        .into_iter()
        .filter(|season| season.league_id == league.id)
        .max_by_key(|season| season.year)
        .ok_or_else(|| "No season found for selected club.".to_string())?;

    let bundle = db
        .league_bundle(league.id)
        .await
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "League data missing.".to_string())?;

    let club = bundle
        .clubs
        .iter()
        .find(|club| club.id == club_id)
        .ok_or_else(|| "Selected club not found in league.".to_string())?;

    let season_state = match db
        .season_state(season.id)
        .await
        .map_err(|err| err.to_string())?
    {
        Some(state) => state,
        None => {
            let state = SeasonState::new(season.id, &league.club_ids);
            db.save_season_state(&state)
                .await
                .map_err(|err| err.to_string())?;
            state
        }
    };

    let club_lookup: HashMap<Uuid, &Club> =
        bundle.clubs.iter().map(|club| (club.id, club)).collect();
    let snapshot_club = |club_id: Uuid| -> Result<FixtureClubSnapshot, String> {
        let club = club_lookup
            .get(&club_id)
            .ok_or_else(|| format!("Missing club {club_id} in league bundle"))?;
        Ok(FixtureClubSnapshot {
            id: club.id.to_string(),
            name: club.name.clone(),
            short_name: club.short_name.clone(),
        })
    };
    let fixture_snapshot = |round: &Round, fixture: &Fixture| -> Result<FixtureSnapshot, String> {
        let home = snapshot_club(fixture.home_club_id)?;
        let away = snapshot_club(fixture.away_club_id)?;
        let result = season_state.results.get(&fixture.id).map(|result| {
            FixtureResultSnapshot {
                home_score: result.home_score,
                away_score: result.away_score,
            }
        });
        Ok(FixtureSnapshot {
            id: fixture.id.to_string(),
            round: round.number,
            leg: round.leg,
            home,
            away,
            result,
        })
    };

    let mut schedule = Vec::with_capacity(season_state.schedule.rounds.len());
    for round in &season_state.schedule.rounds {
        let fixtures = round
            .fixtures
            .iter()
            .map(|fixture| fixture_snapshot(round, fixture))
            .collect::<Result<Vec<_>, _>>()?;
        let bye = match round.bye {
            Some(club_id) => Some(snapshot_club(club_id)?),
            None => None,
        };
        schedule.push(RoundSnapshot {
            number: round.number,
            leg: round.leg,
            fixtures,
            bye,
        });
    }

    let standings = season_state
        .standings
        .entries
        .iter()
        .enumerate()
        .map(|(index, entry)| {
            let club = snapshot_club(entry.club_id)?;
            Ok(StandingSnapshot {
                position: index + 1,
                club,
                played: entry.played,
                wins: entry.wins,
                draws: entry.draws,
                losses: entry.losses,
                goals_for: entry.goals_for,
                goals_against: entry.goals_against,
                goal_difference: entry.goal_difference(),
                points: entry.points,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    let mut next_fixture = None;
    for round in season_state
        .schedule
        .rounds
        .iter()
        .skip(season_state.current_round_index)
    {
        for fixture in &round.fixtures {
            let involves_club =
                fixture.home_club_id == club_id || fixture.away_club_id == club_id;
            if !involves_club {
                continue;
            }
            if season_state.results.contains_key(&fixture.id) {
                continue;
            }
            next_fixture = Some(fixture_snapshot(round, fixture)?);
            break;
        }
        if next_fixture.is_some() {
            break;
        }
    }

    let squad = club
        .players
        .iter()
        .map(|player| PlayerSnapshot {
            id: player.id.to_string(),
            name: player.name.clone(),
            short_name: player.short_name.clone(),
            nationality: player.nationality.clone(),
            form: player.form.value(),
            morale: player.morale.value(),
            energy: player.energy.value(),
            injured: player.injury.is_some(),
        })
        .collect();

    Ok(SessionSnapshot {
        session_id: season.id.to_string(),
        club: ClubSnapshot {
            id: club.id.to_string(),
            name: club.name.clone(),
            short_name: club.short_name.clone(),
            country: club.nationality.clone(),
            rating: club_rating(club),
        },
        league: LeagueSnapshot {
            id: league.id.to_string(),
            name: league.name,
            short_name: league.short_name,
            country: league.country,
        },
        season: SeasonSnapshot {
            id: season.id.to_string(),
            name: season.name,
            year: season.year,
            current_round: season_state.current_round_index as u8 + 1,
            total_rounds: season_state.schedule.rounds.len(),
        },
        next_fixture,
        schedule,
        standings,
        squad,
    })
}

#[tauri::command]
async fn list_clubs(state: State<'_, AppState>) -> Result<Vec<ClubInfo>, String> {
    let db = state.db.clone();
    let clubs = db.clubs().await.map_err(|err| err.to_string())?;
    let leagues = db.leagues().await.map_err(|err| err.to_string())?;
    let mut league_lookup = HashMap::new();
    for league in &leagues {
        for club_id in &league.club_ids {
            league_lookup.insert(*club_id, league.name.clone());
        }
    }

    let payload = clubs
        .into_iter()
        .map(|club| {
            let rating = club_rating(&club);
            let league = league_lookup
                .get(&club.id)
                .cloned()
                .unwrap_or_else(|| "Independent".to_string());
            ClubInfo {
                id: club.id.to_string(),
                code: club.short_name,
                name: club.name,
                league,
                country: club.nationality,
                rating,
            }
        })
        .collect();

    Ok(payload)
}

fn club_rating(club: &Club) -> u8 {
    if club.players.is_empty() {
        return DEFAULT_RATING;
    }

    let total: f32 = club
        .players
        .iter()
        .map(|player| {
            (player.form.value() as f32
                + player.morale.value() as f32
                + player.energy.value() as f32)
                / 3.0
        })
        .sum();
    let average = total / club.players.len() as f32;
    average.round().clamp(0.0, 100.0) as u8
}

fn main() {
    tauri::Builder::default()
        .setup(|app| -> Result<(), Box<dyn Error>> {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("openfootmanager.db");
            let db = tauri::async_runtime::block_on(Db::connect(db_path))?;
            app.manage(AppState { db });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            seed_demo_db,
            list_leagues,
            list_clubs,
            create_session_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
