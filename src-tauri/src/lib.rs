use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn library_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not find the GameVerse data directory: {error}"))?;
    Ok(app_data.join("library.json"))
}

fn read_library(path: &Path) -> Result<Option<Value>, String> {
    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not read the GameVerse library: {error}")),
    };
    serde_json::from_str(&contents)
        .map(Some)
        .map_err(|error| format!("The saved GameVerse library is not valid JSON: {error}"))
}

fn write_library(path: &Path, state: &Value) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "The GameVerse data directory is invalid.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create the GameVerse data directory: {error}"))?;
    let serialized = serde_json::to_vec_pretty(state)
        .map_err(|error| format!("Could not encode the GameVerse library: {error}"))?;
    fs::write(path, serialized)
        .map_err(|error| format!("Could not save the GameVerse library: {error}"))
}

#[tauri::command]
fn load_library(app: AppHandle) -> Result<Option<Value>, String> {
    read_library(&library_path(&app)?)
}

#[tauri::command]
fn save_library(app: AppHandle, state: Value) -> Result<(), String> {
    write_library(&library_path(&app)?, &state)
}

#[tauri::command]
fn storage_location(app: AppHandle) -> Result<String, String> {
    Ok(library_path(&app)?.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_library,
            save_library,
            storage_location
        ])
        .run(tauri::generate_context!())
        .expect("error while running GameVerse");
}

#[cfg(test)]
mod tests {
    use super::{read_library, write_library};
    use serde_json::json;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn library_file_round_trips_json_and_reports_missing_files() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after UNIX epoch")
            .as_nanos();
        let directory =
            std::env::temp_dir().join(format!("gameverse-test-{}-{nonce}", std::process::id()));
        let path = directory.join("library.json");
        let expected = json!({ "games": [{ "title": "Hades" }] });

        assert_eq!(read_library(&path).expect("missing file should load"), None);
        write_library(&path, &expected).expect("library should save");
        assert_eq!(
            read_library(&path).expect("saved JSON should load"),
            Some(expected)
        );

        fs::remove_dir_all(directory).expect("test data should be cleaned up");
    }
}
