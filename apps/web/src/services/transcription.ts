import {
  getTranscriptions,
  getTranscriptionById,
  createTranscription,
  getTranscriptionSegments,
  createTranscriptionSegment,
  getTranscriptionSegmentsByConversationId,
  type Transcription as DbTranscription,
  type TranscriptionSegment as DbTranscriptionSegment,
} from './database'
import { createConversation } from './conversation'

// === Types (compatíveis com os antigos) ===

export interface Transcription {
  id: string
  userId: string
  title?: string
  createdAt: Date
  updatedAt: Date
}

export interface TranscriptionSegment {
  id: string
  transcriptionId: string
  text: string
  startTime?: number
  endTime?: number
  createdAt: Date
}

// Helper para converter tipos do banco para tipos do frontend
function convertTranscription(db: DbTranscription): Transcription {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title ?? undefined,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  }
}

function convertTranscriptionSegment(db: DbTranscriptionSegment): TranscriptionSegment {
  return {
    id: db.id,
    transcriptionId: db.transcription_id,
    text: db.text,
    startTime: db.start_time ?? undefined,
    endTime: db.end_time ?? undefined,
    createdAt: new Date(db.created_at),
  }
}

// === Functions ===

export async function createNewTranscription(input: {
  userId: string
  title?: string
}): Promise<{ id: string; userId: string; title: string; conversationId: string }> {
  // Primeiro, criar uma conversa
  const conversation = await createConversation({
    user_id: input.userId,
    title: input.title || 'New Transcription',
    type: 'transcription',
  })

  // Depois, criar a transcrição vinculada à conversa
  const transcription = await createTranscription({
    conversation_id: conversation.id,
    user_id: input.userId,
    title: input.title || 'New Transcription',
  })

  return {
    id: transcription.id,
    userId: transcription.user_id,
    title: transcription.title || 'New Transcription',
    conversationId: conversation.id,
  }
}

export async function getUserTranscriptions(userId: string): Promise<Transcription[]> {
  const dbTranscriptions = await getTranscriptions(userId)
  return dbTranscriptions.map(convertTranscription)
}

export async function getTranscription(transcriptionId: string): Promise<Transcription | null> {
  const transcription = await getTranscriptionById(transcriptionId)
  if (!transcription) {
    return null
  }
  return convertTranscription(transcription)
}

export async function saveTranscriptionSegment(input: {
  transcriptionId: string
  text: string
  startTime?: number
  endTime?: number
}): Promise<{
  id: string
  transcriptionId: string
  text: string
  startTime?: number
  endTime?: number
}> {
  const segment = await createTranscriptionSegment({
    transcription_id: input.transcriptionId,
    text: input.text,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
  })

  return {
    id: segment.id,
    transcriptionId: segment.transcription_id,
    text: segment.text,
    startTime: segment.start_time ?? undefined,
    endTime: segment.end_time ?? undefined,
  }
}

export async function saveTranscriptionSegments(input: {
  transcriptionId: string
  segments: Array<{
    text: string
    startTime?: number
    endTime?: number
  }>
}): Promise<TranscriptionSegment[]> {
  const savedSegments: TranscriptionSegment[] = []

  for (const segment of input.segments) {
    const saved = await saveTranscriptionSegment({
      transcriptionId: input.transcriptionId,
      text: segment.text,
      startTime: segment.startTime,
      endTime: segment.endTime,
    })
    savedSegments.push({
      id: saved.id,
      transcriptionId: saved.transcriptionId,
      text: saved.text,
      startTime: saved.startTime,
      endTime: saved.endTime,
      createdAt: new Date(), // Será atualizado pelo banco
    })
  }

  return savedSegments
}

export async function getTranscriptionSegmentsList(
  transcriptionId: string
): Promise<TranscriptionSegment[]> {
  const segments = await getTranscriptionSegments(transcriptionId)
  return segments.map(convertTranscriptionSegment)
}

export async function getTranscriptionSegmentsByConversation(
  conversationId: string
): Promise<TranscriptionSegment[]> {
  const segments = await getTranscriptionSegmentsByConversationId(conversationId)
  return segments.map(convertTranscriptionSegment)
}

export async function getTranscriptionText(transcriptionId: string): Promise<string> {
  const segments = await getTranscriptionSegments(transcriptionId)
  if (segments.length === 0) {
    return ''
  }
  return segments.map((segment) => segment.text).join(' ')
}

