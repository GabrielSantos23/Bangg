use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, FromRow, PgPool, Row};
use std::env;
use std::path::PathBuf;
use uuid::Uuid;
use tauri::{AppHandle, Manager, State};

// === Types ===

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: Uuid,
    pub user_id: String,
    pub title: Option<String>,
    #[serde(rename = "type")]
    pub r#type: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl FromRow<'_, sqlx::postgres::PgRow> for Conversation {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Conversation {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
            title: row.try_get("title")?,
            r#type: row.try_get("type")?,
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("created_at")?
                .and_utc(),
            updated_at: row
                .try_get::<chrono::NaiveDateTime, _>("updated_at")?
                .and_utc(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationMessage {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub user_id: String,
    pub role: String,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl FromRow<'_, sqlx::postgres::PgRow> for ConversationMessage {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(ConversationMessage {
            id: row.try_get("id")?,
            conversation_id: row.try_get("conversation_id")?,
            user_id: row.try_get("user_id")?,
            role: row.try_get("role")?,
            content: row.try_get("content")?,
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("created_at")?
                .and_utc(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Chat {
    pub id: Uuid,
    pub conversation_id: Option<Uuid>,
    pub user_id: String,
    pub title: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl FromRow<'_, sqlx::postgres::PgRow> for Chat {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Chat {
            id: row.try_get("id")?,
            conversation_id: row.try_get("conversation_id")?,
            user_id: row.try_get("user_id")?,
            title: row.try_get("title")?,
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("created_at")?
                .and_utc(),
            updated_at: row
                .try_get::<chrono::NaiveDateTime, _>("updated_at")?
                .and_utc(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: Uuid,
    pub chat_id: Uuid,
    pub role: String,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl FromRow<'_, sqlx::postgres::PgRow> for Message {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Message {
            id: row.try_get("id")?,
            chat_id: row.try_get("chat_id")?,
            role: row.try_get("role")?,
            content: row.try_get("content")?,
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("created_at")?
                .and_utc(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateConversationInput {
    pub user_id: String,
    pub title: Option<String>,
    pub r#type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateConversationMessageInput {
    pub conversation_id: Uuid,
    pub user_id: String,
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateChatInput {
    pub conversation_id: Option<Uuid>,
    pub user_id: String,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateMessageInput {
    pub chat_id: Uuid,
    pub role: String,
    pub content: String,
}

// === Database State Management ===

/// Wrapper struct for managing the database pool in Tauri state
pub struct DbState {
    pub pool: PgPool,
}

/// Initialize dotenv (load .env file)
/// Tries to load from multiple locations including Tauri resource directory (production)
fn init_dotenv(app_handle: Option<&AppHandle>) {
    // Build list of possible .env file locations
    let mut possible_paths = Vec::new();
    
    // FIRST: Try Tauri resource directory (for production builds)
    if let Some(app) = app_handle {
        if let Ok(resource_dir) = app.path().resource_dir() {
            possible_paths.push(resource_dir.join(".env"));
        }
    }
    
    // SECOND: Try relative paths from current working directory
    possible_paths.push(PathBuf::from(".env"));
    possible_paths.push(PathBuf::from("../.env"));
    possible_paths.push(PathBuf::from("../../.env"));
    
    // THIRD: Try to find .env relative to the executable
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            possible_paths.push(exe_dir.join(".env"));
            if let Some(parent) = exe_dir.parent() {
                possible_paths.push(parent.join(".env"));
                possible_paths.push(parent.join("apps").join("web").join(".env"));
            }
        }
    }
    
    // FOURTH: Try current directory
    if let Ok(current_dir) = env::current_dir() {
        possible_paths.push(current_dir.join(".env"));
        possible_paths.push(current_dir.join("apps").join("web").join(".env"));
        if let Some(parent) = current_dir.parent() {
            possible_paths.push(parent.join(".env"));
        }
    }
    
    // Try each path
    for path in &possible_paths {
        if path.exists() {
            match dotenv::from_path(path) {
                Ok(_) => {
                    log::info!("✓ Loaded .env from: {:?}", path);
                    return;
                }
                Err(e) => {
                    log::debug!("✗ Failed to load .env from {:?}: {}", path, e);
                }
            }
        }
    }
    
    // If no .env file found, try loading from current directory
    if dotenv::dotenv().is_ok() {
        log::info!("✓ Loaded .env from current directory");
    } else {
        log::warn!("⚠ No .env file found. Make sure DATABASE_URL or VITE_DATABASE_URL is set as environment variable.");
    }
}

/// Create and initialize the database connection pool with optimized settings
pub async fn create_pool(app_handle: Option<&AppHandle>) -> Result<PgPool, String> {
    // Load .env file
    init_dotenv(app_handle);
    
    // Prefer pooler URL for better connection performance (Supabase pooler recommended)
    let database_url = env::var("VITE_DATABASE_URL_POOLER")
        .or_else(|_| env::var("DATABASE_URL_POOLER"))
        .or_else(|_| env::var("VITE_DATABASE_URL"))
        .or_else(|_| env::var("DATABASE_URL"))
        .map_err(|_| "DATABASE_URL or VITE_DATABASE_URL environment variable not set")?;

    log::info!("🔄 Initializing database connection pool...");
    let start = std::time::Instant::now();
    
    // Optimized pool configuration for performance
    let pool = PgPoolOptions::new()
    // Connection limits
    .max_connections(20) 
    .min_connections(1)  // CHANGED: Reduce from 5 to 1 to prevent startup bottleneck
    
    // Timeouts
    .acquire_timeout(std::time::Duration::from_secs(30)) // CHANGED: Increased from 3s to 30s
    .idle_timeout(Some(std::time::Duration::from_secs(300))) 
    .max_lifetime(Some(std::time::Duration::from_secs(1800))) 
    
    .test_before_acquire(true)
    
    .connect(&database_url)
    .await
    .map_err(|e| format!("Failed to connect to database: {}", e))?;
    
    let elapsed = start.elapsed();
    log::info!("✓ Database pool initialized in {:?}", elapsed);
    log::info!("  • Min connections: 5 (pre-warmed)");
    log::info!("  • Max connections: 20");
    log::info!("  • Using pooler: {}", database_url.contains("pooler") || database_url.contains("pooler.supabase.com"));
    
    Ok(pool)
}

// === Tauri Commands - Using State ===

#[tauri::command]
pub async fn db_get_conversations(
    state: State<'_, DbState>,
    user_id: String,
) -> Result<Vec<Conversation>, String> {
    let conversations = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT id, user_id, title, type, created_at, updated_at
        FROM conversations
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(&user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch conversations: {}", e))?;

    Ok(conversations)
}

#[tauri::command]
pub async fn db_get_conversation_by_id(
    state: State<'_, DbState>,
    conversation_id: Uuid,
) -> Result<Option<Conversation>, String> {
    let conversation = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT id, user_id, title, type, created_at, updated_at
        FROM conversations
        WHERE id = $1
        "#,
    )
    .bind(conversation_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch conversation: {}", e))?;

    Ok(conversation)
}

#[tauri::command]
pub async fn db_create_conversation(
    state: State<'_, DbState>,
    input: CreateConversationInput,
) -> Result<Conversation, String> {
    let conversation = sqlx::query_as::<_, Conversation>(
        r#"
        INSERT INTO conversations (user_id, title, type)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, title, type, created_at, updated_at
        "#,
    )
    .bind(&input.user_id)
    .bind(&input.title)
    .bind(&input.r#type)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Failed to create conversation: {}", e))?;

    Ok(conversation)
}

#[tauri::command]
pub async fn db_update_conversation(
    state: State<'_, DbState>,
    conversation_id: Uuid,
    title: Option<String>,
) -> Result<Conversation, String> {
    let conversation = sqlx::query_as::<_, Conversation>(
        r#"
        UPDATE conversations
        SET title = COALESCE($1, title), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, user_id, title, type, created_at, updated_at
        "#,
    )
    .bind(&title)
    .bind(conversation_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Failed to update conversation: {}", e))?;

    Ok(conversation)
}

#[tauri::command]
pub async fn db_delete_conversation(
    state: State<'_, DbState>,
    conversation_id: Uuid,
) -> Result<bool, String> {
    let result = sqlx::query(
        r#"
        DELETE FROM conversations
        WHERE id = $1
        "#,
    )
    .bind(conversation_id)
    .execute(&state.pool)
    .await
    .map_err(|e| format!("Failed to delete conversation: {}", e))?;

    Ok(result.rows_affected() > 0)
}

#[tauri::command]
pub async fn db_get_conversation_messages(
    state: State<'_, DbState>,
    conversation_id: Uuid,
) -> Result<Vec<ConversationMessage>, String> {
    let messages = sqlx::query_as::<_, ConversationMessage>(
        r#"
        SELECT id, conversation_id, user_id, role, content, created_at
        FROM conversation_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(conversation_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch conversation messages: {}", e))?;

    Ok(messages)
}

#[tauri::command]
pub async fn db_create_conversation_message(
    state: State<'_, DbState>,
    input: CreateConversationMessageInput,
) -> Result<ConversationMessage, String> {
    let message = sqlx::query_as::<_, ConversationMessage>(
        r#"
        INSERT INTO conversation_messages (conversation_id, user_id, role, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id, conversation_id, user_id, role, content, created_at
        "#,
    )
    .bind(input.conversation_id)
    .bind(&input.user_id)
    .bind(&input.role)
    .bind(&input.content)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Failed to create conversation message: {}", e))?;

    Ok(message)
}

#[tauri::command]
pub async fn db_get_chats(
    state: State<'_, DbState>,
    user_id: String,
) -> Result<Vec<Chat>, String> {
    let chats = sqlx::query_as::<_, Chat>(
        r#"
        SELECT id, conversation_id, user_id, title, created_at, updated_at
        FROM chats
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(&user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch chats: {}", e))?;

    Ok(chats)
}

#[tauri::command]
pub async fn db_get_chat_by_id(
    state: State<'_, DbState>,
    chat_id: Uuid,
) -> Result<Option<Chat>, String> {
    let chat = sqlx::query_as::<_, Chat>(
        r#"
        SELECT id, conversation_id, user_id, title, created_at, updated_at
        FROM chats
        WHERE id = $1
        "#,
    )
    .bind(chat_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch chat: {}", e))?;

    Ok(chat)
}

#[tauri::command]
pub async fn db_create_chat(
    state: State<'_, DbState>,
    input: CreateChatInput,
) -> Result<Chat, String> {
    let chat = sqlx::query_as::<_, Chat>(
        r#"
        INSERT INTO chats (conversation_id, user_id, title)
        VALUES ($1, $2, $3)
        RETURNING id, conversation_id, user_id, title, created_at, updated_at
        "#,
    )
    .bind(&input.conversation_id)
    .bind(&input.user_id)
    .bind(&input.title)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Failed to create chat: {}", e))?;

    Ok(chat)
}

#[tauri::command]
pub async fn db_update_chat(
    state: State<'_, DbState>,
    chat_id: Uuid,
    title: Option<String>,
) -> Result<Chat, String> {
    let chat = sqlx::query_as::<_, Chat>(
        r#"
        UPDATE chats
        SET title = COALESCE($1, title), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, conversation_id, user_id, title, created_at, updated_at
        "#,
    )
    .bind(&title)
    .bind(chat_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Failed to update chat: {}", e))?;

    Ok(chat)
}

#[tauri::command]
pub async fn db_delete_chat(
    state: State<'_, DbState>,
    chat_id: Uuid,
) -> Result<bool, String> {
    let result = sqlx::query(
        r#"
        DELETE FROM chats
        WHERE id = $1
        "#,
    )
    .bind(chat_id)
    .execute(&state.pool)
    .await
    .map_err(|e| format!("Failed to delete chat: {}", e))?;

    Ok(result.rows_affected() > 0)
}

#[tauri::command]
pub async fn db_get_messages(
    state: State<'_, DbState>,
    chat_id: Uuid,
) -> Result<Vec<Message>, String> {
    let messages = sqlx::query_as::<_, Message>(
        r#"
        SELECT id, chat_id, role, content, created_at
        FROM messages
        WHERE chat_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(chat_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch messages: {}", e))?;

    Ok(messages)
}

#[tauri::command]
pub async fn db_create_message(
    state: State<'_, DbState>,
    input: CreateMessageInput,
) -> Result<Message, String> {
    let message = sqlx::query_as::<_, Message>(
        r#"
        INSERT INTO messages (chat_id, role, content)
        VALUES ($1, $2, $3)
        RETURNING id, chat_id, role, content, created_at
        "#,
    )
    .bind(input.chat_id)
    .bind(&input.role)
    .bind(&input.content)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Failed to create message: {}", e))?;

    Ok(message)
}

#[tauri::command]
pub async fn db_delete_message(
    state: State<'_, DbState>,
    message_id: Uuid,
) -> Result<bool, String> {
    let result = sqlx::query(
        r#"
        DELETE FROM messages
        WHERE id = $1
        "#,
    )
    .bind(message_id)
    .execute(&state.pool)
    .await
    .map_err(|e| format!("Failed to delete message: {}", e))?;

    Ok(result.rows_affected() > 0)
}

#[tauri::command]
pub async fn db_test_connection(state: State<'_, DbState>) -> Result<bool, String> {
    sqlx::query("SELECT 1")
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Database connection test failed: {}", e))?;

    Ok(true)
}

// === Additional Types ===

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Summary {
    pub id: Uuid,
    pub conversation_id: Option<Uuid>,
    pub user_id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl FromRow<'_, sqlx::postgres::PgRow> for Summary {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Summary {
            id: row.try_get("id")?,
            conversation_id: row.try_get("conversation_id")?,
            user_id: row.try_get("user_id")?,
            title: row.try_get("title")?,
            content: row.try_get("content")?,
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("created_at")?
                .and_utc(),
            updated_at: row
                .try_get::<chrono::NaiveDateTime, _>("updated_at")?
                .and_utc(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transcription {
    pub id: Uuid,
    pub conversation_id: Option<Uuid>,
    pub user_id: String,
    pub title: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl FromRow<'_, sqlx::postgres::PgRow> for Transcription {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Transcription {
            id: row.try_get("id")?,
            conversation_id: row.try_get("conversation_id")?,
            user_id: row.try_get("user_id")?,
            title: row.try_get("title")?,
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("created_at")?
                .and_utc(),
            updated_at: row
                .try_get::<chrono::NaiveDateTime, _>("updated_at")?
                .and_utc(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranscriptionSegment {
    pub id: Uuid,
    pub transcription_id: Uuid,
    pub text: String,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl FromRow<'_, sqlx::postgres::PgRow> for TranscriptionSegment {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        let start_time: Option<f32> = row.try_get("start_time")?;
        let end_time: Option<f32> = row.try_get("end_time")?;
        
        Ok(TranscriptionSegment {
            id: row.try_get("id")?,
            transcription_id: row.try_get("transcription_id")?,
            text: row.try_get("text")?,
            start_time: start_time.map(|v| v as f64),
            end_time: end_time.map(|v| v as f64),
            created_at: row
                .try_get::<chrono::NaiveDateTime, _>("created_at")?
                .and_utc(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSummaryInput {
    pub conversation_id: Option<Uuid>,
    pub user_id: String,
    pub title: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSummaryInput {
    pub summary_id: Uuid,
    pub title: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTranscriptionInput {
    pub conversation_id: Option<Uuid>,
    pub user_id: String,
    pub title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTranscriptionSegmentInput {
    pub transcription_id: Uuid,
    pub text: String,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
}

// === Summary Commands ===

#[tauri::command]
pub async fn db_get_summary_by_conversation_id(
    state: State<'_, DbState>,
    conversation_id: Uuid,
) -> Result<Option<Summary>, String> {
    let summary = sqlx::query_as::<_, Summary>(
        r#"
        SELECT id, conversation_id, user_id, title, content, created_at, updated_at
        FROM summaries
        WHERE conversation_id = $1
        LIMIT 1
        "#,
    )
    .bind(conversation_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch summary: {}", e))?;

    Ok(summary)
}

#[tauri::command]
pub async fn db_create_summary(
    state: State<'_, DbState>,
    input: CreateSummaryInput,
) -> Result<Summary, String> {
    let summary = sqlx::query_as::<_, Summary>(
        r#"
        INSERT INTO summaries (conversation_id, user_id, title, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id, conversation_id, user_id, title, content, created_at, updated_at
        "#,
    )
    .bind(&input.conversation_id)
    .bind(&input.user_id)
    .bind(&input.title)
    .bind(&input.content)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Failed to create summary: {}", e))?;

    Ok(summary)
}

#[tauri::command]
pub async fn db_update_summary(
    state: State<'_, DbState>,
    input: UpdateSummaryInput,
) -> Result<Summary, String> {
    let summary = sqlx::query_as::<_, Summary>(
        r#"
        UPDATE summaries
        SET 
            title = COALESCE($1, title),
            content = COALESCE($2, content),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, conversation_id, user_id, title, content, created_at, updated_at
        "#,
    )
    .bind(&input.title)
    .bind(&input.content)
    .bind(input.summary_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Failed to update summary: {}", e))?;

    Ok(summary)
}

// === Transcription Commands ===

#[tauri::command]
pub async fn db_get_transcriptions(
    state: State<'_, DbState>,
    user_id: String,
) -> Result<Vec<Transcription>, String> {
    let transcriptions = sqlx::query_as::<_, Transcription>(
        r#"
        SELECT id, conversation_id, user_id, title, created_at, updated_at
        FROM transcriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(&user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch transcriptions: {}", e))?;

    Ok(transcriptions)
}

#[tauri::command]
pub async fn db_get_transcription_by_id(
    state: State<'_, DbState>,
    transcription_id: Uuid,
) -> Result<Option<Transcription>, String> {
    let transcription = sqlx::query_as::<_, Transcription>(
        r#"
        SELECT id, conversation_id, user_id, title, created_at, updated_at
        FROM transcriptions
        WHERE id = $1
        "#,
    )
    .bind(transcription_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch transcription: {}", e))?;

    Ok(transcription)
}

#[tauri::command]
pub async fn db_create_transcription(
    state: State<'_, DbState>,
    input: CreateTranscriptionInput,
) -> Result<Transcription, String> {
    let transcription = sqlx::query_as::<_, Transcription>(
        r#"
        INSERT INTO transcriptions (conversation_id, user_id, title)
        VALUES ($1, $2, $3)
        RETURNING id, conversation_id, user_id, title, created_at, updated_at
        "#,
    )
    .bind(&input.conversation_id)
    .bind(&input.user_id)
    .bind(&input.title)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| format!("Failed to create transcription: {}", e))?;

    Ok(transcription)
}

#[tauri::command]
pub async fn db_get_transcription_segments(
    state: State<'_, DbState>,
    transcription_id: Uuid,
) -> Result<Vec<TranscriptionSegment>, String> {
    let segments = sqlx::query_as::<_, TranscriptionSegment>(
        r#"
        SELECT id, transcription_id, text, start_time, end_time, created_at
        FROM transcription_segments
        WHERE transcription_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(transcription_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch transcription segments: {}", e))?;

    Ok(segments)
}

#[tauri::command]
pub async fn db_create_transcription_segment(
    state: State<'_, DbState>,
    input: CreateTranscriptionSegmentInput,
) -> Result<TranscriptionSegment, String> {
    // Start a transaction for atomicity
    let mut tx = state.pool.begin().await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    let segment = sqlx::query_as::<_, TranscriptionSegment>(
        r#"
        INSERT INTO transcription_segments (transcription_id, text, start_time, end_time)
        VALUES ($1, $2, $3, $4)
        RETURNING id, transcription_id, text, start_time, end_time, created_at
        "#,
    )
    .bind(input.transcription_id)
    .bind(&input.text)
    .bind(&input.start_time.map(|v| v as f32))
    .bind(&input.end_time.map(|v| v as f32))
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create transcription segment: {}", e))?;

    // Update transcription's updated_at
    sqlx::query(
        r#"
        UPDATE transcriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1
        "#,
    )
    .bind(input.transcription_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to update transcription timestamp: {}", e))?;

    tx.commit().await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(segment)
}

#[tauri::command]
pub async fn db_get_transcription_segments_by_conversation_id(
    state: State<'_, DbState>,
    conversation_id: Uuid,
) -> Result<Vec<TranscriptionSegment>, String> {
    let segments = sqlx::query_as::<_, TranscriptionSegment>(
        r#"
        SELECT ts.id, ts.transcription_id, ts.text, ts.start_time, ts.end_time, ts.created_at
        FROM transcription_segments ts
        INNER JOIN transcriptions t ON ts.transcription_id = t.id
        WHERE t.conversation_id = $1
        ORDER BY COALESCE(ts.start_time, 0) ASC, ts.created_at ASC
        "#,
    )
    .bind(conversation_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch transcription segments: {}", e))?;

    Ok(segments)
}

#[tauri::command]
pub async fn db_get_chat_by_conversation_id(
    state: State<'_, DbState>,
    conversation_id: Uuid,
) -> Result<Option<Chat>, String> {
    let chat = sqlx::query_as::<_, Chat>(
        r#"
        SELECT id, conversation_id, user_id, title, created_at, updated_at
        FROM chats
        WHERE conversation_id = $1
        LIMIT 1
        "#,
    )
    .bind(conversation_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| format!("Failed to fetch chat by conversation ID: {}", e))?;

    Ok(chat)
}