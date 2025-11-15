import { invoke } from '@tauri-apps/api/core'

export interface TranscriptionSegment {
  text: string
  start: number
  end: number
}

export interface WhisperStatus {
  initialized: boolean
  model_path: string | null
}

/**
 * Initialize Whisper model
 * @param modelName - Name of the model file (e.g., 'ggml-base.en.bin')
 */
export async function initializeWhisper(modelName: string): Promise<string> {
  return await invoke<string>('initialize_whisper', { modelName })
}

/**
 * Transcribe audio file
 * @param audioPath - Full path to the WAV audio file
 * @param language - Optional language code (e.g., 'en', 'es', 'fr')
 */
export async function transcribeAudio(
  audioPath: string,
  language?: string,
): Promise<string> {
  return await invoke<string>('transcribe_audio', { audioPath, language })
}

/**
 * Transcribe audio with timestamps
 * @param audioPath - Full path to the WAV audio file
 * @param language - Optional language code
 */
export async function transcribeAudioWithTimestamps(
  audioPath: string,
  language?: string,
): Promise<TranscriptionSegment[]> {
  return await invoke<TranscriptionSegment[]>(
    'transcribe_audio_with_timestamps',
    {
      audioPath,
      language,
    },
  )
}

/**
 * Check if Whisper is initialized
 */
export async function checkWhisperStatus(): Promise<WhisperStatus> {
  return await invoke<WhisperStatus>('check_whisper_status')
}

/**
 * Get the models directory path
 */
export async function getModelPath(): Promise<string> {
  return await invoke<string>('get_model_path')
}

/**
 * Save audio buffer to file
 * @param audioData - Uint8Array of audio data
 * @param filename - Name of the file to save
 */
export async function saveAudioBuffer(
  audioData: Uint8Array,
  filename: string,
): Promise<string> {
  return await invoke<string>('save_audio_buffer', {
    audioData: Array.from(audioData),
    filename,
  })
}

/**
 * Cleanup audio file
 * @param filePath - Full path to the audio file
 */
export async function cleanupAudioFile(filePath: string): Promise<void> {
  await invoke('cleanup_audio_file', { filePath })
}
