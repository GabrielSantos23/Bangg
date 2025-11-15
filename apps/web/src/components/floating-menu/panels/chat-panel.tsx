import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useUser } from "@/hooks/useUser";
import { getChatMessages } from "@/services/chat.server";
import { useScreenshot } from "@/hooks/useScreenshot";
import { Button } from "@/components/ui/button";

import { Loader } from "@/components/ai-elements/loader";
import { ChatInputForm } from "../chat-components/chat-input-form";
import { UserMessage } from "../chat-components/UserMessage";
import { AssistantMessage } from "../chat-components/AssistantMessage";
import { Message, MessageContent } from "@/components/ai-elements/message";

interface ChatPanelProps {
  onClose?: () => void;
  chatId?: string;
  autoScreenshot?: boolean;
  setAutoScreenshot?: (value: boolean) => void;
  onChatClosed?: () => void;
}

export function ChatPanel({
  chatId: initialChatId,
  autoScreenshot = false,
  setAutoScreenshot,
  onChatClosed,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(
    initialChatId
  );
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const { user } = useUser();
  const userId = user?.id;
  const hasLoadedMessagesRef = useRef(false);
  const { takeScreenshot } = useScreenshot();

  // Update currentChatId when initialChatId prop changes
  useEffect(() => {
    // Only update if the prop actually changed
    if (initialChatId !== currentChatId) {
      setCurrentChatId(initialChatId);
      // Reset loaded state when chatId changes
      hasLoadedMessagesRef.current = false;
      setInitialMessages([]);
      setMessages([]);
    }
  }, [initialChatId, currentChatId]);

  useEffect(() => {
    if (!currentChatId || !userId) {
      setInitialMessages([]);
      hasLoadedMessagesRef.current = false;
      return;
    }
    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const dbMessages = await getChatMessages({
          data: { chatId: currentChatId },
        });
        const formattedMessages: UIMessage[] = dbMessages.map((msg) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant" | "system",
          parts: [{ type: "text" as const, text: msg.content }],
        }));
        setInitialMessages(formattedMessages);
        hasLoadedMessagesRef.current = true;
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    if (!hasLoadedMessagesRef.current && currentChatId) {
      loadMessages();
    }
  }, [currentChatId, userId]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error: chatError,
    regenerate,
  } = useChat({
    initialMessages: initialMessages,
    experimental_throttle: 120,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          chatId: currentChatId,
          userId,
        },
      }),
    }),
    onResponse: async (response) => {
      const chatIdFromHeader = response.headers.get("X-Chat-Id");
      if (chatIdFromHeader && !currentChatId) {
        setCurrentChatId(chatIdFromHeader);
      }
    },
    onFinish: async () => {},
  });

  useEffect(() => {
    // ... (This logic remains the same)
    if (
      currentChatId &&
      initialMessages.length > 0 &&
      hasLoadedMessagesRef.current &&
      messages.length === 0
    ) {
      setMessages(initialMessages);
    }
  }, [currentChatId, initialMessages, messages.length, setMessages]);

  useEffect(() => {
    // ... (This logic remains the same)
    const resizeWindow = async () => {
      const appWindow = getCurrentWindow();
      try {
        const currentSize = await appWindow.innerSize();
        const currentWidth = currentSize.width;
        if (messages.length === 0) {
          await appWindow.setSize(new LogicalSize(currentWidth, 350));
        } else {
          await appWindow.setSize(new LogicalSize(currentWidth, 600));
        }
      } catch (error) {
        console.error("Error resizing window:", error);
      }
    };
    resizeWindow();
  }, [messages.length]);

  const isSending =
    status === "submitted" || status === "streaming" || isTakingScreenshot;

  const removeAttachment = (index: number) => {
    // ... (This logic remains the same)
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // ... (This logic remains the same)
    event.preventDefault();
    const trimmed = inputValue.trim();
    if ((!trimmed && attachments.length === 0) || isSending || !userId) {
      return;
    }
    const messageText = trimmed || "";
    setInputValue("");
    let attachmentsToSend = [...attachments];
    setAttachments([]);
    if (autoScreenshot) {
      setIsTakingScreenshot(true);
      try {
        const screenshot = await takeScreenshot();
        if (screenshot) {
          attachmentsToSend = [...attachmentsToSend, screenshot];
        }
      } catch (error) {
        console.error("Failed to take screenshot:", error);
      } finally {
        setIsTakingScreenshot(false);
      }
    }
    try {
      const parts: Array<{
        type: "text" | "image";
        text?: string;
        image?: string;
      }> = [];
      if (messageText) {
        parts.push({ type: "text", text: messageText });
      }
      for (const imageBase64 of attachmentsToSend) {
        parts.push({
          type: "image",
          image: `data:image/png;base64,${imageBase64}`,
        });
      }
      sendMessage({
        parts: parts as any,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputValue(messageText);
      setAttachments(attachmentsToSend);
    }
  };

  const inputFormProps = {
    // ... (This logic remains the same)
    handleSubmit,
    inputValue,
    setInputValue,
    attachments,
    removeAttachment,
    isSending,
    autoScreenshot,
    chatError,
  };

  if (!user) {
    // ... (This logic remains the same)
    return (
      <div className="flex h-64 flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full space-y-4 text-center"
        >
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold">Sign in required</h3>
            <p className="text-muted-foreground">
              Please sign in to start chatting with AI
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoadingMessages && currentChatId) {
    // ... (This logic remains the same)
    return (
      <div className="flex h-64 flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full space-y-4 text-center"
        >
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading conversation...</p>
        </motion.div>
      </div>
    );
  }

  if (messages.length === 0) {
    // ... (This logic remains the same)
    return (
      <div className="flex flex-col items-center justify-center p-2 rounded-2xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full space-y-4 text-center"
        >
          <ChatInputForm
            {...inputFormProps}
            autoFocus={true}
            setAutoScreenshot={setAutoScreenshot}
          />
        </motion.div>
      </div>
    );
  }

  const handleCloseChat = () => {
    // Reset chat state
    setCurrentChatId(undefined);
    setInitialMessages([]);
    setMessages([]);
    hasLoadedMessagesRef.current = false;
    setInputValue("");
    setAttachments([]);
    // Notify parent component that chat was closed
    if (onChatClosed) {
      onChatClosed();
    }
  };

  return (
    <div className="flex h-96 flex-col relative">
      {/* Close button - only show when there are messages */}
      {messages.length > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
          onClick={handleCloseChat}
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      {/* ✨ UPDATED RENDER BLOCK */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          switch (message.role) {
            case "user":
              return <UserMessage key={message.id} message={message} />;
            case "assistant":
              return (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  status={status}
                  isLastMessage={isLastMessage}
                  onRegenerate={regenerate}
                />
              );
            default:
              return null;
          }
        })}

        {/* ✨ Added loader for when AI is "typing" */}
        {status === "submitted" && (
          <Message from="assistant" type="empty">
            <MessageContent>
              <Loader />
            </MessageContent>
          </Message>
        )}
      </div>

      <div className="border-t border-border/50 p-4">
        <ChatInputForm
          {...inputFormProps}
          autoFocus={false}
          setAutoScreenshot={setAutoScreenshot}
        />
      </div>
    </div>
  );
}
