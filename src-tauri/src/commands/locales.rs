#[derive(serde::Serialize)]
pub struct UserLocale {
    pub code: String,
    pub content: serde_json::Value,
}

/// Read user-provided locale files from `$APP_DATA_DIR/locales/*.json`.
/// Returns an empty list if the directory does not exist.
/// Malformed JSON files are silently skipped.
#[tauri::command]
pub fn list_user_locales(app_handle: tauri::AppHandle) -> Result<Vec<UserLocale>, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| "locales.loadFailed".to_string())?
        .join("locales");

    if !dir.exists() {
        return Ok(vec![]);
    }

    let entries =
        std::fs::read_dir(&dir).map_err(|_| "locales.loadFailed".to_string())?;

    let mut result = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Some(code) = path.file_stem().and_then(|s| s.to_str()).map(str::to_owned)
        else {
            continue;
        };
        let Ok(json) = std::fs::read_to_string(&path) else {
            log::warn!("[locales] Could not read {:?}, skipping", path);
            continue;
        };
        let Ok(content) = serde_json::from_str::<serde_json::Value>(&json) else {
            log::warn!("[locales] Could not parse {:?} as JSON, skipping", path);
            continue;
        };
        result.push(UserLocale { code, content });
    }

    Ok(result)
}
