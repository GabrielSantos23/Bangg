import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function VoicePanel() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      setTranscript('Recording started... (This is a demo)')
    } else {
      setTranscript('Recording stopped. Transcript would appear here.')
    }
  }

  return (
    <div className="p-6 ">
      <div className="mb-6 text-center">
        <h3 className="mb-2 font-semibold">Voice Recording</h3>
        <p className="text-sm text-muted-foreground">
          Click the button to start or stop recording
        </p>
      </div>

      <div className="mb-6 flex justify-center">
        <motion.div
          animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
        >
          <Button
            onClick={toggleRecording}
            size="lg"
            variant={isRecording ? 'destructive' : 'default'}
            className="h-20 w-20 rounded-full"
          >
            {isRecording ? (
              <Square className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>
        </motion.div>
      </div>

      {transcript && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-muted p-4"
        >
          <p className="text-sm">{transcript}</p>
        </motion.div>
      )}
    </div>
  )
}
