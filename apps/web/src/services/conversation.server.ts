import { createServerFn } from "@tanstack/react-start";
import { getClient } from "../../db/db";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  type: "chat" | "transcription" | "summary" | "mixed";
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationDetails extends Conversation {
  summary?: {
    id: string;
    content?: string;
    title?: string;
  };
  // Placeholder para quando transcription e usage estiverem prontos
  transcription?: any;
  usage?: any;
}

// Helper function to retry database queries with exponential backoff
async function retryQuery<T>(
  queryFn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error: any) {
      lastError = error;
      const isTimeoutError =
        error?.message?.includes("timeout") ||
        error?.message?.includes("timed out") ||
        error?.code === "ETIMEDOUT";
      
      if (!isTimeoutError || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.warn(
        `Query attempt ${attempt} failed with timeout, retrying in ${waitTime}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw lastError;
}

// Get all conversations for a user
export const getUserConversations = createServerFn({
  method: "GET",
})
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data: { userId } }) => {
    const client = await getClient();
    if (!client) {
      return [];
    }

    try {
      const result = await retryQuery(
        () =>
          client.query(
            `SELECT 
              id, 
              user_id as "userId", 
              title, 
              type,
              created_at as "createdAt", 
              updated_at as "updatedAt"
             FROM conversations
             WHERE user_id = $1
             ORDER BY updated_at DESC`,
            [userId]
          ),
        3, // max retries
        1000 // initial delay
      );

      return result as Conversation[];
    } catch (error) {
      console.error("Failed to get user conversations after retries:", error);
      return [];
    }
  });

// Get a single conversation by ID with details
export const getConversation = createServerFn({
  method: "GET",
})
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data: { conversationId } }) => {
    const client = await getClient();
    if (!client) {
      return null;
    }

    try {
      // Get conversation basic info
      const conversationResult = (await client.query(
        `SELECT 
          id, 
          user_id as "userId", 
          title, 
          type,
          created_at as "createdAt", 
          updated_at as "updatedAt"
         FROM conversations
         WHERE id = $1`,
        [conversationId]
      )) as Conversation[];

      if (!conversationResult || conversationResult.length === 0) {
        return null;
      }

      const conversation = conversationResult[0];

      // Get summary if exists
      const summaryResult = (await client.query(
        `SELECT id, title, content
         FROM summaries
         WHERE conversation_id = $1
         LIMIT 1`,
        [conversationId]
      )) as Array<{ id: string; title?: string; content?: string }>;

      const details: ConversationDetails = {
        ...conversation,
        summary:
          summaryResult && summaryResult.length > 0
            ? {
                id: summaryResult[0].id,
                title: summaryResult[0].title || undefined,
                content: summaryResult[0].content || undefined,
              }
            : undefined,
        // TODO: Adicionar transcription e usage quando estiverem prontos
        transcription: undefined,
        usage: undefined,
      };

      return details;
    } catch (error) {
      console.error("Failed to get conversation:", error);
      return null;
    }
  });

// Get or create summary for a conversation
export const getOrCreateSummary = createServerFn({
  method: "GET",
})
  .inputValidator((d: { conversationId: string; userId: string }) => d)
  .handler(async ({ data: { conversationId, userId } }) => {
    const client = await getClient();
    if (!client) {
      return null;
    }

    try {
      // Check if summary exists
      const existingSummary = (await client.query(
        `SELECT id, title, content
         FROM summaries
         WHERE conversation_id = $1
         LIMIT 1`,
        [conversationId]
      )) as Array<{ id: string; title?: string; content?: string }>;

      if (existingSummary && existingSummary.length > 0) {
        return {
          id: existingSummary[0].id,
          title: existingSummary[0].title || undefined,
          content: existingSummary[0].content || undefined,
        };
      }

      // Create new summary if doesn't exist
      const { randomUUID } = await import("crypto");
      const summaryId = randomUUID();

      await client.query(
        `INSERT INTO summaries (id, conversation_id, user_id, title, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [summaryId, conversationId, userId, null, null]
      );

      return {
        id: summaryId,
        title: undefined,
        content: undefined,
      };
    } catch (error) {
      console.error("Failed to get or create summary:", error);
      return null;
    }
  });

