// Real-time system audio transcription using Whisper.cpp
// Captures desktop/system audio and transcribes it in real-time

use std::collections::VecDeque;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State, Window};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};
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

#[cfg(target_os = "windows")]
use wasapi::{get_default_device, Direction, SampleType, StreamMode, WaveFormat};

#[derive(Default)]
pub struct SystemAudioTranscriptionState {
    running: Arc<Mutex<bool>>,
}

#[derive(Default)]
pub struct SystemAudioRecordingState {
    recording: Arc<Mutex<bool>>,
    audio_buffer: Arc<Mutex<Vec<f32>>>,
    sample_rate: Arc<Mutex<Option<u32>>>,
}

/// Start real-time system audio transcription
#[tauri::command]
pub async fn start_system_audio_transcription(
    app: AppHandle,
    window: Window,
    state: State<'_, SystemAudioTranscriptionState>,
) -> Result<(), String> {
    let mut running = state.running.lock().unwrap();
    if *running {
        return Err("Transcription already running".into());
    }
    *running = true;

    // Resolve model path (check project root first)
    let model_name = "ggml-base.en.bin";
    let model_path = resolve_model_path(&app, model_name)?;

    let model_path_str = model_path
        .to_str()
        .ok_or("Invalid model path")?
        .to_string();

    let window_clone = window.clone();
    let window_error = window.clone();
    let running_clone = state.running.clone();

    // Spawn transcription thread
    thread::spawn(move || {
        if let Err(err) = capture_and_transcribe_system_audio(
            window_clone,
            running_clone,
            model_path_str,
        ) {
            eprintln!("Error during system audio transcription: {:?}", err);
            let _ = window_error.emit("transcription_error", err.to_string());
        }
    });

    Ok(())
}

/// Stop real-time system audio transcription
#[tauri::command]
pub async fn stop_system_audio_transcription(
    state: State<'_, SystemAudioTranscriptionState>,
) -> Result<(), String> {
    let mut running = state.running.lock().unwrap();
    *running = false;
    Ok(())
}

