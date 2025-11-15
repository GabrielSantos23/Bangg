import { motion } from 'framer-motion'
import type { UIMessage } from 'ai'
import { getTextFromMessage, getImagesFromMessage } from '@/lib/chat-utils'

interface UserMessageProps {
  message: UIMessage
}

export function UserMessage({ message }: UserMessageProps) {
  const text = getTextFromMessage(message)
  const images = getImagesFromMessage(message)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground">
        {images.length > 0 && (
          <div className="mb-2 space-y-2">
            {images.map((img, imgIndex) => (
              <div
                key={imgIndex}
                className="rounded-lg overflow-hidden border border-border/30"
              >
                <img
                  src={img}
                  alt={`Attachment ${imgIndex + 1}`}
                  className="max-w-full h-auto max-h-64 object-contain"
                />
              </div>
            ))}
          </div>
        )}
        {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      </div>
    </motion.div>
  )
}
