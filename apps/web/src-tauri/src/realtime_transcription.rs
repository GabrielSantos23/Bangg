use std::{
    sync::{Arc, Mutex},
    thread,
    time::Duration,
    path::PathBuf,
};

use tauri::{AppHandle, Emitter, Manager, State};
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use anyhow::Result;

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

/// Resolve model path, checking bundled resources first (production), then project root (development)
fn resolve_model_path(app: &AppHandle, model_name: &str) -> Result<PathBuf, String> {
    // FIRST: Try bundled resources (for production builds - users won't need to download)
    let resource_path = app.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?
        .join("models")
        .join(model_name);
    
    if resource_path.exists() {
        return Ok(resource_path);
    }
    
    // SECOND: Try project root models folder (for development)
    if let Some(project_root) = find_project_root() {
        let project_model_path = project_root.join("models").join(model_name);
        if project_model_path.exists() {
            return Ok(project_model_path);
        }
    }
    
    // THIRD: Fallback to app data directory (for user-installed models)
    let app_data_path = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("models")
        .join(model_name);
    
    if app_data_path.exists() {
        return Ok(app_data_path);
    }
    
    // If none exist, return error with all checked paths
    Err(format!(
        "Model file not found. Searched in:\n1. Bundled resources\n2. Project root models folder\n3. {:?}\n\nFor development: Place the model in the project root: models/{}\nFor production: The model should be bundled with the app.",
        app_data_path,
        model_name
    ))
}

#[derive(Default)]
pub struct RealtimeState {
    running: Arc<Mutex<bool>>,
}

