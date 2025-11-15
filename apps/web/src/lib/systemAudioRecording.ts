import { invoke } from '@tauri-apps/api/core'

export interface TranscriptionSegment {
  text: string
  start: number
  end: number
}

/**
 * Start recording system audio (non-real-time)
 * Captures desktop/system audio without permission prompts
 */
export async function startSystemAudioRecording(): Promise<void> {
  return await invoke('start_system_audio_recording')
}

/**
 * Stop recording system audio and transcribe it
 * Returns transcription segments with timestamps
 */
export async function stopSystemAudioRecordingAndTranscribe(): Promise<TranscriptionSegment[]> {
  return await invoke<TranscriptionSegment[]>('stop_system_audio_recording_and_transcribe')
}
