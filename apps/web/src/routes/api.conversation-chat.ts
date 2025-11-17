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
import { getChatMessages } from '@/services/chat.server'
import { getTranscriptionSegmentsByConversationId } from '@/services/transcription.server'
import { getConversation } from '@/services/conversation.server'

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

export const Route = createFileRoute('/api/conversation-chat')({
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
          const conversationId =
            typeof body?.conversationId === 'string'
              ? body.conversationId
              : undefined
          const incomingUserId =
            typeof body?.userId === 'string' ? body.userId : undefined

          const user = await getCurrentUser()
          const userId = user?.id ?? incomingUserId

          if (!userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          if (!conversationId) {
            return new Response(
              JSON.stringify({ error: 'conversationId is required' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
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

          // Import crypto dynamically
          const { randomUUID } = await import('crypto')

          // Get conversation details
          const conversation = await getConversation({
            data: { conversationId },
          })

          if (!conversation) {
            return new Response(
              JSON.stringify({ error: 'Conversation not found' }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Build context from chat messages, transcription, and summary
          const contextParts: string[] = []

          // Get chat messages if available
          try {
            const chatResult = (await client.query(
              `SELECT id FROM chats WHERE conversation_id = $1 LIMIT 1`,
              [conversationId],
            )) as Array<{ id: string }>

            if (chatResult && chatResult.length > 0) {
              const chatId = chatResult[0].id
              const chatMessages = await getChatMessages({
                data: { chatId },
              })

              if (chatMessages && chatMessages.length > 0) {
                const chatSection = ['=== MENSAGENS DO CHAT ===']
                chatMessages.forEach((msg) => {
                  const roleLabel =
                    msg.role === 'user'
                      ? 'Usuário'
                      : msg.role === 'assistant'
                        ? 'Assistente'
                        : 'Sistema'
                  chatSection.push(`${roleLabel}: ${msg.content}`)
                })
                contextParts.push(chatSection.join('\n'))
              }
            }
          } catch (error) {
            console.warn('Failed to fetch chat messages:', error)
          }

          // Get transcription if available
          try {
            const transcriptionSegments =
              await getTranscriptionSegmentsByConversationId({
                conversationId,
              })

            if (transcriptionSegments && transcriptionSegments.length > 0) {
              const transcriptionText = transcriptionSegments
                .map((segment) => segment.text)
                .join(' ')
              if (transcriptionText.trim()) {
                contextParts.push(
                  `=== TRANSCRIÇÃO ===\n${transcriptionText.trim()}`,
                )
              }
            }
          } catch (error) {
            console.warn('Failed to fetch transcription:', error)
          }

          // Get summary if available
          try {
            if (conversation.summary?.content) {
              try {
                const summaryContent = JSON.parse(conversation.summary.content)
                // Extract text from Plate format
                const extractText = (node: any): string => {
                  if (typeof node === 'string') return node
                  if (node?.text && typeof node.text === 'string')
                    return node.text
                  if (Array.isArray(node?.children)) {
                    return node.children.map(extractText).join('')
                  }
                  return ''
                }
                const summaryText = Array.isArray(summaryContent)
                  ? summaryContent.map(extractText).join('\n').trim()
                  : extractText(summaryContent).trim()
                if (summaryText) {
                  contextParts.push(`=== RESUMO ===\n${summaryText}`)
                }
              } catch (parseError) {
                // If parsing fails, use content as is if it's not JSON
                const rawContent = conversation.summary.content.trim()
                if (rawContent && !rawContent.startsWith('[')) {
                  contextParts.push(`=== RESUMO ===\n${rawContent}`)
                }
              }
            }
          } catch (error) {
            console.warn('Failed to fetch summary:', error)
          }

          const contextText = contextParts.length > 0
            ? contextParts.join('\n\n')
            : ''

          // Log context for debugging
          console.log('Context built:', {
            conversationId,
            hasChatMessages: contextText.includes('MENSAGENS DO CHAT'),
            hasTranscription: contextText.includes('TRANSCRIÇÃO'),
            hasSummary: contextText.includes('RESUMO'),
            contextLength: contextText.length,
            contextParts: contextParts.length,
            contextPreview: contextText.substring(0, 500),
          })

          // Build system prompt with context
          const systemPrompt = contextText
            ? `Você é um assistente especializado em ajudar o usuário a entender e trabalhar com o conteúdo de suas conversas, transcrições e resumos.

CONTEXTO DA CONVERSA DO USUÁRIO:
${contextText}

INSTRUÇÕES CRÍTICAS:
1. O contexto acima contém informações REAIS da conversa do usuário (mensagens do chat, transcrição e resumo)
2. Você DEVE usar essas informações para responder às perguntas do usuário
3. Quando o usuário perguntar sobre algo, procure no contexto acima e use as informações encontradas
4. Cite especificamente de onde vem a informação (ex: "Nas mensagens do chat você disse...", "Na transcrição menciona...", "No resumo está escrito...")
5. Se a informação estiver no contexto, use-a diretamente - não invente ou generalize
6. Se não encontrar informação relevante no contexto, diga claramente que não há essa informação disponível
7. Mantenha respostas concisas, precisas e baseadas EXCLUSIVAMENTE no contexto fornecido
8. Responda sempre em português

IMPORTANTE: NÃO invente informações. Use APENAS o que está no contexto acima.`
            : `Você é um assistente especializado em ajudar o usuário a entender e trabalhar com o conteúdo de suas conversas, transcrições e resumos.

Nenhum contexto adicional está disponível para esta conversa no momento. Responda às perguntas do usuário de forma útil e concisa em português.`

          // Get the last user message
          const lastUserMessage = [...messages]
            .reverse()
            .find((message) => message.role === 'user')
          const userMessageContent = extractTextFromMessage(lastUserMessage)

          // Save user message
          if (userMessageContent) {
            await client.query(
              `INSERT INTO conversation_messages (id, conversation_id, user_id, role, content, created_at)
               VALUES ($1, $2, $3, 'user', $4, CURRENT_TIMESTAMP)`,
              [randomUUID(), conversationId, userId, userMessageContent],
            )
          }

          // Convert UIMessages to ModelMessages
          const modelMessages = convertToModelMessages(messages)

          const result = streamText({
            model: google('gemini-2.0-flash'),
            system: systemPrompt,
            messages: modelMessages as ModelMessage[],
          })

          return result.toUIMessageStreamResponse({
            headers: {
              'X-Conversation-Id': conversationId,
              'Access-Control-Expose-Headers': 'X-Conversation-Id',
            },
            onFinish: async ({ responseMessage }) => {
              const assistantContent = extractTextFromMessage(responseMessage)

              if (assistantContent) {
                await client.query(
                  `INSERT INTO conversation_messages (id, conversation_id, user_id, role, content, created_at)
                   VALUES ($1, $2, $3, 'assistant', $4, CURRENT_TIMESTAMP)`,
                  [randomUUID(), conversationId, userId, assistantContent],
                )
              }

              // Update conversation updated_at
              await client.query(
                `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [conversationId],
              )
            },
          })
        } catch (error) {
          console.error('Conversation chat streaming error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to process conversation chat request' }),
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