#[tauri::command]
pub async fn start_transcription(
    app: AppHandle,
    window: tauri::Window,
    state: State<'_, RealtimeState>,
) -> Result<(), String> {
    let mut running = state.running.lock().unwrap();
    if *running {
        return Err("Transcription already running".into());
    }
    *running = true;

    // Resolve model path (check project root first)
    let model_name = "ggml-base.en.bin";
    let model_path = resolve_model_path(&app, model_name)?;

    let model_path_str = model_path.to_str()
        .ok_or("Invalid model path")?
        .to_string();

    let window_clone = window.clone();
    let running_clone = state.running.clone();

    thread::spawn(move || {
        if let Err(err) = capture_and_transcribe(window_clone, running_clone, model_path_str) {
            eprintln!("Error during transcription: {:?}", err);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_transcription(state: State<'_, RealtimeState>) -> Result<(), String> {
    let mut running = state.running.lock().unwrap();
    *running = false;
    Ok(())
}

/// Capture audio from microphone and feed it to Whisper in short chunks.
fn capture_and_transcribe(
    window: tauri::Window,
    running: Arc<Mutex<bool>>,
    model_path: String,
) -> Result<()> {
    // Load whisper model
    let ctx_params = WhisperContextParameters::default();
    let ctx = WhisperContext::new_with_params(&model_path, ctx_params)
        .map_err(|e| anyhow::anyhow!("Failed to load whisper model: {:?}", e))?;

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| anyhow::anyhow!("No input device found"))?;

    // Try to get a config with 16kHz (Whisper requirement)
    let mut config = device.default_input_config()?;
    let target_sample_rate = 16000u32;

    // Try to find a config that supports 16kHz
    if let Ok(supported_configs) = device.supported_input_configs() {
        for supported in supported_configs {
            if supported.min_sample_rate().0 <= target_sample_rate
                && supported.max_sample_rate().0 >= target_sample_rate {
                config = supported.with_sample_rate(cpal::SampleRate(target_sample_rate));
                break;
            }
        }
    }

    let sample_rate = config.sample_rate().0;
    let channels = config.channels();
    let needs_resample = sample_rate != 16000;

    let audio_buffer = Arc::new(Mutex::new(Vec::<f32>::new()));
    let buffer_clone = audio_buffer.clone();
    let running_clone = running.clone();

    // Build CPAL input stream
    let stream = device.build_input_stream(
        &config.into(),
        move |data: &[f32], _| {
            let mut buffer = buffer_clone.lock().unwrap();
            buffer.extend_from_slice(data);
        },
        move |err| {
            eprintln!("Audio stream error: {}", err);
        },
        None,
    )?;

    stream.play()?;

    // Run transcription loop
    while *running_clone.lock().unwrap() {
        std::thread::sleep(Duration::from_secs(5)); // every 5s process chunk

        let mut buffer = audio_buffer.lock().unwrap();

        // Need at least 2 seconds of audio for better transcription
        let min_samples = (sample_rate * channels as u32 * 2) as usize;
        if buffer.len() < min_samples {
            drop(buffer);
            continue; // not enough audio yet
        }

        // Take last 5 seconds of audio (longer chunks work better with Whisper)
        let chunk_samples = (sample_rate * channels as u32 * 5) as usize;
        let buffer_len = buffer.len();
        let start = buffer_len.saturating_sub(chunk_samples);
        let raw_chunk: Vec<f32> = buffer[start..].to_vec();
        // Keep the buffer but limit its size to prevent unbounded growth
        if buffer_len > chunk_samples * 2 {
            let drain_start = buffer_len - chunk_samples;
            buffer.drain(0..drain_start);
        }
        drop(buffer); // Release lock before transcription

        // Convert to mono if needed
        let mono_chunk = if channels > 1 {
            raw_chunk
                .chunks(channels as usize)
                .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
                .collect::<Vec<f32>>()
        } else {
            raw_chunk
        };

        // Resample to 16kHz if needed (simple linear interpolation)
        let resampled_chunk = if needs_resample && sample_rate != 16000 {
            resample_linear(&mono_chunk, sample_rate, 16000)
        } else {
            mono_chunk
        };

        if resampled_chunk.is_empty() {
            continue;
        }

        // Normalize audio level to improve transcription quality
        let processed_chunk = normalize_audio(&resampled_chunk);

        // Create a new whisper state for each chunk to avoid state accumulation issues
        let mut whisper_state = ctx.create_state()
            .map_err(|e| anyhow::anyhow!("Failed to create whisper state: {:?}", e))?;

        // Transcribe chunk
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_translate(false);
        params.set_language(Some("en"));
        params.set_no_context(true); // No context between chunks for real-time
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_suppress_blank(true);
        params.set_suppress_nst(false); // Don't suppress non-speech tokens - let Whisper decide
        params.set_n_threads(4);
        params.set_max_len(0); // 0 = no limit, let Whisper decide segment length

        if let Ok(_) = whisper_state.full(params, &processed_chunk) {
            if let Ok(num_segments) = whisper_state.full_n_segments() {
                for i in 0..num_segments {
                    if let Ok(text) = whisper_state.full_get_segment_text(i) {
                        let text = text.trim();
                        // Filter out empty text, timestamp-only segments, and very short segments
                        // Whisper sometimes produces segments with just punctuation or timestamps
                        if !text.is_empty()
                            && text.len() > 1
                            && !text.starts_with("[_TT_")
                            && !text.starts_with("[_") {
                            let _ = window.emit("transcription_update", text);
                        }
                    }
                }
            }
        }
    }

    drop(stream);
    Ok(())
}

/// Normalize audio to a target peak level
fn normalize_audio(input: &[f32]) -> Vec<f32> {
    if input.is_empty() {
        return Vec::new();
    }

    // Find the maximum absolute value
    let max_val = input.iter()
        .map(|&x| x.abs())
        .fold(0.0f32, f32::max);

    if max_val < 1e-6 {
        // Audio is too quiet, return as-is
        return input.to_vec();
    }

    // Normalize to 0.8 peak (leave some headroom)
    let target_peak = 0.8;
    let scale = target_peak / max_val;

    input.iter().map(|&x| (x * scale).clamp(-1.0, 1.0)).collect()
}

/// Simple linear resampling from one sample rate to another
fn resample_linear(input: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate {
        return input.to_vec();
    }

    let ratio = to_rate as f64 / from_rate as f64;
    let output_len = (input.len() as f64 * ratio) as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_pos = i as f64 / ratio;
        let src_idx = src_pos as usize;
        let frac = src_pos - src_idx as f64;

        if src_idx + 1 < input.len() {
            // Linear interpolation
            let sample = input[src_idx] as f64 * (1.0 - frac) + input[src_idx + 1] as f64 * frac;
            output.push(sample as f32);
        } else if src_idx < input.len() {
            output.push(input[src_idx]);
        }
    }

    output
}
