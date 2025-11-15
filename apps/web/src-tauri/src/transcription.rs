use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub struct TranscriptionState {
    pub whisper_ctx: Mutex<Option<WhisperContext>>,
    pub model_loaded: Mutex<bool>,
}

impl Default for TranscriptionState {
    fn default() -> Self {
        Self {
            whisper_ctx: Mutex::new(None),
            model_loaded: Mutex::new(false),
        }
    }
}

/// Find the project root directory by looking for common markers (like Cargo.toml, package.json, etc.)
fn find_project_root() -> Option<PathBuf> {
    // Try multiple starting points
    let starting_points = vec![
        std::env::current_dir().ok(),
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf())),
    ];
    
    for start in starting_points.into_iter().flatten() {
        let mut current = start;
        
        // Traverse up to find project root (limit to 10 levels to avoid infinite loops)
        for _ in 0..10 {
            // Check for common project root markers
            let has_package_json = current.join("package.json").exists();
            let has_models = current.join("models").exists();
            let has_turbo_json = current.join("turbo.json").exists();
            
            // If we find the root package.json (not in apps/web) and models folder, we're at project root
            if (has_package_json || has_turbo_json) && has_models {
                return Some(current);
            }
            
            // Also check if models folder exists (this is a strong indicator)
            if has_models && current.join("models").join("ggml-base.en.bin").exists() {
                return Some(current);
            }
            
            // Go up one directory
            match current.parent() {
                Some(parent) => current = parent.to_path_buf(),
                None => break,
            }
        }
    }
    
    None
}

/// Resolve model path, checking bundled resources first (production), then project root (development)
fn resolve_model_path(app: &AppHandle, model_name: &str) -> Result<PathBuf, String> {
    let mut checked_paths = Vec::new();
    
    // FIRST: Try bundled resources (for production builds - users won't need to download)
    let resource_path = app.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?
        .join("models")
        .join(model_name);
    checked_paths.push(format!("1. Bundled resources: {:?}", resource_path));
    
    if resource_path.exists() {
        return Ok(resource_path);
    }
    
    // SECOND: Try project root models folder (for development)
    if let Some(project_root) = find_project_root() {
        let project_model_path = project_root.join("models").join(model_name);
        checked_paths.push(format!("2. Project root: {:?}", project_model_path));
        if project_model_path.exists() {
            return Ok(project_model_path);
        }
    } else {
        checked_paths.push("2. Project root: (could not determine project root)".to_string());
    }
    
    // THIRD: Fallback to app data directory (for user-installed models)
    let app_data_path = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("models")
        .join(model_name);
    checked_paths.push(format!("3. App data dir: {:?}", app_data_path));
    
    if app_data_path.exists() {
        return Ok(app_data_path);
    }
    
    // If none exist, return error with all checked paths
    Err(format!(
        "Model file not found. Searched in:\n{}\n\nFor development: Place the model in the project root: models/{}\nFor production: The model should be bundled with the app.\n\nCurrent directory: {:?}\nExecutable path: {:?}",
        checked_paths.join("\n"),
        model_name,
        std::env::current_dir().unwrap_or_default(),
        std::env::current_exe().ok()
    ))
}

#[tauri::command]
pub async fn initialize_whisper(
    app: AppHandle,
    model_name: String,
) -> Result<String, String> {
    let state = app.state::<TranscriptionState>();
    
    let model_path = resolve_model_path(&app, &model_name)?;
    
    // Load the model
    let ctx_params = WhisperContextParameters::default();
    let ctx = WhisperContext::new_with_params(
        model_path.to_str().ok_or("Invalid model path")?,
        ctx_params
    )
    .map_err(|e| format!("Failed to load whisper model: {:?}", e))?;
    
    *state.whisper_ctx.lock().unwrap() = Some(ctx);
    *state.model_loaded.lock().unwrap() = true;
    
    Ok(format!("Model loaded successfully from: {:?}", model_path))
}

#[tauri::command]
pub async fn get_model_paths(app: AppHandle) -> Result<ModelPaths, String> {
    let resource_dir = app.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let resource_models = resource_dir.join("models");
    let app_data_models = app_data_dir.join("models");
    
    Ok(ModelPaths {
        resource_dir: resource_models.to_string_lossy().to_string(),
        app_data_dir: app_data_models.to_string_lossy().to_string(),
        resource_exists: resource_models.exists(),
        app_data_exists: app_data_models.exists(),
    })
}

