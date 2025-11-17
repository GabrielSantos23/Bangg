import { invoke } from '@tauri-apps/api/core'

// === Types ===

export interface Conversation {
  id: string
  user_id: string
  title?: string | null
  type: string
  created_at: string
  updated_at: string
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  user_id: string
  role: string
  content: string
  created_at: string
}

export interface Chat {
  id: string
  conversation_id?: string | null
  user_id: string
  title?: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  chat_id: string
  role: string
  content: string
  created_at: string
}

export interface Summary {
  id: string
  conversation_id?: string | null
  user_id: string
  title?: string | null
  content?: string | null
  created_at: string
  updated_at: string
}

export interface Transcription {
  id: string
  conversation_id?: string | null
  user_id: string
  title?: string | null
  created_at: string
  updated_at: string
}

export interface TranscriptionSegment {
  id: string
  transcription_id: string
  text: string
  start_time?: number | null
  end_time?: number | null
  created_at: string
}

// === Conversation Functions ===

export async function getConversations(userId: string): Promise<Conversation[]> {
  try {
    return await invoke<Conversation[]>('db_get_conversations', { userId })
  } catch (error) {
    console.error('Failed to get conversations:', error)
    return []
  }
}

export async function getConversationById(conversationId: string): Promise<Conversation | null> {
  try {
    return await invoke<Conversation | null>('db_get_conversation_by_id', {
      conversationId,
    })
  } catch (error) {
    console.error('Failed to get conversation:', error)
    return null
  }
}

export async function createConversation(input: {
  user_id: string
  title?: string | null
  type: string
}): Promise<Conversation> {
  return await invoke<Conversation>('db_create_conversation', { input })
}

export async function updateConversation(
  conversationId: string,
  title?: string | null
): Promise<Conversation> {
  return await invoke<Conversation>('db_update_conversation', {
    conversationId,
    title: title ?? null,
  })
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  try {
    return await invoke<boolean>('db_delete_conversation', {
      conversationId,
    })
  } catch (error) {
    console.error('Failed to delete conversation:', error)
    return false
  }
}

export async function getConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  try {
    return await invoke<ConversationMessage[]>('db_get_conversation_messages', {
      conversationId,
    })
  } catch (error) {
    console.error('Failed to get conversation messages:', error)
    return []
  }
}

export async function createConversationMessage(input: {
  conversation_id: string
  user_id: string
  role: string
  content: string
}): Promise<ConversationMessage> {
  return await invoke<ConversationMessage>('db_create_conversation_message', { input })
}

// === Chat Functions ===

export async function getChats(userId: string): Promise<Chat[]> {
  try {
    return await invoke<Chat[]>('db_get_chats', { userId })
  } catch (error) {
    console.error('Failed to get chats:', error)
    return []
  }
}

export async function getChatById(chatId: string): Promise<Chat | null> {
  try {
    return await invoke<Chat | null>('db_get_chat_by_id', { chatId })
  } catch (error) {
    console.error('Failed to get chat:', error)
    return null
  }
}

export async function getChatByConversationId(conversationId: string): Promise<Chat | null> {
  try {
    return await invoke<Chat | null>('db_get_chat_by_conversation_id', {
      conversationId,
    })
  } catch (error) {
    console.error('Failed to get chat by conversation ID:', error)
    return null
  }
}

export async function createChat(input: {
  conversation_id?: string | null
  user_id: string
  title?: string | null
}): Promise<Chat> {
  return await invoke<Chat>('db_create_chat', { input })
}

export async function updateChat(chatId: string, title?: string | null): Promise<Chat> {
  return await invoke<Chat>('db_update_chat', {
    chatId,
    title: title ?? null,
  })
}

export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    return await invoke<boolean>('db_delete_chat', { chatId })
  } catch (error) {
    console.error('Failed to delete chat:', error)
    return false
  }
}

// === Message Functions ===

export async function getMessages(chatId: string): Promise<Message[]> {
  try {
    return await invoke<Message[]>('db_get_messages', { chatId })
  } catch (error) {
    console.error('Failed to get messages:', error)
    return []
  }
}

export async function createMessage(input: {
  chat_id: string
  role: string
  content: string
}): Promise<Message> {
  return await invoke<Message>('db_create_message', { input })
}

export async function deleteMessage(messageId: string): Promise<boolean> {
  try {
    return await invoke<boolean>('db_delete_message', { messageId })
  } catch (error) {
    console.error('Failed to delete message:', error)
    return false
  }
}

// === Summary Functions ===

export async function getSummaryByConversationId(
  conversationId: string
): Promise<Summary | null> {
  try {
    return await invoke<Summary | null>('db_get_summary_by_conversation_id', {
      conversationId,
    })
  } catch (error) {
    console.error('Failed to get summary:', error)
    return null
  }
}

export async function createSummary(input: {
  conversation_id?: string | null
  user_id: string
  title?: string | null
  content?: string | null
}): Promise<Summary> {
  return await invoke<Summary>('db_create_summary', { input })
}

export async function updateSummary(input: {
  summaryId: string
  title?: string | null
  content?: string | null
}): Promise<Summary> {
  // Convert camelCase to snake_case for the input struct
  return await invoke<Summary>('db_update_summary', {
    input: {
      summary_id: input.summaryId,
      title: input.title,
      content: input.content,
    },
  })
}

// === Transcription Functions ===

export async function getTranscriptions(userId: string): Promise<Transcription[]> {
  try {
    return await invoke<Transcription[]>('db_get_transcriptions', { userId })
  } catch (error) {
    console.error('Failed to get transcriptions:', error)
    return []
  }
}

export async function getTranscriptionById(
  transcriptionId: string
): Promise<Transcription | null> {
  try {
    return await invoke<Transcription | null>('db_get_transcription_by_id', {
      transcriptionId,
    })
  } catch (error) {
    console.error('Failed to get transcription:', error)
    return null
  }
}

export async function createTranscription(input: {
  conversation_id?: string | null
  user_id: string
  title?: string | null
}): Promise<Transcription> {
  return await invoke<Transcription>('db_create_transcription', { input })
}

export async function getTranscriptionSegments(
  transcriptionId: string
): Promise<TranscriptionSegment[]> {
  try {
    return await invoke<TranscriptionSegment[]>('db_get_transcription_segments', {
      transcriptionId,
    })
  } catch (error) {
    console.error('Failed to get transcription segments:', error)
    return []
  }
}

export async function createTranscriptionSegment(input: {
  transcription_id: string
  text: string
  start_time?: number | null
  end_time?: number | null
}): Promise<TranscriptionSegment> {
  return await invoke<TranscriptionSegment>('db_create_transcription_segment', { input })
}

export async function getTranscriptionSegmentsByConversationId(
  conversationId: string
): Promise<TranscriptionSegment[]> {
  try {
    return await invoke<TranscriptionSegment[]>('db_get_transcription_segments_by_conversation_id', {
      conversationId,
    })
  } catch (error) {
    console.error('Failed to get transcription segments:', error)
    return []
  }
}

// === Utility Functions ===

export async function testConnection(): Promise<boolean> {
  try {
    return await invoke<boolean>('db_test_connection')
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

