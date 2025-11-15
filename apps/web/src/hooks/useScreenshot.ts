import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export function useScreenshot() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const takeScreenshot = async (): Promise<string | null> => {
    setIsCapturing(true)
    setError(null)

    try {
      const base64Image = await invoke<string>('capture_to_base64')
      setIsCapturing(false)
      return base64Image
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to capture screenshot'
      setError(errorMessage)
      setIsCapturing(false)
      console.error('Screenshot error:', err)
      return null
    }
  }

  return {
    takeScreenshot,
    isCapturing,
    error,
  }
}
