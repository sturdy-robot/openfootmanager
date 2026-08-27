//! The custom tactics library is a game-level JSON blob. Read the written
//! SQLite file directly so this test cannot pass because a reload reconstructs
//! the same in-memory value by some other route.

use chrono::{TimeZone, Utc};
use db::game_database::GameDatabase;
use db::game_persistence::GamePersistenceWriter;
use domain::manager::Manager;
use ofm_core::clock::GameClock;
use ofm_core::game::{CustomTactic, Game};
use rusqlite::Connection;

fn custom_tactic(id: &str, name: &str) -> CustomTactic {
    CustomTactic {
        id: id.to_string(),
        name: name.to_string(),
        description: "Compact without the ball".to_string(),
        formation: "4-2-3-1".to_string(),
        play_style: "Counter".to_string(),
        source_preset_name: Some("Balanced Control".to_string()),
    }
}

#[test]
fn write_game_stores_custom_tactics_in_the_database_file() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("career.db");
    let tactic = custom_tactic("custom:away-counter", "Away Counter");

    {
        let database = GameDatabase::open(&path).unwrap();
        let manager = Manager::new(
            "manager-1".to_string(),
            "Alex".to_string(),
            "Manager".to_string(),
            "1980-01-01".to_string(),
            "England".to_string(),
        );
        let mut game = Game::new(
            GameClock::new(Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap()),
            manager,
            vec![],
            vec![],
            vec![],
            vec![],
        );
        game.custom_tactics = vec![tactic];

        GamePersistenceWriter::write_game(&database, &game, "save-1", "Career").unwrap();
    }

    let raw_connection = Connection::open(&path).unwrap();
    let stored_json: String = raw_connection
        .query_row(
            "SELECT custom_tactics_json FROM game_meta WHERE id = 'singleton'",
            [],
            |row| row.get(0),
        )
        .expect("the saved game should contain the custom tactics JSON blob");
    let stored: Vec<CustomTactic> = serde_json::from_str(&stored_json).unwrap();

    assert_eq!(stored.len(), 1);
    assert_eq!(stored[0].id, "custom:away-counter");
    assert_eq!(stored[0].name, "Away Counter");
    assert_eq!(stored[0].description, "Compact without the ball");
    assert_eq!(stored[0].formation, "4-2-3-1");
    assert_eq!(stored[0].play_style, "Counter");
    assert_eq!(
        stored[0].source_preset_name.as_deref(),
        Some("Balanced Control")
    );
}
