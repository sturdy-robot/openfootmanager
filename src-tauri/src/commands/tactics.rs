use std::sync::Arc;
use tauri::State;

use log::info;
use ofm_core::game::CustomTactic;
use ofm_core::state::StateManager;

use super::util::mutate_active_game;

const NO_ACTIVE_GAME: &str = "be.error.noActiveGameSession";

/// The manager's own tactics for this career.
///
/// They used to live in the browser under a key built from the manager, the
/// career start date and the *team*, so they never travelled with the save and
/// a mid-career move to another club silently emptied the library (#390).
#[tauri::command]
pub fn list_custom_tactics(
    state: State<'_, Arc<StateManager>>,
) -> Result<Vec<CustomTactic>, String> {
    list_custom_tactics_internal(&state)
}

pub fn list_custom_tactics_internal(state: &StateManager) -> Result<Vec<CustomTactic>, String> {
    state
        .get_game(|game| game.custom_tactics.clone())
        .ok_or_else(|| NO_ACTIVE_GAME.to_string())
}

/// Save a tactic, replacing the one with the same id if it is already there.
#[tauri::command]
pub fn save_custom_tactic(
    state: State<'_, Arc<StateManager>>,
    tactic: CustomTactic,
) -> Result<Vec<CustomTactic>, String> {
    save_custom_tactic_internal(&state, tactic)
}

pub fn save_custom_tactic_internal(
    state: &StateManager,
    tactic: CustomTactic,
) -> Result<Vec<CustomTactic>, String> {
    info!("[cmd] save_custom_tactic: id={}", tactic.id);
    let game = mutate_active_game(state, |game| {
        // Saving over a tactic keeps its place in the library, so a manager who
        // reworks one does not find it has jumped to the bottom of the list.
        match game
            .custom_tactics
            .iter_mut()
            .find(|existing| existing.id == tactic.id)
        {
            Some(existing) => *existing = tactic,
            None => game.custom_tactics.push(tactic),
        }
        Ok(())
    })?;
    Ok(game.custom_tactics)
}

/// Remove a tactic. Removing one that is not there is not an error — the
/// library is already in the state the caller asked for.
#[tauri::command]
pub fn delete_custom_tactic(
    state: State<'_, Arc<StateManager>>,
    tactic_id: String,
) -> Result<Vec<CustomTactic>, String> {
    delete_custom_tactic_internal(&state, &tactic_id)
}

pub fn delete_custom_tactic_internal(
    state: &StateManager,
    tactic_id: &str,
) -> Result<Vec<CustomTactic>, String> {
    info!("[cmd] delete_custom_tactic: id={}", tactic_id);
    let game = mutate_active_game(state, |game| {
        game.custom_tactics.retain(|tactic| tactic.id != tactic_id);
        Ok(())
    })?;
    Ok(game.custom_tactics)
}
