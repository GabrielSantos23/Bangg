import {
  getChats,
  getChatById,
  getChatByConversationId,
  createChat,
  updateChat,
  deleteChat,
  getMessages,
  createMessage,
  type Chat as DbChat,
  type Message as DbMessage,
} from "./database";
import { createConversationWrapper, type Conversation } from "./conversation";

// === Types (compatíveis com os antigos) ===

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
  attachments?: string[];
}

// Helper para converter tipos do banco para tipos do frontend
function convertChat(db: DbChat): Chat {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title ?? undefined,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

function convertMessage(db: DbMessage): Message {
  return {
    id: db.id,
    chatId: db.chat_id,
    role: db.role as "user" | "assistant" | "system",
    content: db.content,
    createdAt: new Date(db.created_at),
    attachments: db.attachments,
  };
}

// === Functions ===

export async function createNewChat(input: {
  userId: string;
  title?: string;
}): Promise<{
  id: string;
  userId: string;
  title: string;
  conversationId: string;
}> {
  // Primeiro, criar uma conversa
  const conversation = await createConversationWrapper({
    user_id: input.userId,
    title: input.title || "New Chat",
    type: "chat",
  });

  // Depois, criar o chat vinculado à conversa
  const chat = await createChat({
    conversation_id: conversation.id,
    user_id: input.userId,
    title: input.title || "New Chat",
  });

  return {
    id: chat.id,
    userId: chat.user_id,
    title: chat.title || "New Chat",
    conversationId: conversation.id,
  };
}

export async function getUserChats(userId: string): Promise<Chat[]> {
  const dbChats = await getChats(userId);
  return dbChats.map(convertChat);
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const chat = await getChatById(chatId);
  if (!chat) {
    return null;
  }
  return convertChat(chat);
}

export async function getChatByConversation(
  conversationId: string
): Promise<Chat | null> {
  const chat = await getChatByConversationId(conversationId);
  if (!chat) {
    return null;
  }
  return convertChat(chat);
}

export async function createChatForConversation(input: {
  conversationId: string;
  userId: string;
  title?: string;
}): Promise<{
  id: string;
  userId: string;
  title: string;
  conversationId: string;
}> {
  const chat = await createChat({
    conversation_id: input.conversationId,
    user_id: input.userId,
    title: input.title || "New Chat",
  });

  return {
    id: chat.id,
    userId: chat.user_id,
    title: chat.title || "New Chat",
    conversationId: input.conversationId,
  };
}

export async function saveMessage(input: {
  chatId: string;
  role: string;
  content: string;
}): Promise<{ id: string; chatId: string; role: string; content: string }> {
  const message = await createMessage({
    chat_id: input.chatId,
    role: input.role,
    content: input.content,
  });

  // Atualizar updated_at do chat (já é feito automaticamente pelo trigger no banco)
  // Mas vamos atualizar o título se necessário
  await updateChat(input.chatId, null);

  return {
    id: message.id,
    chatId: message.chat_id,
    role: message.role,
    content: message.content,
  };
}

export async function getChatMessages(chatId: string): Promise<Message[]> {
  const messages = await getMessages(chatId);
  return messages.map(convertMessage);
}

export async function updateChatTitle(
  chatId: string,
  title: string
): Promise<{ success: boolean }> {
  try {
    await updateChat(chatId, title);
    return { success: true };
  } catch (error) {
    console.error("Failed to update chat title:", error);
    throw error;
  }
}

export async function deleteChatById(
  chatId: string
): Promise<{ success: boolean }> {
  try {
    const result = await deleteChat(chatId);
    return { success: result };
  } catch (error) {
    console.error("Failed to delete chat:", error);
    throw error;
  }
}