/// Main function that captures system audio and transcribes it
fn capture_and_transcribe_system_audio(
    window: Window,
    running: Arc<Mutex<bool>>,
    model_path: String,
) -> Result<()> {
    // Load Whisper model
    let ctx_params = WhisperContextParameters::default();
    let ctx = WhisperContext::new_with_params(&model_path, ctx_params)
        .map_err(|e| anyhow::anyhow!("Failed to load whisper model: {:?}", e))?;

    #[cfg(not(target_os = "windows"))]
    return Err(anyhow::anyhow!("System audio capture only supported on Windows currently"));

    // Audio buffer for accumulating samples
    let audio_buffer = Arc::new(Mutex::new(Vec::<f32>::new()));
    let buffer_clone = audio_buffer.clone();
    let running_clone = running.clone();

    // Channel to receive sample rate from capture thread
    let (init_tx, init_rx) = mpsc::channel();

    // Start audio capture in a separate thread - create handles inside thread to avoid Send issues
    #[cfg(target_os = "windows")]
    let capture_thread = thread::spawn(move || {
        let init_result = (|| -> Result<(_, _, u32)> {
            // Get default render (output) device for loopback capture
            let device = get_default_device(&Direction::Render)
                .map_err(|e| anyhow::anyhow!("Failed to get default audio device: {}", e))?;

            let mut audio_client = device
                .get_iaudioclient()
                .map_err(|e| anyhow::anyhow!("Failed to get audio client: {}", e))?;

            let device_format = audio_client
                .get_mixformat()
                .map_err(|e| anyhow::anyhow!("Failed to get mix format: {}", e))?;
            let sample_rate = device_format.get_samplespersec();

            // Request float32 format for easier processing
            let desired_format = WaveFormat::new(
                32,
                32,
                &SampleType::Float,
                sample_rate as usize,
                1, // Mono
                None,
            );

            let (_def_time, min_time) = audio_client
                .get_device_period()
                .map_err(|e| anyhow::anyhow!("Failed to get device period: {}", e))?;

            let mode = StreamMode::EventsShared {
                autoconvert: true,
                buffer_duration_hns: min_time,
            };

            audio_client
                .initialize_client(&desired_format, &Direction::Capture, &mode)
                .map_err(|e| anyhow::anyhow!("Failed to initialize audio client: {}", e))?;

            let event_handle = audio_client
                .set_get_eventhandle()
                .map_err(|e| anyhow::anyhow!("Failed to set event handle: {}", e))?;

            let capture_client = audio_client
                .get_audiocaptureclient()
                .map_err(|e| anyhow::anyhow!("Failed to get capture client: {}", e))?;

            audio_client
                .start_stream()
                .map_err(|e| anyhow::anyhow!("Failed to start stream: {}", e))?;

            Ok((event_handle, capture_client, sample_rate))
        })();

        match init_result {
            Ok((event_handle, mut capture_client, sample_rate)) => {
                let _ = init_tx.send(Ok(sample_rate));

                loop {
                    // Check if we should stop
                    if !*running_clone.lock().unwrap() {
                        break;
                    }

                    // Wait for audio data (with shorter timeout to check stop more frequently)
                    if event_handle.wait_for_event(100).is_err() {
                        // Check again if we should stop after timeout
                        if !*running_clone.lock().unwrap() {
                            break;
                        }
                        continue;
                    }

                    // Read audio data
                    let mut temp_queue = VecDeque::new();
                    if capture_client
                        .read_from_device_to_deque(&mut temp_queue)
                        .is_err()
                    {
                        continue;
                    }

                    if temp_queue.is_empty() {
                        continue;
                    }

                    // Convert bytes to f32 samples
                    let mut samples = Vec::new();
                    while temp_queue.len() >= 4 {
                        let bytes = [
                            temp_queue.pop_front().unwrap(),
                            temp_queue.pop_front().unwrap(),
                            temp_queue.pop_front().unwrap(),
                            temp_queue.pop_front().unwrap(),
                        ];
                        let sample = f32::from_le_bytes(bytes);
                        samples.push(sample);
                    }

                    // Add samples to buffer
                    if !samples.is_empty() {
                        let mut buf = buffer_clone.lock().unwrap();
                        buf.extend(samples);

                        // Limit buffer size (keep last 30 seconds at 48kHz)
                        let max_samples = 30 * 48000;
                        if buf.len() > max_samples {
                            let to_remove = buf.len() - max_samples;
                            buf.drain(0..to_remove);
                        }
                    }
                }
            }
            Err(e) => {
                let _ = init_tx.send(Err(e));
            }
        }
    });

    // Get sample rate from capture thread
    #[cfg(target_os = "windows")]
    let sample_rate = match init_rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(rate)) => rate,
        Ok(Err(e)) => {
            return Err(anyhow::anyhow!("Failed to initialize audio capture: {}", e));
        }
        Err(_) => {
            return Err(anyhow::anyhow!("Audio initialization timeout"));
        }
    };

    // Transcription loop - process audio chunks every 3 seconds
    const CHUNK_DURATION_SECS: u32 = 3;
    const TARGET_SAMPLE_RATE: u32 = 16000; // Whisper requires 16kHz
    const SILENCE_THRESHOLD: f32 = 0.01; // Minimum audio level to process
    const PROCESSING_INTERVAL_MS: u64 = 1000; // Process every 1 second
    const SILENCE_DELAY_MS: u64 = 3000; // Wait 3 seconds of complete silence before displaying

    let mut last_processed_samples = 0;
    let mut last_displayed_chunk = String::new(); // Track last displayed chunk to avoid duplicates
    let mut last_audio_time = std::time::Instant::now();
    let mut accumulated_chunk = String::new(); // Accumulate all text into a chunk
    let mut silence_start_time: Option<std::time::Instant> = None; // Track when silence started
    let mut chunk_displayed = false; // Track if current chunk was already displayed

    while *running.lock().unwrap() {
        // Check every PROCESSING_INTERVAL_MS for stop signal and processing
        thread::sleep(Duration::from_millis(PROCESSING_INTERVAL_MS));
        
        // Check if we should stop before processing
        if !*running.lock().unwrap() {
            break;
        }

        let mut buffer = audio_buffer.lock().unwrap();
        let current_samples = buffer.len();

        // Helper function to check and display chunk after silence
        let check_and_display_chunk = |accumulated_chunk: &mut String,
                                       silence_start_time: &mut Option<std::time::Instant>,
                                       chunk_displayed: &mut bool,
                                       last_displayed_chunk: &mut String| {
            if let Some(silence_start) = *silence_start_time {
                if silence_start.elapsed().as_millis() >= SILENCE_DELAY_MS as u128 {
                    if !accumulated_chunk.is_empty() 
                        && !*chunk_displayed {
                        // Normalize both chunks for comparison (trim and lowercase)
                        let current_normalized = accumulated_chunk.trim().to_lowercase();
                        let last_normalized = last_displayed_chunk.trim().to_lowercase();
                        
                        // Only display if it's different from last displayed chunk
                        if current_normalized != last_normalized {
                            let chunk_to_display = accumulated_chunk.trim().to_string();
                            // Clear accumulated chunk and mark as displayed
                            accumulated_chunk.clear();
                            *silence_start_time = None;
                            *chunk_displayed = true;
                            *last_displayed_chunk = chunk_to_display.clone();
                            return Some(chunk_to_display);
                        } else {
                            // Same chunk, just clear it without displaying
                            accumulated_chunk.clear();
                            *silence_start_time = None;
                            *chunk_displayed = true;
                        }
                    }
                }
            } else if !accumulated_chunk.is_empty() && !*chunk_displayed {
                // Start tracking silence - this is the first moment of silence
                *silence_start_time = Some(std::time::Instant::now());
            }
            None
        };

        // Need at least CHUNK_DURATION_SECS of audio
        let min_samples = (sample_rate * CHUNK_DURATION_SECS) as usize;
        if current_samples < min_samples {
            drop(buffer);
            // Check if we should display accumulated chunk after 3 seconds of silence
            if let Some(chunk_to_display) = check_and_display_chunk(
                &mut accumulated_chunk,
                &mut silence_start_time,
                &mut chunk_displayed,
                &mut last_displayed_chunk,
            ) {
                let _ = window.emit("system_audio_transcription", &chunk_to_display);
            }
            continue;
        }

        // Only process NEW audio (no overlap to avoid duplicates)
        let new_samples = current_samples - last_processed_samples;
        if new_samples < min_samples {
            drop(buffer);
            // Check if we should display accumulated chunk after 3 seconds of silence
            if let Some(chunk_to_display) = check_and_display_chunk(
                &mut accumulated_chunk,
                &mut silence_start_time,
                &mut chunk_displayed,
                &mut last_displayed_chunk,
            ) {
                let _ = window.emit("system_audio_transcription", &chunk_to_display);
            }
            continue;
        }

        // Take only new audio chunk (from last_processed_samples to current)
        let chunk: Vec<f32> = buffer[last_processed_samples..current_samples].to_vec();

        // Update last processed position
        last_processed_samples = current_samples;

        // Limit buffer size to prevent unbounded growth
        if current_samples > (sample_rate * 10) as usize {
            // Keep only last 10 seconds
            let keep_samples = (sample_rate * 10) as usize;
            buffer.drain(0..(current_samples - keep_samples));
            last_processed_samples = keep_samples;
        }

        drop(buffer); // Release lock before transcription

        // Process audio chunk
        if !chunk.is_empty() {
            // Check if audio has sufficient energy (not silence)
            let max_amplitude = chunk.iter().map(|&x| x.abs()).fold(0.0f32, f32::max);
            if max_amplitude < SILENCE_THRESHOLD {
                // Audio is too quiet (silence detected)
                // Check if we should display accumulated chunk after 3 seconds of silence
                if let Some(chunk_to_display) = check_and_display_chunk(
                    &mut accumulated_chunk,
                    &mut silence_start_time,
                    &mut chunk_displayed,
                    &mut last_displayed_chunk,
                ) {
                    let _ = window.emit("system_audio_transcription", &chunk_to_display);
                }
                continue;
            }

            // Audio detected - reset silence tracking
            // If we've already displayed a chunk, start accumulating a NEW chunk
            if chunk_displayed {
                // Previous chunk was displayed, start fresh for new chunk
                chunk_displayed = false;
                accumulated_chunk.clear(); // Clear to start fresh chunk
                last_displayed_chunk.clear(); // Reset last displayed for new session
            }
            // Always reset silence tracking when audio is detected
            silence_start_time = None;
            last_audio_time = std::time::Instant::now();

            // Resample to 16kHz if needed
            let processed_chunk = if sample_rate != TARGET_SAMPLE_RATE {
                resample_audio(&chunk, sample_rate, TARGET_SAMPLE_RATE)
            } else {
                chunk
            };

            // Normalize audio
            let normalized_chunk = normalize_audio(&processed_chunk);

            // Transcribe and accumulate into chunk (don't emit immediately)
            // Don't pass last_transcribed_text here - we want to accumulate all unique segments
            if let Ok(text) = transcribe_chunk_silent(&ctx, &normalized_chunk) {
                if !text.is_empty() && !is_repetitive(&text) {
                    // Check if this text is already in accumulated_chunk to avoid duplicates
                    let text_trimmed = text.trim();
                    let accumulated_lower = accumulated_chunk.to_lowercase();
                    let text_lower = text_trimmed.to_lowercase();
                    
                    // Only add if the entire text segment is not already in accumulated chunk
                    // Check if accumulated chunk ends with this text (most common case)
                    // or contains it as a complete phrase
                    let is_duplicate = if accumulated_chunk.is_empty() {
                        false
                    } else {
                        // Check if accumulated chunk ends with this text
                        accumulated_lower.ends_with(&text_lower) ||
                        // Or check if accumulated chunk contains this text as a complete word/phrase
                        (accumulated_lower.contains(&text_lower) && text_lower.len() > 5)
                    };
                    
                    if !is_duplicate {
                        // Accumulate text into chunk
                        if !accumulated_chunk.is_empty() {
                            accumulated_chunk.push(' ');
                        }
                        accumulated_chunk.push_str(text_trimmed);
                    }
                }
            }
        }
    }

    // Display any accumulated chunk when stopping (if not already displayed)
    if !accumulated_chunk.is_empty() 
        && !chunk_displayed {
        // Normalize both chunks for comparison
        let current_normalized = accumulated_chunk.trim().to_lowercase();
        let last_normalized = last_displayed_chunk.trim().to_lowercase();
        
        if current_normalized != last_normalized {
            let _ = window.emit("system_audio_transcription", &accumulated_chunk.trim());
        }
    }

    // Wait for capture thread to finish
    let _ = capture_thread.join();

    // Emit stop event to frontend
    let _ = window.emit("system_audio_transcription_stopped", ());

    Ok(())
}

