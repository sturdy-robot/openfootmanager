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
            // Newest first, matching the order the screen shows and the order
            // it optimistically puts a new tactic in. Pushing meant a tactic
            // appeared at the top and then jumped to the bottom.
            None => game.custom_tactics.insert(0, tactic),
        }
        Ok(())
    })?;
    Ok(game.custom_tactics)
}
