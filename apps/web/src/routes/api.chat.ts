import { createFileRoute } from '@tanstack/react-router'
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  type ModelMessage,
} from 'ai'
import { google } from '@ai-sdk/google'

import { getClient } from '../../db/db'
import { getCurrentUser } from '@/services/auth'

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful assistant that chats with the user about productivity and creative workflows. Keep replies concise and actionable.'

function extractTextFromMessage(message: UIMessage | undefined) {
  if (!message || !message.parts) {
    return ''
  }

  return (
    message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('') || ''
  )
}

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const client = await getClient()
        if (!client) {
          return new Response(
            JSON.stringify({ error: 'Database client not available' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        try {
          const body = await request.json()
          const messages = body?.messages as UIMessage[] | undefined
          const incomingChatId =
            typeof body?.chatId === 'string' ? body.chatId : undefined
          const incomingUserId =
            typeof body?.userId === 'string' ? body.userId : undefined
          const systemPrompt =
            typeof body?.systemPrompt === 'string'
              ? body.systemPrompt
              : DEFAULT_SYSTEM_PROMPT

          const user = await getCurrentUser()
          const userId = user?.id ?? incomingUserId

          if (!userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(
              JSON.stringify({ error: 'messages array is required' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Import crypto dynamically (only runs on server)
          const { randomUUID } = await import('crypto')

          let chatId = incomingChatId?.trim()

          const lastUserMessage = [...messages]
            .reverse()
            .find((message) => message.role === 'user')
          const userMessageContent = extractTextFromMessage(lastUserMessage)
          const derivedTitle = userMessageContent
            ? userMessageContent.substring(0, 60)
            : 'Untitled Chat'

          if (chatId) {
            const existingChat = (await client.query(
              `SELECT id, user_id, title
               FROM chats
               WHERE id = $1 AND user_id = $2`,
              [chatId, userId],
            )) as Array<{ id: string; user_id: string; title: string | null }>

            if (!existingChat.length) {
              return new Response(
                JSON.stringify({ error: 'Chat not found for this user' }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }

            // If chat has no title yet, update it optimistically
            if (!existingChat[0].title && userMessageContent) {
              await client.query(`UPDATE chats SET title = $2 WHERE id = $1`, [
                chatId,
                derivedTitle,
              ])
            }
          } else {
            // First, create a conversation
            const conversationId = randomUUID()
            await client.query(
              `INSERT INTO conversations (id, user_id, title, type, created_at, updated_at)
               VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [conversationId, userId, derivedTitle || 'Untitled Chat', 'chat'],
            )
            
            // Then, create the chat linked to the conversation
            chatId = randomUUID()
            await client.query(
              `INSERT INTO chats (id, conversation_id, user_id, title, created_at, updated_at)
               VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [chatId, conversationId, userId, derivedTitle || 'Untitled Chat'],
            )
          }

          // Save user message and attachments
          if (lastUserMessage) {
            const messageId = randomUUID()

            // Extract text content
            const textContent = extractTextFromMessage(lastUserMessage)

            // Check if message has image parts (they come as 'image' in the parts but aren't typed that way)
            const hasImages = lastUserMessage.parts?.some((p: any) => {
              return p.type === 'image' || p.image || p.data
            })

            // Save the message
            if (textContent || hasImages) {
              await client.query(
                `INSERT INTO messages (id, chat_id, role, content, created_at)
                 VALUES ($1, $2, 'user', $3, CURRENT_TIMESTAMP)`,
                [messageId, chatId, textContent || '[Image message]'],
              )

              // Save image attachments
              const imageParts =
                lastUserMessage.parts?.filter(
                  (p: any) => p.type === 'image' || p.image || p.data,
                ) || []

              for (const imagePart of imageParts) {
                const attachmentId = randomUUID()
                const imageData =
                  (imagePart as any).image || (imagePart as any).data || ''
                // Extract base64 data from data URL if present
                const base64Data = imageData.includes(',')
                  ? imageData.split(',')[1]
                  : imageData.replace(/^data:image\/[^;]+;base64,/, '')

                await client.query(
                  `INSERT INTO message_attachments (id, message_id, attachment_type, attachment_data, mime_type, created_at)
                   VALUES ($1, $2, 'image', $3, 'image/png', CURRENT_TIMESTAMP)`,
                  [attachmentId, messageId, base64Data],
                )
              }
            }
          }

          // Convert UIMessages to ModelMessages and process images correctly
          const modelMessages = messages.map((msg) => {
            // Check if this message has image parts (type assertion needed for runtime check)
            const hasImageParts = msg.parts?.some(
              (p: any) => p.type === 'image' || p.image || p.data,
            )

            if (hasImageParts && msg.role === 'user') {
              // Build content array with text and image parts
              const content: Array<{
                type: 'text' | 'image'
                text?: string
                image?: string
              }> = []

              for (const part of msg.parts || []) {
                if (part.type === 'text') {
                  content.push({
                    type: 'text',
                    text: part.text,
                  })
                } else if (
                  (part as any).type === 'image' ||
                  (part as any).image ||
                  (part as any).data
                ) {
                  // Handle image part
                  let imageData =
                    (part as any).image || (part as any).data || ''

                  // Remove data URL prefix if present
                  if (typeof imageData === 'string') {
                    if (imageData.startsWith('data:')) {
                      imageData =
                        imageData.split(',')[1] ||
                        imageData.replace(/^data:image\/[^;]+;base64,/, '')
                    }
                  }

                  content.push({
                    type: 'image',
                    image: imageData,
                  })
                }
              }

              return {
                role: msg.role,
                content,
              }
            }

            // For non-image messages, use convertToModelMessages
            return convertToModelMessages([msg])[0]
          })

          const result = streamText({
            model: google('gemini-2.0-flash'),
            system: systemPrompt,
            messages: modelMessages as ModelMessage[],
          })

          return result.toUIMessageStreamResponse({
            headers: {
              'X-Chat-Id': chatId,
              'Access-Control-Expose-Headers': 'X-Chat-Id',
            },
            onFinish: async ({ responseMessage }) => {
              const assistantContent = extractTextFromMessage(responseMessage)

              if (assistantContent) {
                await client.query(
                  `INSERT INTO messages (id, chat_id, role, content, created_at)
                   VALUES ($1, $2, 'assistant', $3, CURRENT_TIMESTAMP)`,
                  [randomUUID(), chatId, assistantContent],
                )
              }

              await client.query(
                `UPDATE chats
                 SET updated_at = CURRENT_TIMESTAMP,
                     title = CASE
                       WHEN (title IS NULL OR title = '') AND $2 <> '' THEN $2
                       ELSE title
                     END
                 WHERE id = $1`,
                [chatId, derivedTitle],
              )
            },
          })
        } catch (error) {
          console.error('AI chat streaming error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to process chat request' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
