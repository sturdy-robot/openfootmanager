mod commands;

use commands::{AppState, create_new_game, list_saves, open_save, run_demo_match};
use openfoot_save::SaveRoot;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let base = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("./saves"));
            let root = SaveRoot::new(base.join("saves"));
            app.manage(AppState::new(root));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_new_game,
            list_saves,
            open_save,
            run_demo_match
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
