import { useEffect, useState } from "react";
import { getChatByConversation, getChatMessages } from "@/services/chat";
import type { Message } from "@/services/chat";
import type { UIMessage } from "ai";
import { UserMessageChatTab } from "@/components/floating-menu/chat-components/UserMessageChatTab";
import { AssistantMessage } from "@/components/floating-menu/chat-components/AssistantMessage";

interface ChatTabProps {
  conversationId: string;
}

export function ChatTab({ conversationId }: ChatTabProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChat, setHasChat] = useState(false);

  useEffect(() => {
    const loadMessages = async () => {
      if (!conversationId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Buscar o chat associado à conversa
        const chat = await getChatByConversation(conversationId);

        if (!chat) {
          setHasChat(false);
          setMessages([]);
          return;
        }

        setHasChat(true);

        // Buscar as mensagens do chat
        const dbMessages = await getChatMessages(chat.id);

        // Converter mensagens do banco para formato UIMessage
        const formattedMessages: UIMessage[] = dbMessages.map(
          (msg: Message) => {
            const parts: any[] = [];

            // Adicionar attachments como parts de imagem primeiro (para exibir antes do texto)
            // Verificar se attachments existe e é um array válido
            if (
              msg.attachments &&
              Array.isArray(msg.attachments) &&
              msg.attachments.length > 0
            ) {
              msg.attachments.forEach((attachment) => {
                // Garantir que o attachment seja uma string válida
                if (attachment && typeof attachment === "string") {
                  parts.push({
                    type: "image",
                    image: attachment, // attachment is already a data URL
                  });
                }
              });
            }

            // Adicionar part de texto apenas se houver conteúdo
            if (msg.content && msg.content.trim()) {
              parts.push({ type: "text" as const, text: msg.content });
            }

            // Se não houver parts (sem texto e sem attachments), criar um part de texto vazio
            if (parts.length === 0) {
              parts.push({ type: "text" as const, text: "" });
            }

            return {
              id: msg.id,
              role: msg.role as "user" | "assistant" | "system",
              parts: parts,
            };
          }
        );

        setMessages(formattedMessages);
      } catch (error) {
        console.error("Failed to load messages:", error);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [conversationId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <p className="text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  if (!hasChat) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6">
        <p className="text-muted-foreground text-center">
          No chat found for this conversation.
        </p>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Start a conversation to see messages here.
        </p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6">
        <p className="text-muted-foreground text-center">No messages yet.</p>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Start chatting to see messages here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex-1 space-y-4 p-6">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;

          if (message.role === "user") {
            return <UserMessageChatTab key={message.id} message={message} />;
          }

          if (message.role === "assistant") {
            return (
              <AssistantMessage
                key={message.id}
                message={message}
                status="submitted"
                isLastMessage={isLastMessage}
                onRegenerate={() => {}}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
