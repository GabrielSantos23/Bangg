import { createServerFn } from "@tanstack/react-start";
import { getClient } from "../../db/db";

export interface Chat {
  id: string;
  userId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

// Create a new chat
export const createChat = createServerFn({
  method: "POST",
})
  .inputValidator((d: { userId: string; title?: string }) => d)
  .handler(async ({ data: { userId, title } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      const { randomUUID } = await import("crypto");

      // First, create a conversation
      const conversationId = randomUUID();
      await client.query(
        `INSERT INTO conversations (id, user_id, title, type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [conversationId, userId, title || "New Chat", "chat"]
      );

      // Then, create the chat linked to the conversation
      const chatId = randomUUID();
      await client.query(
        `INSERT INTO chats (id, conversation_id, user_id, title, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [chatId, conversationId, userId, title || "New Chat"]
      );

      return { id: chatId, userId, title: title || "New Chat", conversationId };
    } catch (error) {
      console.error("Failed to create chat:", error);
      throw error;
    }
  });

// Get all chats for a user
export const getUserChats = createServerFn({
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
        `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
         FROM chats
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [userId]
      );

      return result as Chat[];
    } catch (error) {
      console.error("Failed to get user chats:", error);
      return [];
    }
  });

// Get a single chat by ID
export const getChat = createServerFn({
  method: "GET",
})
  .inputValidator((d: { chatId: string }) => d)
  .handler(async ({ data: { chatId } }) => {
    const client = await getClient();
    if (!client) {
      return null;
    }

    try {
      const result = (await client.query(
        `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
         FROM chats
         WHERE id = $1`,
        [chatId]
      )) as Chat[];

      if (result && result.length > 0) {
        return result[0];
      }
      return null;
    } catch (error) {
      console.error("Failed to get chat:", error);
      return null;
    }
  });

// Get chat by conversation ID
export const getChatByConversationId = createServerFn({
  method: "GET",
})
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data: { conversationId } }) => {
    const client = await getClient();
    if (!client) {
      return null;
    }

    try {
      const result = (await client.query(
        `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
         FROM chats
         WHERE conversation_id = $1
         LIMIT 1`,
        [conversationId]
      )) as Chat[];

      if (result && result.length > 0) {
        return result[0];
      }
      return null;
    } catch (error) {
      console.error("Failed to get chat by conversation ID:", error);
      return null;
    }
  });

// Create a chat linked to an existing conversation
export const createChatForConversation = createServerFn({
  method: "POST",
})
  .inputValidator((d: { conversationId: string; userId: string; title?: string }) => d)
  .handler(async ({ data: { conversationId, userId, title } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      const { randomUUID } = await import("crypto");
      
      // Create the chat linked to the existing conversation
      const chatId = randomUUID();
      await client.query(
        `INSERT INTO chats (id, conversation_id, user_id, title, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [chatId, conversationId, userId, title || "New Chat"]
      );

      return { id: chatId, userId, title: title || "New Chat", conversationId };
    } catch (error) {
      console.error("Failed to create chat for conversation:", error);
      throw error;
    }
  });

// Save a message to the database
export const saveMessage = createServerFn({
  method: "POST",
})
  .inputValidator((d: { chatId: string; role: string; content: string }) => d)
  .handler(async ({ data: { chatId, role, content } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      const { randomUUID } = await import("crypto");
      const messageId = randomUUID();
      await client.query(
        `INSERT INTO messages (id, chat_id, role, content, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [messageId, chatId, role, content]
      );

      // Update chat's updated_at timestamp
      await client.query(
        `UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [chatId]
      );

      return { id: messageId, chatId, role, content };
    } catch (error) {
      console.error("Failed to save message:", error);
      throw error;
    }
  });

// Get all messages for a chat
export const getChatMessages = createServerFn({
  method: "GET",
})
  .inputValidator((d: { chatId: string }) => d)
  .handler(async ({ data: { chatId } }) => {
    const client = await getClient();
    if (!client) {
      return [];
    }

    try {
      const result = await client.query(
        `SELECT id, chat_id as "chatId", role, content, created_at as "createdAt"
         FROM messages
         WHERE chat_id = $1
         ORDER BY created_at ASC`,
        [chatId]
      );

      return result as Message[];
    } catch (error) {
      console.error("Failed to get chat messages:", error);
      return [];
    }
  });

// Update chat title
export const updateChatTitle = createServerFn({
  method: "POST",
})
  .inputValidator((d: { chatId: string; title: string }) => d)
  .handler(async ({ data: { chatId, title } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      await client.query(
        `UPDATE chats SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [title, chatId]
      );
      return { success: true };
    } catch (error) {
      console.error("Failed to update chat title:", error);
      throw error;
    }
  });

// Delete a chat
export const deleteChat = createServerFn({
  method: "POST",
})
  .inputValidator((d: { chatId: string }) => d)
  .handler(async ({ data: { chatId } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      // Messages will be deleted automatically due to CASCADE
      await client.query(`DELETE FROM chats WHERE id = $1`, [chatId]);
      return { success: true };
    } catch (error) {
      console.error("Failed to delete chat:", error);
      throw error;
    }
  });
