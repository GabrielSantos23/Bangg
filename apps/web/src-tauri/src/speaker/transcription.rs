use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use hound::WavReader;
use std::io::Cursor;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use once_cell::sync::Lazy;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};
use tracing::info;

/// Find the project root directory by looking for common markers
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
            
            // Also check if models folder exists with the model file (this is a strong indicator)
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

// Global Whisper context cache (lazy loaded)
// Note: WhisperContext is not Send/Sync, so we keep it in a Mutex
static WHISPER_CONTEXT: Lazy<Arc<Mutex<Option<WhisperContext>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

/// Get or initialize the Whisper context
/// Model will be loaded on first use if present
fn get_whisper_context() -> Result<(), String> {
    let mut ctx_guard = WHISPER_CONTEXT
        .lock()
        .map_err(|e| format!("Failed to acquire whisper context lock: {}", e))?;

    if ctx_guard.is_some() {
        return Ok(());
    }

    // Try to find model in common locations
    // First, try to find project root and check models folder there
    let project_root = find_project_root();
    
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));
    
    let current_dir = std::env::current_dir().ok();
    
    let model_paths = [
        // FIRST: Check in project root models folder (highest priority)
        project_root.as_ref().map(|p| p.join("models").join("ggml-base.en.bin")),
        // Check in app data directory
        dirs::data_local_dir()
            .map(|p| p.join("bangg").join("whisper").join("ggml-base.en.bin")),
        // Check relative to executable
        exe_dir.as_ref().map(|p| p.join("models").join("ggml-base.en.bin")),
        exe_dir.as_ref().map(|p| p.join("resources").join("ggml-base.en.bin")),
        // Check in current directory (when running from project directory)
        current_dir.as_ref().map(|p| p.join("models").join("ggml-base.en.bin")),
        current_dir.as_ref().map(|p| p.join("src-tauri").join("models").join("ggml-base.en.bin")),
        // Check in current directory (relative path)
        Some(std::path::PathBuf::from("models").join("ggml-base.en.bin")),
        Some(std::path::PathBuf::from("resources").join("ggml-base.en.bin")),
        // Check parent directory (in case we're in src-tauri)
        current_dir.as_ref().and_then(|p| p.parent().map(|p| p.join("models").join("ggml-base.en.bin"))),
    ];

    let model_path = model_paths
        .iter()
        .flatten()
        .find(|p| {
            let exists = p.exists();
            if !exists {
                info!("Model not found at: {:?}", p);
            }
            exists
        })
        .ok_or_else(|| {
            let checked_paths: Vec<String> = model_paths
                .iter()
                .flatten()
                .map(|p| format!("  - {:?}", p))
                .collect();
            
            format!(
                "Whisper model not found. Please download ggml-base.en.bin from:\n\
                https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin\n\n\
                Checked locations:\n{}\n\n\
                Current directory: {:?}\n\
                Executable directory: {:?}\n\n\
                Place the model in one of these locations:\n\
                - {}\n\
                - ./models/ggml-base.en.bin (project root)\n\
                - ./resources/ggml-base.en.bin",
                checked_paths.join("\n"),
                std::env::current_dir().unwrap_or_default(),
                exe_dir,
                dirs::data_local_dir()
                    .map(|p| p.join("bangg").join("whisper").join("ggml-base.en.bin").display().to_string())
                    .unwrap_or_else(|| "AppData/Local/bangg/whisper/ggml-base.en.bin".to_string())
            )
        })?;

    info!("Loading Whisper model from: {:?}", model_path);

    let params = WhisperContextParameters::default();
    let ctx = WhisperContext::new_with_params(&model_path.to_string_lossy(), params)
        .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

    *ctx_guard = Some(ctx);
    
    info!("Whisper model loaded successfully");
    Ok(())
}

/// Convert WAV bytes to f32 samples
fn wav_to_samples(wav_data: &[u8]) -> Result<(Vec<f32>, u32), String> {
    let cursor = Cursor::new(wav_data);
    let mut reader = WavReader::new(cursor)
        .map_err(|e| format!("Failed to read WAV file: {}", e))?;

    let spec = reader.spec();
    let sample_rate = spec.sample_rate;

    // Convert samples to f32
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => {
            reader
                .samples::<f32>()
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("Failed to read float samples: {}", e))?
        }
        hound::SampleFormat::Int => {
            // Convert integer samples to float
            let bits = spec.bits_per_sample;
            let max_val = (1i64 << (bits - 1)) as f32;
            
            match bits {
                16 => reader
                    .samples::<i16>()
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| format!("Failed to read int16 samples: {}", e))?
                    .into_iter()
                    .map(|s| s as f32 / max_val)
                    .collect(),
                32 => reader
                    .samples::<i32>()
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| format!("Failed to read int32 samples: {}", e))?
                    .into_iter()
                    .map(|s| s as f32 / max_val)
                    .collect(),
                _ => return Err(format!("Unsupported bit depth: {}", bits)),
            }
        }
    };

    // Convert stereo to mono if needed
    let mono_samples = if spec.channels == 2 {
        samples
            .chunks(2)
            .map(|chunk| (chunk[0] + chunk[1]) / 2.0)
            .collect()
    } else {
        samples
    };

    Ok((mono_samples, sample_rate))
}

/// Transcribe audio locally using Whisper
#[tauri::command]
pub async fn transcribe_audio_local(
    audio_base64: String,
) -> Result<String, String> {
    // Decode the base64 audio (WAV format)
    let audio_data = B64
        .decode(audio_base64)
        .map_err(|e| format!("Failed to decode base64 audio: {}", e))?;

    // Convert WAV to f32 samples
    let (samples, sample_rate) = wav_to_samples(&audio_data)?;

    if samples.is_empty() {
        return Err("Audio file is empty".to_string());
    }

    info!(
        "Transcribing audio: {} samples, {} Hz sample rate",
        samples.len(),
        sample_rate
    );

    // Get Whisper context (ensure it's loaded)
    get_whisper_context()?;

    // Create state for this transcription (must be done within the lock)
    let mut state = {
        let ctx_guard = WHISPER_CONTEXT
            .lock()
            .map_err(|e| format!("Failed to acquire whisper context lock: {}", e))?;
        
        let ctx = ctx_guard
            .as_ref()
            .ok_or_else(|| "Whisper context not initialized".to_string())?;
        
        ctx.create_state()
            .map_err(|e| format!("Failed to create Whisper state: {}", e))?
    };

    // Configure parameters
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_translate(false);
    params.set_language(Some("en"));
    params.set_n_threads((num_cpus::get().min(4)) as i32); // Use up to 4 threads
    params.set_print_progress(false);
    params.set_print_special(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_suppress_nst(true); // Suppress non-speech tokens

    // Process audio
    state
        .full(params, &samples)
        .map_err(|e| format!("Whisper processing failed: {}", e))?;

    // Get transcription result
    let num_segments = state
        .full_n_segments()
        .map_err(|e| format!("Failed to get segment count: {}", e))?;

    let mut transcription_parts = Vec::new();
    for i in 0..num_segments {
        let text = state
            .full_get_segment_text(i)
            .map_err(|e| format!("Failed to get segment {}: {}", i, e))?;
        transcription_parts.push(text);
    }

    let transcription = transcription_parts.join(" ").trim().to_string();

    if transcription.is_empty() {
        return Err("No speech detected in audio".to_string());
    }

    info!("Transcription completed: {} characters", transcription.len());
    Ok(transcription)
}

/// Check if local transcription is available
#[tauri::command]
pub fn is_local_transcription_available() -> bool {
    get_whisper_context().is_ok()
}

