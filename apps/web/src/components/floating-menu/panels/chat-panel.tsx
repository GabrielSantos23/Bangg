import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useUser } from "@/hooks/useUser";
import { getChatMessages, type Message } from "@/services/chat";
import { useScreenshot } from "@/hooks/useScreenshot";
import { Button } from "@/components/ui/button";

import { Loader } from "@/components/ai-elements/loader";
import { ChatInputForm } from "../chat-components/chat-input-form";
import { UserMessage } from "../chat-components/UserMessage";
import { AssistantMessage } from "../chat-components/AssistantMessage";
import { MessageContent } from "@/components/ai-elements/message";

interface ChatPanelProps {
  onClose?: () => void;
  chatId?: string;
  autoScreenshot?: boolean;
  setAutoScreenshot?: (value: boolean) => void;
  onChatClosed?: () => void;
  initialCapture?: string;
}

export function ChatPanel({
  chatId: initialChatId,
  autoScreenshot = false,
  setAutoScreenshot,
  onChatClosed,
  initialCapture,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(
    initialChatId
  );
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [hasFocus, setHasFocus] = useState(true); // Assume focused by default
  const { user } = useUser();
  const userId = user?.id;
  const hasLoadedMessagesRef = useRef(false);
  const initialCaptureAddedRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { takeScreenshot } = useScreenshot();

  // Add initial capture to attachments when received (only once)
  useEffect(() => {
    if (initialCapture && !initialCaptureAddedRef.current) {
      setAttachments((prev) => {
        if (!prev.includes(initialCapture)) {
          initialCaptureAddedRef.current = true;
          return [...prev, initialCapture];
        }
        return prev;
      });
    }
    // Reset when initialCapture changes
    if (!initialCapture) {
      initialCaptureAddedRef.current = false;
    }
  }, [initialCapture]);

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
        const dbMessages = await getChatMessages(currentChatId);
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

  // Handle focus/blur events - check window focus state
  useEffect(() => {
    let mounted = true;

    const checkFocus = async () => {
      try {
        const appWindow = getCurrentWindow();
        if (appWindow && mounted) {
          const isFocused = await appWindow.isFocused();
          if (mounted) {
            setHasFocus(isFocused);
          }
        }
      } catch (error) {
        console.error("Error checking window focus:", error);
        // Default to focused if we can't check
        if (mounted) {
          setHasFocus(true);
        }
      }
    };

    // Check initial focus state with a small delay to ensure window is ready
    const timeoutId = setTimeout(() => {
      checkFocus();
    }, 100);

    // Listen for window focus events
    const handleWindowFocus = () => {
      if (mounted) {
        setHasFocus(true);
      }
    };

    const handleWindowBlur = () => {
      if (mounted) {
        setHasFocus(false);
      }
    };

    // Also listen to container focus for better UX
    const container = chatContainerRef.current;
    const handleContainerFocus = () => {
      if (mounted) {
        setHasFocus(true);
      }
    };
    const handleContainerBlur = (e: FocusEvent) => {
      // Only set to false if focus is moving outside the container
      if (!container?.contains(e.relatedTarget as Node) && mounted) {
        setHasFocus(false);
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);

    if (container) {
      container.addEventListener("focusin", handleContainerFocus);
      container.addEventListener("focusout", handleContainerBlur);
    }

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
      if (container) {
        container.removeEventListener("focusin", handleContainerFocus);
        container.removeEventListener("focusout", handleContainerBlur);
      }
    };
  }, []);

  // Resize window based on state: messages, focus, and attachments
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const resizeWindow = async () => {
      try {
        const appWindow = getCurrentWindow();
        if (!appWindow || !mounted) return;

        const currentSize = await appWindow.innerSize();
        if (!mounted) return;

        const currentWidth = currentSize.width;
        const hasScreenshot = attachments.length > 0;

        let height: number;

        if (messages.length === 0) {
          // No messages - base height
          if (hasScreenshot && hasFocus) {
            height = 220; // Chat com screenshot e foco
          } else if (hasScreenshot && !hasFocus) {
            height = 200; // Chat com screenshot sem foco
          } else if (hasFocus) {
            height = 170; // Chat sem screenshot com foco
          } else {
            height = 150; // Chat sem screenshot sem foco
          }
        } else {
          // Has messages - larger height
          if (hasScreenshot && hasFocus) {
            height = 520; // Chat com mensagens, screenshot e foco
          } else if (hasScreenshot && !hasFocus) {
            height = 480; // Chat com mensagens, screenshot sem foco
          } else if (hasFocus) {
            height = 440; // Chat com mensagens, sem screenshot, com foco
          } else {
            height = 400; // Chat com mensagens, sem screenshot, sem foco
          }
        }

        if (mounted) {
          await appWindow.setSize(new LogicalSize(currentWidth, height));
        }
      } catch (error) {
        console.error("Error resizing window:", error);
        // Don't throw - just log the error
      }
    };

    // Debounce resize to avoid too many calls
    timeoutId = setTimeout(() => {
      resizeWindow();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [messages.length, hasFocus, attachments.length]);

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
    <div
      ref={chatContainerRef}
      className="flex h-96 flex-col relative"
      tabIndex={-1}
    >
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
