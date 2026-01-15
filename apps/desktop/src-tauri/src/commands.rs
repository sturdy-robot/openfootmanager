use serde::Serialize;
use tauri::State;

use openfoot_save::{SaveId, SaveManager, SaveRoot};
use openfoot_sim::ToyMatchConfig;

#[derive(Debug, Clone)]
pub struct AppState {
    saves: SaveManager,
}

impl AppState {
    pub fn new(save_root: SaveRoot) -> Self {
        Self {
            saves: SaveManager::new(save_root),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SaveListItem {
    pub id: String,
    pub created_unix_seconds: u64,
    pub display_name: Option<String>,
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_new_game(
    state: State<'_, AppState>,
    display_name: Option<String>,
) -> Result<SaveListItem, String> {
    let created = state
        .saves
        .create_new_save(display_name)
        .map_err(|e| e.to_string())?;

    Ok(SaveListItem {
        id: created.meta.id,
        created_unix_seconds: created.meta.created_unix_seconds,
        display_name: created.meta.display_name,
    })
}

#[tauri::command]
pub fn list_saves(state: State<'_, AppState>) -> Result<Vec<SaveListItem>, String> {
    let saves = state.saves.list_saves().map_err(|e| e.to_string())?;

    Ok(saves
        .into_iter()
        .map(|s| SaveListItem {
            id: s.meta.id,
            created_unix_seconds: s.meta.created_unix_seconds,
            display_name: s.meta.display_name,
        })
        .collect())
}

#[tauri::command(rename_all = "snake_case")]
pub fn open_save(state: State<'_, AppState>, id: String) -> Result<SaveListItem, String> {
    let save_id = SaveId::parse(&id).map_err(|e| e.to_string())?;

    let opened = state.saves.open_save(&save_id).map_err(|e| e.to_string())?;

    Ok(SaveListItem {
        id: opened.meta.id,
        created_unix_seconds: opened.meta.created_unix_seconds,
        display_name: opened.meta.display_name,
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn run_demo_match(seed: u64) -> Vec<String> {
    openfoot_sim::simulate_toy_match(ToyMatchConfig {
        seed,
        max_minutes: 10,
    })
}
