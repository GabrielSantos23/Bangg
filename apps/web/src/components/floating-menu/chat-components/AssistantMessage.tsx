import { Fragment } from 'react'
import { motion } from 'framer-motion'
import type { UIMessage } from 'ai'

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { CopyIcon, RefreshCcwIcon } from 'lucide-react'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'

interface AssistantMessageProps {
  message: UIMessage
  status: 'streaming' | 'submitted' | 'awaiting' | 'in_progress'
  isLastMessage: boolean
  onRegenerate: () => void
}

export function AssistantMessage({
  message,
  status,
  isLastMessage,
  onRegenerate,
}: AssistantMessageProps) {
  const sources = message.parts.filter((part) => part.type === 'source-url')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="flex flex-col w-full">
        {/* Render Sources if they exist */}
        {sources.length > 0 && (
          <Sources>
            <SourcesTrigger count={sources.length} />
            <SourcesContent>
              {sources.map((part, i) => (
                <Source
                  key={i}
                  href={(part as any).url}
                  title={(part as any).url}
                />
              ))}
            </SourcesContent>
          </Sources>
        )}

        {/* Render message parts (text, reasoning, etc.) */}
        {message.parts.map((part, i) => {
          switch (part.type) {
            case 'text':
              return (
                <Fragment key={i}>
                  <Message from="assistant" className="max-w-[80%]">
                    <MessageContent>
                      {/* Response handles streaming text and markdown */}
                      <MessageResponse>{part.text}</MessageResponse>
                    </MessageContent>
                  </Message>

                  {/* Show Actions (Copy/Retry) on the last message */}
                  {/*{isLastMessage && (
                    <Actions className="mt-2">
                      <Action
                        onClick={() => onRegenerate()}
                        label="Retry"
                      >
                        <RefreshCcwIcon className="size-3" />
                      </Action>
                      <Action
                        onClick={() =>
                          navigator.clipboard.writeText(part.text)
                        }
                        label="Copy"
                      >
                        <CopyIcon className="size-3" />
                      </Action>
                    </Actions>
                  )}*/}
                </Fragment>
              )

            case 'reasoning':
              return (
                <Reasoning
                  key={i}
                  className="w-full"
                  isStreaming={status === 'streaming' && isLastMessage}
                >
                  <ReasoningTrigger />
                  <ReasoningContent>{part.text}</ReasoningContent>
                </Reasoning>
              )

            case 'source-url':
              // Handled by the <Sources> block above
              return null

            default:
              return null
          }
        })}
      </div>
    </motion.div>
  )
}
