import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Square, Pause, Play, Loader2 } from 'lucide-react'

interface AudioRecorderProps {
  onStop: () => void
  isStarting?: boolean
  isTranscribing?: boolean
}

export function AudioRecorder({ onStop, isStarting = false, isTranscribing = false }: AudioRecorderProps) {
  const [isPaused, setIsPaused] = useState(false)
  
  // Note: Pause functionality is visual only since the backend doesn't support pausing
  // The recording continues in the background, but the UI shows it as paused
  const togglePause = () => setIsPaused(!isPaused)

  const isActive = !isPaused && !isStarting && !isTranscribing

  return (
    <div className="flex items-center gap-2 bg-muted px-2 py-1 rounded-full shadow-sm">
      <div className="flex items-center gap-1">
        {isStarting || isTranscribing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          [...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-primary"
              animate={{
                height: isPaused ? 6 : [4, 14, 4],
              }}
              transition={{
                duration: 0.8,
                repeat: isPaused ? 0 : Infinity,
                delay: i * 0.1,
                ease: 'easeInOut',
              }}
            />
          ))
        )}
      </div>

      {isTranscribing ? (
        <span className="text-xs text-muted-foreground px-2">Transcribing...</span>
      ) : (
        <>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant={isPaused ? 'secondary' : 'outline'}
              size="icon"
              className="h-6 w-6 rounded-full p-0"
              onClick={togglePause}
              disabled={isStarting || isTranscribing}
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
            >
              {isPaused ? <Play className="h-3 w-3 fill-primary" /> : <Pause className="h-3 w-3" />}
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="destructive"
              size="icon"
              className="h-6 w-6 rounded-full p-0"
              onClick={onStop}
              disabled={isStarting || isTranscribing}
              aria-label="Stop recording"
            >
              <Square className="h-3 w-3" />
            </Button>
          </motion.div>
        </>
      )}
    </div>
  )
}