// Keep your existing transcribe_audio, transcribe_audio_with_timestamps, etc.
#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    audio_path: String,
    language: Option<String>,
) -> Result<String, String> {
    let state = app.state::<TranscriptionState>();
    
    let model_loaded = *state.model_loaded.lock().unwrap();
    if !model_loaded {
        return Err("Whisper model not loaded. Call initialize_whisper first.".to_string());
    }
    
    let mut reader = hound::WavReader::open(&audio_path)
        .map_err(|e| format!("Failed to open WAV: {}", e))?;
    
    let spec = reader.spec();
    
    if spec.sample_rate != 16000 {
        return Err(format!(
            "Audio must be 16kHz sample rate, got {}Hz. Please resample the audio.",
            spec.sample_rate
        ));
    }
    
    let audio_data: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| s.unwrap_or(0) as f32 / i16::MAX as f32)
        .collect();
    
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    
    if let Some(ref lang) = language {
        params.set_language(Some(lang.as_str()));
    }
    
    params.set_translate(false);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_n_threads(4);
    
    let ctx_guard = state.whisper_ctx.lock().unwrap();
    let ctx = ctx_guard.as_ref().ok_or("Whisper context not available")?;
    
    let mut whisper_state = ctx.create_state()
        .map_err(|e| format!("Failed to create state: {:?}", e))?;
    
    whisper_state.full(params, &audio_data)
        .map_err(|e| format!("Transcription failed: {:?}", e))?;
    
    let num_segments = whisper_state.full_n_segments()
        .map_err(|e| format!("Failed to get segments: {:?}", e))?;
    
    let mut transcription = String::new();
    for i in 0..num_segments {
        let segment = whisper_state.full_get_segment_text(i)
            .map_err(|e| format!("Failed to get segment: {:?}", e))?;
        transcription.push_str(&segment);
    }
    
    Ok(transcription.trim().to_string())
}

#[tauri::command]
pub async fn transcribe_audio_with_timestamps(
    app: AppHandle,
    audio_path: String,
    language: Option<String>,
) -> Result<Vec<TranscriptionSegment>, String> {
    let state = app.state::<TranscriptionState>();
    
    let model_loaded = *state.model_loaded.lock().unwrap();
    if !model_loaded {
        return Err("Whisper model not loaded. Call initialize_whisper first.".to_string());
    }
    
    let mut reader = hound::WavReader::open(&audio_path)
        .map_err(|e| format!("Failed to open WAV: {}", e))?;
    
    let spec = reader.spec();
    if spec.sample_rate != 16000 {
        return Err(format!("Audio must be 16kHz, got {}Hz", spec.sample_rate));
    }
    
    let audio_data: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| s.unwrap_or(0) as f32 / i16::MAX as f32)
        .collect();
    
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    
    if let Some(ref lang) = language {
        params.set_language(Some(lang.as_str()));
    }
    
    params.set_translate(false);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(true);
    params.set_n_threads(4);
    
    let ctx_guard = state.whisper_ctx.lock().unwrap();
    let ctx = ctx_guard.as_ref().ok_or("Whisper context not available")?;
    
    let mut whisper_state = ctx.create_state()
        .map_err(|e| format!("Failed to create state: {:?}", e))?;
    
    whisper_state.full(params, &audio_data)
        .map_err(|e| format!("Transcription failed: {:?}", e))?;
    
    let num_segments = whisper_state.full_n_segments()
        .map_err(|e| format!("Failed to get segments: {:?}", e))?;
    
    let mut segments = Vec::new();
    for i in 0..num_segments {
        let text = whisper_state.full_get_segment_text(i)
            .map_err(|e| format!("Failed to get segment: {:?}", e))?;
        let start = whisper_state.full_get_segment_t0(i)
            .map_err(|e| format!("Failed to get start time: {:?}", e))?;
        let end = whisper_state.full_get_segment_t1(i)
            .map_err(|e| format!("Failed to get end time: {:?}", e))?;
        
        segments.push(TranscriptionSegment {
            text: text.trim().to_string(),
            start: start as f64 / 100.0,
            end: end as f64 / 100.0,
        });
    }
    
    Ok(segments)
}

#[tauri::command]
pub async fn check_whisper_status(app: AppHandle) -> Result<WhisperStatus, String> {
    let state = app.state::<TranscriptionState>();
    let model_loaded = *state.model_loaded.lock().unwrap();
    
    Ok(WhisperStatus {
        initialized: model_loaded,
        model_path: if model_loaded {
            Some("Model loaded".to_string())
        } else {
            None
        },
    })
}

#[tauri::command]
pub async fn get_model_path(app: AppHandle) -> Result<String, String> {
    // Return project root models path if it exists, otherwise fallback to app data
    if let Some(project_root) = find_project_root() {
        let project_model_dir = project_root.join("models");
        if project_model_dir.exists() {
            return Ok(project_model_dir.to_string_lossy().to_string());
        }
    }
    
    // Fallback to app data directory
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let model_dir = app_data_dir.join("models");
    Ok(model_dir.to_string_lossy().to_string())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct TranscriptionSegment {
    pub text: String,
    pub start: f64,
    pub end: f64,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct WhisperStatus {
    pub initialized: bool,
    pub model_path: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ModelPaths {
    pub resource_dir: String,
    pub app_data_dir: String,
    pub resource_exists: bool,
    pub app_data_exists: bool,
}