/// Transcribe an audio chunk using Whisper (silent version - returns text instead of emitting)
fn transcribe_chunk_silent(
    ctx: &WhisperContext,
    audio_samples: &[f32],
) -> Result<String> {
    if audio_samples.is_empty() {
        return Ok(String::new());
    }

    // Create a new state for this chunk
    let mut state = ctx
        .create_state()
        .map_err(|e| anyhow::anyhow!("Failed to create whisper state: {:?}", e))?;

    // Configure transcription parameters for real-time use
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_translate(false);
    params.set_language(Some("en"));
    params.set_no_context(true); // No context to avoid duplicates from overlapping chunks
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_suppress_nst(true); // Suppress non-speech tokens to avoid hallucinations
    params.set_n_threads(4);
    params.set_max_len(0); // No limit

    // Process audio
    if let Ok(_) = state.full(params, audio_samples) {
        if let Ok(num_segments) = state.full_n_segments() {
            let mut all_text = String::new();
            for i in 0..num_segments {
                if let Ok(text) = state.full_get_segment_text(i) {
                    let text = text.trim();
                    // Filter out empty, very short, or special segments
                    if !text.is_empty()
                        && text.len() > 1
                        && !text.starts_with("[_TT_")
                        && !text.starts_with("[_")
                    {
                        all_text.push_str(text);
                        all_text.push(' ');
                    }
                }
            }

            let all_text = all_text.trim().to_string();

            // Filter out repetitive text only (duplicate checking happens at chunk level)
            if !all_text.is_empty()
                && !is_repetitive(&all_text)
                && all_text.len() > 2
            {
                return Ok(all_text);
            }
        }
    }

    Ok(String::new())
}

