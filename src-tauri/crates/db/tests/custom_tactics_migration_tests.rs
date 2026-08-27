use db::game_database::GameDatabase;
use db::migrations::all_migrations;
use rusqlite::{Connection, params};

const CUSTOM_TACTICS_SCHEMA_VERSION: i64 = 44;

#[test]
fn v044_adds_an_empty_custom_tactics_collection_to_an_existing_save() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("pre-custom-tactics.db");

    {
        let mut connection = Connection::open(&path).unwrap();
        all_migrations()
            .to_version(&mut connection, 43)
            .expect("the pre-custom-tactics schema should still be constructible");
        connection
            .execute(
                "INSERT INTO game_meta (
                    id, save_id, save_name, manager_id, start_date, game_date,
                    created_at, last_played_at
                 ) VALUES ('singleton', ?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "save-before-custom-tactics",
                    "Existing Career",
                    "manager-1",
                    "2026-07-01T00:00:00Z",
                    "2026-08-01T00:00:00Z",
                    "2026-07-01T00:00:00Z",
                    "2026-08-01T00:00:00Z",
                ],
            )
            .unwrap();
    }

    let database = GameDatabase::open(&path).expect("v044 should migrate the existing save");

    assert_eq!(
        database.schema_version().unwrap(),
        CUSTOM_TACTICS_SCHEMA_VERSION,
        "custom tactics belong to the v044 save schema",
    );
    let stored: String = database
        .conn()
        .query_row(
            "SELECT custom_tactics_json FROM game_meta WHERE id = 'singleton'",
            [],
            |row| row.get(0),
        )
        .expect("v044 should add game_meta.custom_tactics_json");
    assert_eq!(stored, "[]");
}
