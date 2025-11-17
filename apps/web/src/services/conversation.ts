import {
  getConversations,
  getConversationById,
  createConversation as createConversationDb,
  updateConversation,
  deleteConversation,
  getConversationMessages,
  createConversationMessage,
  getSummaryByConversationId,
  createSummary,
  updateSummary,
  getChatByConversationId,
  getMessages,
  getTranscriptionSegmentsByConversationId,
  type Conversation as DbConversation,
  type ConversationMessage as DbConversationMessage,
  type Summary as DbSummary,
  type Chat as DbChat,
  type Message as DbMessage,
  type TranscriptionSegment as DbTranscriptionSegment,
} from "./database";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

// === Types (compatíveis com os antigos) ===

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
  transcription?: any;
  usage?: any;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

// Helper para converter tipos do banco para tipos do frontend
function convertConversation(db: DbConversation): Conversation {
  return {
    id: db.id,
    userId: db.user_id,
    title: db.title ?? undefined,
    type: db.type as "chat" | "transcription" | "summary" | "mixed",
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

function convertConversationMessage(
  db: DbConversationMessage
): ConversationMessage {
  return {
    id: db.id,
    conversationId: db.conversation_id,
    userId: db.user_id,
    role: db.role as "user" | "assistant" | "system",
    content: db.content,
    createdAt: new Date(db.created_at),
  };
}

// === Functions ===

export async function getUserConversations(
  userId: string
): Promise<Conversation[]> {
  const dbConversations = await getConversations(userId);
  return dbConversations.map(convertConversation);
}

// Export createConversation for use in other services
export async function createConversationWrapper(input: {
  user_id: string;
  title?: string | null;
  type: string;
}): Promise<Conversation> {
  const dbConversation = await createConversationDb(input);
  return convertConversation(dbConversation);
}

// Export createConversation directly for backward compatibility
export async function createConversation(input: {
  user_id: string;
  title?: string | null;
  type: string;
}): Promise<Conversation> {
  return createConversationWrapper(input);
}

export async function getConversation(
  conversationId: string
): Promise<ConversationDetails | null> {
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    return null;
  }

  const details: ConversationDetails = {
    ...convertConversation(conversation),
    summary: undefined,
    transcription: undefined,
    usage: undefined,
  };

  // Buscar summary se existir
  const summary = await getSummaryByConversationId(conversationId);
  if (summary) {
    details.summary = {
      id: summary.id,
      title: summary.title ?? undefined,
      content: summary.content ?? undefined,
    };
  }

  return details;
}

export async function getOrCreateSummary(
  conversationId: string,
  userId: string
): Promise<{ id: string; title?: string; content?: string } | null> {
  try {
    // Verificar se já existe
    let summary = await getSummaryByConversationId(conversationId);

    if (!summary) {
      // Criar novo summary
      summary = await createSummary({
        conversation_id: conversationId,
        user_id: userId,
        title: null,
        content: null,
      });
    }

    return {
      id: summary.id,
      title: summary.title ?? undefined,
      content: summary.content ?? undefined,
    };
  } catch (error) {
    console.error("Failed to get or create summary:", error);
    return null;
  }
}

export async function updateSummaryContent(
  summaryId: string,
  content?: string,
  title?: string
): Promise<{ success: boolean }> {
  try {
    await updateSummary({
      summaryId,
      title: title ?? null,
      content: content ?? null,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to update summary:", error);
    throw error;
  }
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<{ success: boolean }> {
  try {
    await updateConversation(conversationId, title);
    return { success: true };
  } catch (error) {
    console.error("Failed to update conversation title:", error);
    throw error;
  }
}

export async function deleteConversationById(
  conversationId: string
): Promise<{ success: boolean }> {
  try {
    const result = await deleteConversation(conversationId);
    return { success: result };
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    throw error;
  }
}

export async function getConversationMessagesList(
  conversationId: string
): Promise<ConversationMessage[]> {
  const messages = await getConversationMessages(conversationId);
  return messages.map(convertConversationMessage);
}

export async function saveConversationMessage(input: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
}): Promise<ConversationMessage> {
  const dbMessage = await createConversationMessage({
    conversation_id: input.conversationId,
    user_id: input.userId,
    role: input.role,
    content: input.content,
  });
  return convertConversationMessage(dbMessage);
}

export async function generateSummaryWithAI(conversationId: string): Promise<{
  success: boolean;
  summary: string;
}> {
  try {
    // Buscar informações da conversa
    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Buscar mensagens do chat (se houver)
    let chatMessages: DbMessage[] = [];
    try {
      const chat = await getChatByConversationId(conversationId);
      if (chat) {
        chatMessages = await getMessages(chat.id);
      }
    } catch (error) {
      console.warn("Failed to fetch chat messages:", error);
    }

    // Buscar transcrições (se houver)
    let transcriptionSegments: DbTranscriptionSegment[] = [];
    try {
      transcriptionSegments = await getTranscriptionSegmentsByConversationId(
        conversationId
      );
    } catch (error) {
      console.warn("Failed to fetch transcription segments:", error);
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
}