/// Check if text is repetitive (e.g., "you you you")
fn is_repetitive(text: &str) -> bool {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.len() < 3 {
        return false;
    }

    // Check if all words are the same
    if words.len() >= 3 {
        let first_word = words[0].to_lowercase();
        if words.iter().skip(1).all(|w| w.to_lowercase() == first_word) {
            return true;
        }
    }

    // Check for patterns like "word word word"
    if words.len() >= 6 {
        let mut consecutive_same = 1;
        let mut max_consecutive = 1;
        for i in 1..words.len() {
            if words[i].to_lowercase() == words[i - 1].to_lowercase() {
                consecutive_same += 1;
                max_consecutive = max_consecutive.max(consecutive_same);
            } else {
                consecutive_same = 1;
            }
        }
        // If more than 3 consecutive same words, consider it repetitive
        if max_consecutive > 3 {
            return true;
        }
    }

    false
}

/// Normalize audio to improve transcription quality
fn normalize_audio(input: &[f32]) -> Vec<f32> {
    if input.is_empty() {
        return Vec::new();
    }

    // Find maximum absolute value
    let max_val = input
        .iter()
        .map(|&x| x.abs())
        .fold(0.0f32, f32::max);

    if max_val < 1e-6 {
        // Audio is too quiet
        return input.to_vec();
    }

    // Normalize to 0.8 peak (leave headroom)
    let target_peak = 0.8;
    let scale = target_peak / max_val;

    input
        .iter()
        .map(|&x| (x * scale).clamp(-1.0, 1.0))
        .collect()
}

