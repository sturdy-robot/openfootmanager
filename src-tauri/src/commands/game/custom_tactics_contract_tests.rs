use crate::commands::{list_custom_tactics_internal, save_custom_tactic_internal};
use chrono::{TimeZone, Utc};
use domain::manager::Manager;
use ofm_core::clock::GameClock;
use ofm_core::game::{CustomTactic, Game};
use ofm_core::state::StateManager;

fn tactic(id: &str, name: &str, formation: &str) -> CustomTactic {
    CustomTactic {
        id: id.to_string(),
        name: name.to_string(),
        description: format!("{name} description"),
        formation: formation.to_string(),
        play_style: "Counter".to_string(),
        source_preset_name: Some("Balanced Control".to_string()),
    }
}

fn state_with_game() -> StateManager {
    let state = StateManager::new();
    let mut manager = Manager::new(
        "manager-1".to_string(),
        "Alex".to_string(),
        "Manager".to_string(),
        "1980-01-01".to_string(),
        "England".to_string(),
    );
    manager.hire("team-1".to_string());
    state.set_game(Game::new(
        GameClock::new(Utc.with_ymd_and_hms(2026, 7, 1, 0, 0, 0).unwrap()),
        manager,
        vec![],
        vec![],
        vec![],
        vec![],
    ));
    state
}

#[test]
fn listing_custom_tactics_starts_empty() {
    let state = state_with_game();

    let listed = list_custom_tactics_internal(&state).expect("list custom tactics");

    assert!(listed.is_empty());
}

#[test]
fn saving_custom_tactics_appends_distinct_ids() {
    let state = state_with_game();

    save_custom_tactic_internal(&state, tactic("custom:one", "One", "4-4-2"))
        .expect("save first tactic");
    let after_first = list_custom_tactics_internal(&state).expect("list after first save");
    assert_eq!(after_first.len(), 1);
    assert_eq!(after_first[0].id, "custom:one");

    save_custom_tactic_internal(&state, tactic("custom:two", "Two", "4-3-3"))
        .expect("save second tactic");
    let after_second = list_custom_tactics_internal(&state).expect("list after second save");
    assert_eq!(after_second.len(), 2);
    assert!(after_second.iter().any(|entry| entry.id == "custom:one"));
    assert!(after_second.iter().any(|entry| entry.id == "custom:two"));
}

#[test]
fn saving_an_existing_id_updates_in_place_without_duplicating_it() {
    let state = state_with_game();
    save_custom_tactic_internal(&state, tactic("custom:one", "Original", "4-4-2"))
        .expect("save original tactic");

    let mut updated = tactic("custom:one", "Reworked", "3-4-3");
    updated.description = "Updated description".to_string();
    updated.play_style = "HighPress".to_string();
    updated.source_preset_name = None;
    save_custom_tactic_internal(&state, updated).expect("update existing tactic");

    let listed = list_custom_tactics_internal(&state).expect("list updated tactics");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].name, "Reworked");
    assert_eq!(listed[0].description, "Updated description");
    assert_eq!(listed[0].formation, "3-4-3");
    assert_eq!(listed[0].play_style, "HighPress");
    assert_eq!(listed[0].source_preset_name, None);
}

#[test]
fn custom_tactics_survive_a_change_of_club_in_the_same_career() {
    let state = state_with_game();
    save_custom_tactic_internal(
        &state,
        tactic("custom:career-tactic", "Career Tactic", "4-2-3-1"),
    )
    .expect("save tactic before changing clubs");

    state
        .update_game(|game| game.manager.hire("team-2".to_string()))
        .expect("active game");

    let listed = list_custom_tactics_internal(&state).expect("list after changing clubs");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, "custom:career-tactic");
}
