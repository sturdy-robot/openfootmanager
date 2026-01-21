use std::path::Path;

use serde::{de::DeserializeOwned, Serialize};
use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Executor, Row, Sqlite, SqlitePool};
use thiserror::Error;
use uuid::Uuid;

use openfootmanager_core::models::club::Club;
use openfootmanager_core::models::league::League;
use openfootmanager_core::models::season::Season;
use openfootmanager_core::models::stadium::Stadium;
use openfootmanager_core::simulation::season::SeasonState;

use crate::data_pack::{DataPack, DataPackError, DataPackValidationError};

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

#[derive(Debug, Error)]
pub enum DbError {
    #[error("sqlx error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("serialization error: {0}")]
    SerdeJson(#[from] serde_json::Error),
    #[error("data pack error: {0}")]
    DataPack(#[from] DataPackError),
    #[error(transparent)]
    Validation(#[from] DataPackValidationError),
    #[error("missing club {0} in storage")]
    MissingClub(Uuid),
    #[error("missing league {0} in storage")]
    MissingLeague(Uuid),
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct ImportSummary {
    pub clubs: usize,
    pub stadiums: usize,
    pub leagues: usize,
    pub seasons: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LeagueBundle {
    pub league: League,
    pub clubs: Vec<Club>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeasonBundle {
    pub season: Season,
    pub league: League,
    pub clubs: Vec<Club>,
}

#[derive(Debug, Clone)]
pub struct Db {
    pool: SqlitePool,
}

impl Db {
    pub async fn connect(path: impl AsRef<Path>) -> Result<Self, DbError> {
        let options = SqliteConnectOptions::new()
            .filename(path.as_ref())
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new().max_connections(5).connect_with(options).await?;
        let db = Self { pool };
        db.init_schema().await?;
        Ok(db)
    }

    pub async fn in_memory() -> Result<Self, DbError> {
        let options = SqliteConnectOptions::new().filename(":memory:");
        let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await?;
        let db = Self { pool };
        db.init_schema().await?;
        Ok(db)
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn import_data_pack(&self, pack: &DataPack) -> Result<ImportSummary, DbError> {
        pack.validate()?;
        let mut transaction = self.pool.begin().await?;

        for stadium in &pack.stadiums {
            upsert_stadium(transaction.as_mut(), stadium).await?;
        }
        for club in &pack.clubs {
            upsert_club(transaction.as_mut(), club).await?;
        }
        for league in &pack.leagues {
            upsert_league(transaction.as_mut(), league).await?;
        }
        for season in &pack.seasons {
            upsert_season(transaction.as_mut(), season).await?;
        }

        transaction.commit().await?;

        Ok(ImportSummary {
            clubs: pack.clubs.len(),
            stadiums: pack.stadiums.len(),
            leagues: pack.leagues.len(),
            seasons: pack.seasons.len(),
        })
    }

    pub async fn import_data_pack_from_path(
        &self,
        path: impl AsRef<Path>,
    ) -> Result<ImportSummary, DbError> {
        let pack = DataPack::from_path(path)?;
        self.import_data_pack(&pack).await
    }

    pub async fn upsert_club(&self, club: &Club) -> Result<(), DbError> {
        upsert_club(&self.pool, club).await
    }

    pub async fn upsert_stadium(&self, stadium: &Stadium) -> Result<(), DbError> {
        upsert_stadium(&self.pool, stadium).await
    }

    pub async fn upsert_league(&self, league: &League) -> Result<(), DbError> {
        upsert_league(&self.pool, league).await
    }

    pub async fn upsert_season(&self, season: &Season) -> Result<(), DbError> {
        upsert_season(&self.pool, season).await
    }

    pub async fn save_season_state(&self, state: &SeasonState) -> Result<(), DbError> {
        let payload = serde_json::to_string(state)?;
        sqlx::query(
            "INSERT INTO season_state (season_id, data) VALUES (?1, ?2) \
             ON CONFLICT(season_id) DO UPDATE SET data = excluded.data",
        )
        .bind(state.season_id.to_string())
        .bind(payload)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn season_state(&self, season_id: Uuid) -> Result<Option<SeasonState>, DbError> {
        let record = sqlx::query("SELECT data FROM season_state WHERE season_id = ?1")
            .bind(season_id.to_string())
            .fetch_optional(&self.pool)
            .await?;

        record
            .map(|row| {
                let payload: String = row.try_get("data")?;
                Ok(serde_json::from_str(&payload)?)
            })
            .transpose()
    }

    pub async fn clubs(&self) -> Result<Vec<Club>, DbError> {
        fetch_all_json(&self.pool, "SELECT data FROM clubs").await
    }

    pub async fn club(&self, club_id: Uuid) -> Result<Option<Club>, DbError> {
        fetch_json_by_id(&self.pool, "clubs", club_id).await
    }

    pub async fn stadiums(&self) -> Result<Vec<Stadium>, DbError> {
        fetch_all_json(&self.pool, "SELECT data FROM stadiums").await
    }

    pub async fn stadium(&self, stadium_id: Uuid) -> Result<Option<Stadium>, DbError> {
        fetch_json_by_id(&self.pool, "stadiums", stadium_id).await
    }

    pub async fn leagues(&self) -> Result<Vec<League>, DbError> {
        fetch_all_json(&self.pool, "SELECT data FROM leagues").await
    }

    pub async fn league(&self, league_id: Uuid) -> Result<Option<League>, DbError> {
        fetch_json_by_id(&self.pool, "leagues", league_id).await
    }

    pub async fn seasons(&self) -> Result<Vec<Season>, DbError> {
        fetch_all_json(&self.pool, "SELECT data FROM seasons").await
    }

    pub async fn season(&self, season_id: Uuid) -> Result<Option<Season>, DbError> {
        fetch_json_by_id(&self.pool, "seasons", season_id).await
    }

    pub async fn league_bundle(&self, league_id: Uuid) -> Result<Option<LeagueBundle>, DbError> {
        let league = match self.league(league_id).await? {
            Some(league) => league,
            None => return Ok(None),
        };
        let clubs = self.clubs_by_ids(&league.club_ids).await?;
        Ok(Some(LeagueBundle { league, clubs }))
    }

    pub async fn season_bundle(&self, season_id: Uuid) -> Result<Option<SeasonBundle>, DbError> {
        let season = match self.season(season_id).await? {
            Some(season) => season,
            None => return Ok(None),
        };

        let league = self
            .league(season.league_id)
            .await?
            .ok_or(DbError::MissingLeague(season.league_id))?;
        let clubs = self.clubs_by_ids(&league.club_ids).await?;

        Ok(Some(SeasonBundle {
            season,
            league,
            clubs,
        }))
    }

    async fn init_schema(&self) -> Result<(), DbError> {
        MIGRATOR.run(&self.pool).await.map_err(DbError::Migration)?;
        Ok(())
    }

    async fn clubs_by_ids(&self, club_ids: &[Uuid]) -> Result<Vec<Club>, DbError> {
        let mut clubs = Vec::with_capacity(club_ids.len());
        for club_id in club_ids {
            let club = self
                .club(*club_id)
                .await?
                .ok_or(DbError::MissingClub(*club_id))?;
            clubs.push(club);
        }
        Ok(clubs)
    }
}

async fn upsert_club<'e, E>(executor: E, club: &Club) -> Result<(), DbError>
where
    E: Executor<'e, Database = Sqlite>,
{
    upsert_json(executor, "clubs", club.id, club).await
}

async fn upsert_stadium<'e, E>(executor: E, stadium: &Stadium) -> Result<(), DbError>
where
    E: Executor<'e, Database = Sqlite>,
{
    upsert_json(executor, "stadiums", stadium.id, stadium).await
}

async fn upsert_league<'e, E>(executor: E, league: &League) -> Result<(), DbError>
where
    E: Executor<'e, Database = Sqlite>,
{
    upsert_json(executor, "leagues", league.id, league).await
}

async fn upsert_season<'e, E>(executor: E, season: &Season) -> Result<(), DbError>
where
    E: Executor<'e, Database = Sqlite>,
{
    upsert_json(executor, "seasons", season.id, season).await
}

async fn upsert_json<'e, E, T>(executor: E, table: &str, id: Uuid, value: &T) -> Result<(), DbError>
where
    E: Executor<'e, Database = Sqlite>,
    T: Serialize,
{
    let payload = serde_json::to_string(value)?;
    let query = format!(
        "INSERT INTO {table} (id, data) VALUES (?1, ?2) \
         ON CONFLICT(id) DO UPDATE SET data = excluded.data"
    );
    sqlx::query(&query)
        .bind(id.to_string())
        .bind(payload)
        .execute(executor)
        .await?;
    Ok(())
}

async fn fetch_json_by_id<T>(pool: &SqlitePool, table: &str, id: Uuid) -> Result<Option<T>, DbError>
where
    T: DeserializeOwned,
{
    let query = format!("SELECT data FROM {table} WHERE id = ?1");
    let record = sqlx::query(&query)
        .bind(id.to_string())
        .fetch_optional(pool)
        .await?;

    record
        .map(|row| {
            let payload: String = row.try_get("data")?;
            Ok(serde_json::from_str(&payload)?)
        })
        .transpose()
}

async fn fetch_all_json<T>(pool: &SqlitePool, query: &str) -> Result<Vec<T>, DbError>
where
    T: DeserializeOwned,
{
    let rows = sqlx::query(query).fetch_all(pool).await?;
    rows.into_iter()
        .map(|row| {
            let payload: String = row.try_get("data")?;
            Ok(serde_json::from_str(&payload)?)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use std::path::PathBuf;

    use openfootmanager_core::models::player::Player;
    use openfootmanager_core::simulation::engine::MatchConfig;

    fn test_club(seed: u128) -> Club {
        let players = (0..18)
            .map(|index| {
                let mut player = Player::default();
                player.name = format!("Player {}", index + 1);
                player.short_name = format!("P{}", index + 1);
                player
            })
            .collect();

        Club {
            id: Uuid::from_u128(seed),
            name: format!("Club {}", seed),
            short_name: format!("C{}", seed % 99),
            date_of_foundation: Some(NaiveDate::from_ymd_opt(1900, 1, 1).unwrap()),
            nationality: "Testland".to_string(),
            stadium: None,
            manager: None,
            players,
        }
    }

    fn test_league(id: Uuid, club_ids: Vec<Uuid>) -> League {
        League {
            id,
            name: "Test League".to_string(),
            short_name: "TL".to_string(),
            country: "Testland".to_string(),
            club_ids,
        }
    }

    fn test_season(id: Uuid, league_id: Uuid) -> Season {
        Season {
            id,
            name: "Test Season".to_string(),
            league_id,
            year: 2026,
        }
    }

    #[tokio::test]
    async fn imports_data_pack_into_sqlite() {
        let db = Db::in_memory().await.expect("db");
        let club = test_club(1);
        let pack = DataPack {
            name: "Test Pack".to_string(),
            version: "0.1.0".to_string(),
            description: None,
            clubs: vec![club.clone()],
            stadiums: vec![],
            leagues: vec![],
            seasons: vec![],
        };

        let summary = db.import_data_pack(&pack).await.expect("import");
        assert_eq!(summary.clubs, 1);

        let clubs = db.clubs().await.expect("clubs");
        assert_eq!(clubs.len(), 1);
        assert_eq!(clubs[0].id, club.id);
    }

    #[tokio::test]
    async fn import_rejects_invalid_pack() {
        let db = Db::in_memory().await.expect("db");
        let club_id = Uuid::new_v4();
        let pack = DataPack {
            name: "Invalid Pack".to_string(),
            version: "0.1.0".to_string(),
            description: None,
            clubs: vec![test_club(1), test_club(1)],
            stadiums: vec![],
            leagues: vec![test_league(Uuid::new_v4(), vec![club_id])],
            seasons: vec![],
        };

        let error = db.import_data_pack(&pack).await.expect_err("should fail");
        assert!(matches!(error, DbError::Validation(_)));
    }

    #[tokio::test]
    async fn league_bundle_returns_clubs() {
        let db = Db::in_memory().await.expect("db");
        let club_a = test_club(10);
        let club_b = test_club(20);
        let league_id = Uuid::new_v4();
        let league = test_league(league_id, vec![club_a.id, club_b.id]);
        let pack = DataPack {
            name: "Bundle Pack".to_string(),
            version: "0.1.0".to_string(),
            description: None,
            clubs: vec![club_a.clone(), club_b.clone()],
            stadiums: vec![],
            leagues: vec![league.clone()],
            seasons: vec![],
        };

        db.import_data_pack(&pack).await.expect("import");
        let bundle = db.league_bundle(league_id).await.expect("bundle").expect("some");

        assert_eq!(bundle.league.id, league_id);
        assert_eq!(bundle.clubs.len(), 2);
        assert!(bundle.clubs.iter().any(|club| club.id == club_a.id));
        assert!(bundle.clubs.iter().any(|club| club.id == club_b.id));
    }

    #[tokio::test]
    async fn season_bundle_returns_league_and_clubs() {
        let db = Db::in_memory().await.expect("db");
        let club_a = test_club(30);
        let club_b = test_club(40);
        let league_id = Uuid::new_v4();
        let league = test_league(league_id, vec![club_a.id, club_b.id]);
        let season = test_season(Uuid::new_v4(), league_id);
        let pack = DataPack {
            name: "Season Pack".to_string(),
            version: "0.1.0".to_string(),
            description: None,
            clubs: vec![club_a.clone(), club_b.clone()],
            stadiums: vec![],
            leagues: vec![league.clone()],
            seasons: vec![season.clone()],
        };

        db.import_data_pack(&pack).await.expect("import");
        let bundle = db
            .season_bundle(season.id)
            .await
            .expect("bundle")
            .expect("some");

        assert_eq!(bundle.season.id, season.id);
        assert_eq!(bundle.league.id, league_id);
        assert_eq!(bundle.clubs.len(), 2);
    }

    #[tokio::test]
    async fn imports_sample_pack_from_json_file() {
        let db = Db::in_memory().await.expect("db");
        let path = sample_fixture_path("sample_pack.json");

        let summary = db
            .import_data_pack_from_path(&path)
            .await
            .expect("import");

        assert_eq!(summary.clubs, 2);
        let leagues = db.leagues().await.expect("leagues");
        assert_eq!(leagues.len(), 1);
    }

    #[tokio::test]
    async fn imports_sample_pack_from_yaml_file() {
        let db = Db::in_memory().await.expect("db");
        let path = sample_fixture_path("sample_pack.yaml");

        let summary = db
            .import_data_pack_from_path(&path)
            .await
            .expect("import");

        assert_eq!(summary.seasons, 1);
        let clubs = db.clubs().await.expect("clubs");
        assert_eq!(clubs.len(), 2);
    }

    #[tokio::test]
    async fn stores_and_loads_season_state() {
        let db = Db::in_memory().await.expect("db");
        let club_ids = vec![Uuid::new_v4(), Uuid::new_v4()];
        let season_id = Uuid::new_v4();
        let state = SeasonState::new(season_id, &club_ids);

        db.save_season_state(&state).await.expect("save");
        let loaded = db
            .season_state(season_id)
            .await
            .expect("load")
            .expect("state exists");

        assert_eq!(loaded.season_id, season_id);
        assert_eq!(loaded.schedule.rounds.len(), state.schedule.rounds.len());
    }

    #[tokio::test]
    async fn persists_simulated_season_state() {
        let db = Db::in_memory().await.expect("db");
        let club_ids = vec![Uuid::new_v4(), Uuid::new_v4()];
        let season_id = Uuid::new_v4();
        let mut state = SeasonState::new(season_id, &club_ids);
        let fixture = state.schedule.rounds[0].fixtures[0].clone();
        let home = test_club(fixture.home_club_id.as_u128());
        let away = test_club(fixture.away_club_id.as_u128());

        state
            .simulate_fixture(fixture.id, &home, &away, MatchConfig::new(42))
            .expect("simulate");

        db.save_season_state(&state).await.expect("save");
        let loaded = db
            .season_state(season_id)
            .await
            .expect("load")
            .expect("state exists");

        assert_eq!(loaded.results.len(), 1);
        assert_eq!(loaded.standings.entry(home.id).unwrap().played, 1);
    }

    fn sample_fixture_path(file_name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join(file_name)
    }
}
