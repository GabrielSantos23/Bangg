use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn save_audio_buffer(
    app: AppHandle,
    audio_data: Vec<u8>,
    filename: String,
) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let audio_dir = app_data_dir.join("audio_cache");
    std::fs::create_dir_all(&audio_dir)
        .map_err(|e| format!("Failed to create audio directory: {}", e))?;
    
    let file_path = audio_dir.join(&filename);
    
    std::fs::write(&file_path, audio_data)
        .map_err(|e| format!("Failed to write audio file: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn cleanup_audio_file(file_path: String) -> Result<(), String> {
    if std::path::Path::new(&file_path).exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn list_audio_files(app: AppHandle) -> Result<Vec<String>, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let audio_dir = app_data_dir.join("audio_cache");
    
    if !audio_dir.exists() {
        return Ok(Vec::new());
    }
    
    let entries = std::fs::read_dir(audio_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    let files: Vec<String> = entries
        .filter_map(|entry| {
            entry.ok().and_then(|e| {
                e.path().to_str().map(|s| s.to_string())
            })
        })
        .collect();
    
    Ok(files)
}