// Update summary content
export const updateSummary = createServerFn({
  method: "POST",
})
  .inputValidator(
    (d: { summaryId: string; content?: string; title?: string }) => d
  )
  .handler(async ({ data: { summaryId, content, title } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (content !== undefined) {
        updates.push(`content = $${paramIndex}`);
        values.push(content);
        paramIndex++;
      }

      if (title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        values.push(title);
        paramIndex++;
      }

      if (updates.length === 0) {
        return { success: true };
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(summaryId);

      // Use the correct parameter index for WHERE clause (should be the last parameter)
      const whereParamIndex = values.length;

      const query = `UPDATE summaries 
         SET ${updates.join(", ")} 
         WHERE id = $${whereParamIndex}`;

      console.log("Updating summary:", {
        summaryId,
        query,
        values: values.map((v, i) => ({
          index: i + 1,
          type: typeof v,
          length: typeof v === "string" ? v.length : undefined,
        })),
      });

      const result = await client.query(query, values);

      // Check if update was successful (result is an array, empty means no rows affected)
      const rowsAffected = Array.isArray(result) ? result.length : 0;

      console.log("Update result:", {
        rowsAffected,
        success: rowsAffected >= 0, // UPDATE always returns success even if no rows matched
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to update summary:", error);
      throw error;
    }
  });

// Update conversation title
export const updateConversationTitle = createServerFn({
  method: "POST",
})
  .inputValidator((d: { conversationId: string; title: string }) => d)
  .handler(async ({ data: { conversationId, title } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      await client.query(
        `UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [title, conversationId]
      );
      return { success: true };
    } catch (error) {
      console.error("Failed to update conversation title:", error);
      throw error;
    }
  });

// Delete a conversation
// This will cascade delete all related chats, transcriptions, and summaries
export const deleteConversation = createServerFn({
  method: "POST",
})
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data: { conversationId } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      // Deleting the conversation will cascade delete all related data
      await client.query(`DELETE FROM conversations WHERE id = $1`, [
        conversationId,
      ]);
      return { success: true };
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      throw error;
    }
  });

/**
 * Gera um resumo usando IA com base nas mensagens do chat e/ou transcrições
 * @param conversationId - ID da conversa
 * @returns Resumo gerado pela IA ou null em caso de erro
 */
export const generateSummaryWithAI = createServerFn({
  method: "POST",
})
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data: { conversationId } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      // Buscar informações da conversa
      const conversationResult = (await client.query(
        `SELECT id, user_id as "userId", type
         FROM conversations
         WHERE id = $1`,
        [conversationId]
      )) as Array<{ id: string; userId: string; type: string }>;

      if (!conversationResult || conversationResult.length === 0) {
        throw new Error("Conversation not found");
      }

      const conversation = conversationResult[0];

      // Buscar mensagens do chat (se houver)
      let chatMessages: Array<{
        id: string;
        chatId: string;
        role: "user" | "assistant" | "system";
        content: string;
        createdAt: Date;
      }> = [];

      try {
        // Tentar encontrar o chat associado à conversa e buscar mensagens
        const messagesResult = (await client.query(
          `SELECT 
            m.id, 
            m.chat_id as "chatId", 
            m.role, 
            m.content, 
            m.created_at as "createdAt"
           FROM messages m
           INNER JOIN chats c ON m.chat_id = c.id
           WHERE c.conversation_id = $1
           ORDER BY m.created_at ASC`,
          [conversationId]
        )) as Array<{
          id: string;
          chatId: string;
          role: "user" | "assistant" | "system";
          content: string;
          createdAt: Date;
        }>;

        chatMessages = messagesResult || [];
      } catch (error) {
        console.warn("Failed to fetch chat messages:", error);
        // Continuar mesmo se não houver mensagens
      }

      // Buscar transcrições (se houver)
      let transcriptionSegments: Array<{
        id: string;
        transcriptionId: string;
        text: string;
        startTime?: number;
        endTime?: number;
        createdAt: Date;
      }> = [];

      try {
        const segmentsResult = (await client.query(
          `SELECT 
            ts.id, 
            ts.transcription_id as "transcriptionId", 
            ts.text, 
            ts.start_time as "startTime", 
            ts.end_time as "endTime", 
            ts.created_at as "createdAt"
           FROM transcription_segments ts
           INNER JOIN transcriptions t ON ts.transcription_id = t.id
           WHERE t.conversation_id = $1
           ORDER BY 
             COALESCE(ts.start_time, 0) ASC,
             ts.created_at ASC`,
          [conversationId]
        )) as Array<{
          id: string;
          transcriptionId: string;
          text: string;
          startTime?: number;
          endTime?: number;
          createdAt: Date;
        }>;

        transcriptionSegments = segmentsResult || [];
      } catch (error) {
        console.warn("Failed to fetch transcription segments:", error);
        // Continuar mesmo se não houver transcrições
      }

      // Verificar se há conteúdo para gerar resumo
      const hasChatMessages = chatMessages.length > 0;
      const hasTranscription = transcriptionSegments.length > 0;

      if (!hasChatMessages && !hasTranscription) {
        throw new Error(
          "No content available to generate summary. Conversation has no messages or transcriptions."
        );
      }

      // Montar o contexto para a IA
      let contextText = "";

      if (hasChatMessages) {
        contextText += "=== MENSAGENS DO CHAT ===\n\n";
        chatMessages.forEach((msg) => {
          const roleLabel =
            msg.role === "user"
              ? "Usuário"
              : msg.role === "assistant"
              ? "Assistente"
              : "Sistema";
          contextText += `[${roleLabel}]: ${msg.content}\n\n`;
        });
      }

      if (hasTranscription) {
        if (hasChatMessages) {
          contextText += "\n=== TRANSCRIÇÃO ===\n\n";
        } else {
          contextText += "=== TRANSCRIÇÃO ===\n\n";
        }

        // Concatenar todos os segmentos de transcrição
        const transcriptionText = transcriptionSegments
          .map((segment) => segment.text)
          .join(" ");
        contextText += transcriptionText;
      }

      // Prompt para gerar o resumo
      const systemPrompt = `Você é um assistente especializado em criar resumos concisos e informativos. 
Analise o conteúdo fornecido (mensagens de chat e/ou transcrições) e crie um resumo claro e objetivo que capture:
- Os principais pontos discutidos
- Decisões tomadas (se houver)
- Ações ou tarefas mencionadas (se houver)
- Contexto importante da conversa

O resumo deve ser em português ou inglês dependendo do contexto da conversa, bem estruturado e fácil de entender.`;

      const userPrompt = `Com base no seguinte conteúdo, gere um resumo detalhado:\n\n${contextText}\n\nResumo:`;

      // Gerar resumo usando IA
      const result = await generateText({
        model: google("gemini-2.0-flash"),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      });

      const summaryText = result.text.trim();

      if (!summaryText) {
        throw new Error("AI generated an empty summary");
      }

      return {
        success: true,
        summary: summaryText,
      };
    } catch (error) {
      console.error("Failed to generate summary with AI:", error);
      throw error;
    }
  });

// Conversation Message interfaces
export interface ConversationMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

// Get all conversation messages
export const getConversationMessages = createServerFn({
  method: "GET",
})
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data: { conversationId } }) => {
    const client = await getClient();
    if (!client) {
      return [];
    }

    try {
      const result = await client.query(
        `SELECT 
          id, 
          conversation_id as "conversationId", 
          user_id as "userId", 
          role, 
          content, 
          created_at as "createdAt"
         FROM conversation_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversationId]
      );

      return result as ConversationMessage[];
    } catch (error) {
      console.error("Failed to get conversation messages:", error);
      return [];
    }
  });

// Save a conversation message
export const saveConversationMessage = createServerFn({
  method: "POST",
})
  .inputValidator(
    (d: {
      conversationId: string;
      userId: string;
      role: "user" | "assistant" | "system";
      content: string;
    }) => d
  )
  .handler(async ({ data: { conversationId, userId, role, content } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      const { randomUUID } = await import("crypto");
      const messageId = randomUUID();
      await client.query(
        `INSERT INTO conversation_messages (id, conversation_id, user_id, role, content, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [messageId, conversationId, userId, role, content]
      );

      return {
        id: messageId,
        conversationId,
        userId,
        role,
        content,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error("Failed to save conversation message:", error);
      throw error;
    }
  });
