import { createServerFn } from "@tanstack/react-start";
import { getClient } from "../../db/db";

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
      const result = await client.query(
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
      );

      return result as Conversation[];
    } catch (error) {
      console.error("Failed to get user conversations:", error);
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
    (d: {
      summaryId: string;
      content?: string;
      title?: string;
    }) => d
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

      await client.query(
        `UPDATE summaries 
         SET ${updates.join(", ")} 
         WHERE id = $${paramIndex}`,
        values
      );

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





