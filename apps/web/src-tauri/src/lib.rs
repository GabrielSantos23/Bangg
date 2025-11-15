use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri::{Emitter, WebviewUrl, WebviewWindowBuilder, Window};
use tauri_plugin_oauth::OauthConfig;
use tauri_plugin_opener;
use tauri_plugin_posthog::{init as posthog_init, PostHogConfig, PostHogOptions};
use tauri_plugin_shell;
use tokio::task::JoinHandle;

// === Modules ===
mod audio_utils;
mod capture;
mod login;
mod realtime_transcription; // <-- your real-time whisper logic
mod shortcuts;
mod system_audio_transcription;
mod transcription;
mod window; // <-- new real-time system audio transcription

// === Imports ===
use capture::CaptureState;
pub use login::{login_with_provider, UserInfo};
use realtime_transcription::{start_transcription, stop_transcription, RealtimeState};
use system_audio_transcription::{
    start_system_audio_recording, start_system_audio_transcription,
    stop_system_audio_recording_and_transcribe, stop_system_audio_transcription,
    SystemAudioRecordingState, SystemAudioTranscriptionState,
};

// === States ===
#[derive(Default)]
pub struct AudioState {
    stream_task: Arc<Mutex<Option<JoinHandle<()>>>>,
    is_capturing: Arc<Mutex<bool>>,
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn start_oauth_server(window: Window) -> Result<u16, String> {
    let config = OauthConfig {
        ports: Some(vec![8000, 8001, 8002]),
        response: Some("Login successful. You can close this window.".into()),
    };
    tauri_plugin_oauth::start_with_config(config, move |url| {
        let _ = window.emit("oauth_redirect", url);
    })
    .map_err(|err| err.to_string())
}

#[derive(Serialize, Clone)]
struct OpenChatPayload {
    chat_id: String,
}

#[tauri::command]
fn show_menu_window_and_emit(app: tauri::AppHandle, chat_id: String) -> Result<(), String> {
    // Get the menu window (it should already exist from config)
    let menu_window = app
        .get_webview_window("menu")
        .ok_or("Menu window not found")?;

    // Show and focus the menu window
    menu_window
        .show()
        .map_err(|e| format!("Failed to show menu window: {}", e))?;
    menu_window
        .set_focus()
        .map_err(|e| format!("Failed to focus menu window: {}", e))?;

    // Small delay to ensure the window is ready
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Emit the open-chat event
    let payload = OpenChatPayload { chat_id };
    menu_window
        .emit("open-chat", payload)
        .map_err(|e| format!("Failed to emit open-chat event: {}", e))?;

    Ok(())
}

#[tauri::command]
fn show_menu_window(app: tauri::AppHandle) -> Result<(), String> {
    // Get the menu window (it should already exist from config)
    let menu_window = app
        .get_webview_window("menu")
        .ok_or("Menu window not found")?;

    // Show and focus the menu window
    menu_window
        .show()
        .map_err(|e| format!("Failed to show menu window: {}", e))?;
    menu_window
        .set_focus()
        .map_err(|e| format!("Failed to focus menu window: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let posthog_api_key = option_env!("POSTHOG_API_KEY").unwrap_or("").to_string();

    tauri::Builder::default()
        // === Plugins ===
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("AI-Overlay")
                .args(["--flag1"])
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_keychain::init())
        .plugin(tauri_plugin_machine_uid::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(posthog_init(PostHogConfig {
            api_key: posthog_api_key,
            options: Some(PostHogOptions {
                disable_session_recording: Some(true),
                capture_pageview: Some(false),
                capture_pageleave: Some(false),
                ..Default::default()
            }),
            ..Default::default()
        }))
        // === States ===
        .manage(AudioState::default())
        .manage(CaptureState::default())
        .manage(transcription::TranscriptionState::default())
        .manage(RealtimeState::default())
        .manage(SystemAudioTranscriptionState::default())
        .manage(SystemAudioRecordingState::default())
        .manage(shortcuts::WindowVisibility {
            is_hidden: Mutex::new(false),
        })
        .manage(shortcuts::RegisteredShortcuts::default())
        // === Commands ===
        .invoke_handler(tauri::generate_handler![
            // Auth & capture
            start_oauth_server,
            show_menu_window_and_emit,
            show_menu_window,
            login::login_with_provider,
            capture::capture_to_base64,
            capture::start_screen_capture,
            capture::capture_selected_area,
            capture::close_overlay_window,
            window::set_window_height,
            // Whisper-related (static transcription)
            transcription::initialize_whisper,
            transcription::transcribe_audio,
            transcription::transcribe_audio_with_timestamps,
            transcription::check_whisper_status,
            transcription::get_model_paths,
            transcription::get_model_path,
            // Real-time transcription
            start_transcription,
            stop_transcription,
            // System audio real-time transcription
            start_system_audio_transcription,
            stop_system_audio_transcription,
            // System audio recording (non-real-time)
            start_system_audio_recording,
            stop_system_audio_recording_and_transcribe,
            // Audio file utils
            audio_utils::save_audio_buffer,
            audio_utils::cleanup_audio_file,
            audio_utils::list_audio_files,
        ])
        // === Run ===
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
