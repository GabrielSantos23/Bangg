use serde::{Deserialize, Serialize};
use reqwest::Client;
use tauri::{AppHandle, Emitter, Runtime};
use futures_util::StreamExt;

// ----------------------
// Request Structures
// ----------------------

#[derive(Serialize)]
pub struct GeminiRequest {
    pub contents: Vec<Content>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tools: Vec<Tool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Content {
    pub role: Option<String>, // "user" or "model" (assistant)
    pub parts: Vec<Part>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Part {
    pub text: String,
}

#[derive(Serialize)]
pub struct Tool {
    pub google_search: GoogleSearch,
}

#[derive(Serialize)]
pub struct GoogleSearch {}

// ----------------------
// Response Structures
// ----------------------

#[derive(Deserialize, Serialize, Debug)]
pub struct GeminiResponse {
    pub candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Candidate {
    // Content might be missing in the final metadata-only chunk
    pub content: Option<ContentResponse>,
    #[serde(rename = "groundingMetadata")]
    pub grounding_metadata: Option<GroundingMetadata>,
    #[serde(rename = "finishReason")]
    pub finish_reason: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ContentResponse {
    #[serde(default)]
    pub parts: Vec<PartResponse>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct PartResponse {
    pub text: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct GroundingMetadata {
    #[serde(rename = "groundingChunks")]
    pub grounding_chunks: Option<Vec<GroundingChunk>>,
    #[serde(rename = "searchEntryPoint")]
    pub search_entry_point: Option<SearchEntryPoint>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct GroundingChunk {
    pub web: Option<WebSource>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct WebSource {
    pub uri: String,
    pub title: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct SearchEntryPoint {
    #[serde(rename = "renderedContent")]
    pub rendered_content: Option<String>,
}

// ----------------------
// Stream Payload Structure
// ----------------------
#[derive(Serialize, Clone)]
struct StreamPayload {
    text: Option<String>,
    is_done: bool,
    metadata: Option<GroundingMetadata>,
}

// ----------------------
// API Logic
// ----------------------

#[derive(Deserialize, Debug)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

// Helper function to process a candidate and emit events
fn process_candidate<R: Runtime>(
    app: &AppHandle<R>,
    event_name: &str,
    gemini_data: &GeminiResponse,
    enable_search: bool,
) {
    if let Some(candidates) = &gemini_data.candidates {
        if let Some(candidate) = candidates.first() {
            // Safely extract text if it exists
            let text = candidate.content.as_ref()
                .and_then(|c| c.parts.first())
                .map(|p| p.text.clone());
            
            // Safely extract metadata if it exists
            let metadata = candidate.grounding_metadata.clone();

            // Debug: log raw response when search is enabled
            if enable_search {
                if let Some(ref meta) = metadata {
                    eprintln!("[DEBUG] Found grounding metadata");
                    if let Some(ref chunks) = meta.grounding_chunks {
                        eprintln!("[DEBUG] Grounding chunks count: {}", chunks.len());
                        for (i, chunk) in chunks.iter().enumerate() {
                            if let Some(ref web) = chunk.web {
                                eprintln!("[DEBUG] Chunk {}: {} - {}", i, web.title, web.uri);
                            }
                        }
                    }
                    if meta.search_entry_point.is_some() {
                        eprintln!("[DEBUG] Found search entry point");
                    }
                }
            }

            // CRITICAL FIX: Emit if we have EITHER text OR metadata
            if text.is_some() || metadata.is_some() {
                let _ = app.emit(event_name, StreamPayload {
                    text,
                    is_done: false,
                    metadata, 
                });
            }
        }
    }
}

#[tauri::command]
pub async fn stream_gemini_request<R: Runtime>(
    app: AppHandle<R>,
    api_key: String,
    prompt: String,
    history: Option<Vec<ChatMessage>>,
    chat_id: String,
    enable_search: Option<bool>,
) -> Result<(), String> {
    let client = Client::new();
    
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key={}",
        api_key
    );

    let mut contents = Vec::new();
    
    if let Some(hist) = history {
        for msg in hist {
            let role = match msg.role.as_str() {
                "user" => "user",
                "assistant" => "model",
                _ => "user",
            };
            contents.push(Content {
                role: Some(role.to_string()),
                parts: vec![Part { text: msg.content }],
            });
        }
    }
    
    contents.push(Content {
        role: Some("user".to_string()),
        parts: vec![Part { text: prompt }],
    });

    // Only include search tool if enable_search is true
    // Note: For gemini-2.5-flash, we use google_search: {}
    // The model will automatically use it when needed for factual queries
    let tools = if enable_search.unwrap_or(false) {
        vec![Tool {
            google_search: GoogleSearch {},
        }]
    } else {
        vec![]
    };

    let payload = GeminiRequest {
        contents,
        tools,
    };

    // Debug: log the payload when search is enabled
    if enable_search.unwrap_or(false) {
        eprintln!("[DEBUG] Sending request with search enabled");
        eprintln!("[DEBUG] Tools count: {}", payload.tools.len());
        if let Ok(payload_str) = serde_json::to_string_pretty(&payload) {
            eprintln!("[DEBUG] Payload: {}", payload_str);
        }
    }

    let response = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API Error: {}", error_text));
    }

    let mut stream = response.bytes_stream();
    let event_name = format!("gemini-event-{}", chat_id);
    let mut buffer = String::new(); // Buffer to accumulate incomplete lines
    let mut current_json = String::new(); // Current JSON being accumulated
    let mut in_data_event = false; // Whether we're currently accumulating a data event

    while let Some(item) = stream.next().await {
        match item {
            Ok(bytes) => {
                let chunk_str = String::from_utf8_lossy(&bytes);
                buffer.push_str(&chunk_str);
                
                // Process buffer line by line
                loop {
                    if let Some(newline_pos) = buffer.find('\n') {
                        let line = buffer[..newline_pos].trim_end_matches('\r').to_string();
                        let remaining = buffer[newline_pos + 1..].to_string();
                        buffer = remaining;
                        
                        if line.starts_with("data: ") {
                            // Start of new data event
                            let json_part = &line[6..];
                            
                            if json_part.trim() == "[DONE]" {
                                break;
                            }
                            
                            // If we were accumulating a previous event, try to parse it first
                            if !current_json.is_empty() {
                                if let Ok(gemini_data) = serde_json::from_str::<GeminiResponse>(&current_json) {
                                    process_candidate(&app, &event_name, &gemini_data, enable_search.unwrap_or(false));
                                }
                                current_json.clear();
                            }
                            
                            // Start accumulating new JSON
                            current_json.push_str(json_part);
                            in_data_event = true;
                        } else if in_data_event {
                            if line.is_empty() {
                                // Empty line marks end of SSE event - try to parse accumulated JSON
                                if !current_json.is_empty() {
                                    if let Ok(gemini_data) = serde_json::from_str::<GeminiResponse>(&current_json) {
                                        process_candidate(&app, &event_name, &gemini_data, enable_search.unwrap_or(false));
                                    }
                                    current_json.clear();
                                }
                                in_data_event = false;
                            } else {
                                // Continuation of JSON (no "data: " prefix)
                                current_json.push_str(&line);
                            }
                        }
                    } else {
                        // No newline found - wait for more data
                        break;
                    }
                }
            }
            Err(e) => {
                return Err(format!("Stream error: {}", e));
            }
        }
    }
    
    // Try to parse any remaining JSON
    if !current_json.is_empty() {
        if let Ok(gemini_data) = serde_json::from_str::<GeminiResponse>(&current_json) {
            process_candidate(&app, &event_name, &gemini_data, enable_search.unwrap_or(false));
        }
    }

    // Emit final done event
    let _ = app.emit(&event_name, StreamPayload {
        text: None,
        is_done: true,
        metadata: None,
    });

    Ok(())
}