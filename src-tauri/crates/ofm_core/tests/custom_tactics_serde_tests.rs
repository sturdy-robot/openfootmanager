use chrono::{TimeZone, Utc};
use domain::manager::Manager;
use ofm_core::clock::GameClock;
use ofm_core::game::Game;

#[test]
fn game_json_written_before_custom_tactics_still_loads_with_an_empty_library() {
    let manager = Manager::new(
        "manager-1".to_string(),
        "Alex".to_string(),
        "Manager".to_string(),
        "1980-01-01".to_string(),
        "England".to_string(),
    );
    let game = Game::new(
        GameClock::new(Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap()),
        manager,
        vec![],
        vec![],
        vec![],
        vec![],
    );
    let mut pre_field_json = serde_json::to_value(game).unwrap();
    pre_field_json
        .as_object_mut()
        .unwrap()
        .remove("custom_tactics");

    let loaded: Game = serde_json::from_value(pre_field_json)
        .expect("a save written before custom_tactics should remain loadable");

    assert!(loaded.custom_tactics.is_empty());
}