/// Resample audio from one sample rate to another using linear interpolation
fn resample_audio(input: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
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

/// Start recording system audio (non-real-time, for later transcription)
#[tauri::command]
pub async fn start_system_audio_recording(
    state: State<'_, SystemAudioRecordingState>,
) -> Result<(), String> {
    let mut recording = state.recording.lock().unwrap();
    if *recording {
        return Err("Recording already in progress".into());
    }
    *recording = true;
    
    // Clear previous recording
    let mut buffer = state.audio_buffer.lock().unwrap();
    buffer.clear();
    drop(buffer);
    
    #[cfg(not(target_os = "windows"))]
    return Err("System audio recording only supported on Windows currently".into());
    
    let recording_clone = state.recording.clone();
    let buffer_clone = state.audio_buffer.clone();
    let sample_rate_clone = state.sample_rate.clone();
    
    // Start recording in a separate thread
    #[cfg(target_os = "windows")]
    thread::spawn(move || {
        if let Err(e) = record_system_audio(recording_clone, buffer_clone, sample_rate_clone) {
            eprintln!("Error during system audio recording: {:?}", e);
        }
    });
    
    Ok(())
}

/// Stop recording system audio and return the transcription segments with timestamps
#[tauri::command]
pub async fn stop_system_audio_recording_and_transcribe(
    app: AppHandle,
    state: State<'_, SystemAudioRecordingState>,
) -> Result<Vec<TranscriptionSegment>, String> {
    // Stop recording
    let mut recording = state.recording.lock().unwrap();
    *recording = false;
    drop(recording);
    
    // Wait a bit for the recording thread to finish
    thread::sleep(Duration::from_millis(500));
    
    // Get recorded audio and sample rate
    let buffer = state.audio_buffer.lock().unwrap();
    let audio_samples = buffer.clone();
    drop(buffer);
    
    let sample_rate_guard = state.sample_rate.lock().unwrap();
    let sample_rate = sample_rate_guard.unwrap_or(48000); // Default to 48kHz if not set
    drop(sample_rate_guard);
    
    if audio_samples.is_empty() {
        return Err("No audio was recorded".into());
    }
    
    // Resolve model path (check project root first)
    let model_name = "ggml-base.en.bin";
    let model_path = resolve_model_path(&app, model_name)?;
    
    let model_path_str = model_path
        .to_str()
        .ok_or("Invalid model path")?
        .to_string();
    
    // Transcribe the recorded audio and return segments with timestamps
    transcribe_recorded_audio(&model_path_str, &audio_samples, sample_rate)
        .map_err(|e| format!("Transcription failed: {}", e))
}

/// Record system audio to buffer
#[cfg(target_os = "windows")]
fn record_system_audio(
    recording: Arc<Mutex<bool>>,
    audio_buffer: Arc<Mutex<Vec<f32>>>,
    sample_rate: Arc<Mutex<Option<u32>>>,
) -> Result<()> {
    let init_result = (|| -> Result<(_, _, u32)> {
        // Get default render (output) device for loopback capture
        let device = get_default_device(&Direction::Render)
            .map_err(|e| anyhow::anyhow!("Failed to get default audio device: {}", e))?;
        
        let mut audio_client = device
            .get_iaudioclient()
            .map_err(|e| anyhow::anyhow!("Failed to get audio client: {}", e))?;
        
        let device_format = audio_client
            .get_mixformat()
            .map_err(|e| anyhow::anyhow!("Failed to get mix format: {}", e))?;
        let sample_rate = device_format.get_samplespersec();
        
        // Request float32 format for easier processing
        let desired_format = WaveFormat::new(
            32,
            32,
            &SampleType::Float,
            sample_rate as usize,
            1, // Mono
            None,
        );
        
        let (_def_time, min_time) = audio_client
            .get_device_period()
            .map_err(|e| anyhow::anyhow!("Failed to get device period: {}", e))?;
        
        let mode = StreamMode::EventsShared {
            autoconvert: true,
            buffer_duration_hns: min_time,
        };
        
        audio_client
            .initialize_client(&desired_format, &Direction::Capture, &mode)
            .map_err(|e| anyhow::anyhow!("Failed to initialize audio client: {}", e))?;
        
        let event_handle = audio_client
            .set_get_eventhandle()
            .map_err(|e| anyhow::anyhow!("Failed to set event handle: {}", e))?;
        
        let capture_client = audio_client
            .get_audiocaptureclient()
            .map_err(|e| anyhow::anyhow!("Failed to get capture client: {}", e))?;
        
        audio_client
            .start_stream()
            .map_err(|e| anyhow::anyhow!("Failed to start stream: {}", e))?;
        
        Ok((event_handle, capture_client, sample_rate))
    })();
    
    match init_result {
        Ok((event_handle, mut capture_client, sample_rate_value)) => {
            // Store sample rate
            let mut sr = sample_rate.lock().unwrap();
            *sr = Some(sample_rate_value);
            drop(sr);
            loop {
                // Check if we should stop
                if !*recording.lock().unwrap() {
                    break;
                }
                
                // Wait for audio data
                if event_handle.wait_for_event(100).is_err() {
                    if !*recording.lock().unwrap() {
                        break;
                    }
                    continue;
                }
                
                // Read audio data
                let mut temp_queue = VecDeque::new();
                if capture_client
                    .read_from_device_to_deque(&mut temp_queue)
                    .is_err()
                {
                    continue;
                }
                
                if temp_queue.is_empty() {
                    continue;
                }
                
                // Convert bytes to f32 samples
                let mut samples = Vec::new();
                while temp_queue.len() >= 4 {
                    let bytes = [
                        temp_queue.pop_front().unwrap(),
                        temp_queue.pop_front().unwrap(),
                        temp_queue.pop_front().unwrap(),
                        temp_queue.pop_front().unwrap(),
                    ];
                    let sample = f32::from_le_bytes(bytes);
                    samples.push(sample);
                }
                
                // Add samples to buffer
                if !samples.is_empty() {
                    let mut buf = audio_buffer.lock().unwrap();
                    buf.extend(samples);
                }
            }
        }
        Err(e) => {
            return Err(anyhow::anyhow!("Failed to initialize audio capture: {}", e));
        }
    }
    
    Ok(())
}

/// Transcription segment with timestamps
#[derive(serde::Serialize, serde::Deserialize)]
pub struct TranscriptionSegment {
    pub text: String,
    pub start: f64,
    pub end: f64,
}

/// Transcribe recorded audio and return segments with timestamps
fn transcribe_recorded_audio(
    model_path: &str,
    audio_samples: &[f32],
    sample_rate: u32,
) -> Result<Vec<TranscriptionSegment>> {
    if audio_samples.is_empty() {
        return Ok(Vec::new());
    }
    
    // Load Whisper model
    let ctx_params = WhisperContextParameters::default();
    let ctx = WhisperContext::new_with_params(model_path, ctx_params)
        .map_err(|e| anyhow::anyhow!("Failed to load whisper model: {:?}", e))?;
    
    // Resample to 16kHz if needed
    const TARGET_SAMPLE_RATE: u32 = 16000;
    let processed_samples = if sample_rate != TARGET_SAMPLE_RATE {
        resample_audio(audio_samples, sample_rate, TARGET_SAMPLE_RATE)
    } else {
        audio_samples.to_vec()
    };
    
    // Normalize audio
    let normalized_samples = normalize_audio(&processed_samples);
    
    // Create state and transcribe
    let mut state = ctx
        .create_state()
        .map_err(|e| anyhow::anyhow!("Failed to create whisper state: {:?}", e))?;
    
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_translate(false);
    params.set_language(Some("en"));
    params.set_no_context(false); // Use context for better accuracy
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_suppress_nst(true);
    params.set_n_threads(4);
    params.set_max_len(0);
    
    // Process audio
    state.full(params, &normalized_samples)
        .map_err(|e| anyhow::anyhow!("Failed to transcribe audio: {:?}", e))?;
    
    // Collect all segments with timestamps
    let num_segments = state.full_n_segments()
        .map_err(|e| anyhow::anyhow!("Failed to get segment count: {:?}", e))?;
    
    let mut segments = Vec::new();
    for i in 0..num_segments {
        if let Ok(text) = state.full_get_segment_text(i) {
            let text = text.trim();
            if !text.is_empty()
                && text.len() > 1
                && !text.starts_with("[_TT_")
                && !text.starts_with("[_")
            {
                // Get timestamps for this segment
                let start = state.full_get_segment_t0(i)
                    .map_err(|e| anyhow::anyhow!("Failed to get start time: {:?}", e))?;
                let end = state.full_get_segment_t1(i)
                    .map_err(|e| anyhow::anyhow!("Failed to get end time: {:?}", e))?;
                
                segments.push(TranscriptionSegment {
                    text: text.to_string(),
                    start: start as f64 / 100.0, // Convert from centiseconds to seconds
                    end: end as f64 / 100.0,     // Convert from centiseconds to seconds
                });
            }
        }
    }
    
    Ok(segments)
}

