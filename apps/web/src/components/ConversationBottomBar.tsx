import { Button } from "@/components/ui/button";
import { ArrowUpRight, Play, MessageSquare, Loader2, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useUser } from "@/hooks/useUser";
import { getConversationMessagesList } from "@/services/conversation";
import { UserMessage } from "@/components/floating-menu/chat-components/UserMessage";
import { AssistantMessage } from "@/components/floating-menu/chat-components/AssistantMessage";

interface ConversationBottomBarProps {
  existingChat: any;
  isCheckingChat: boolean;
  onResumeOrStartSession: () => void;
  conversationId: string;
}

export function ConversationBottomBar({
  existingChat,
  isCheckingChat,
  onResumeOrStartSession,
  conversationId,
}: ConversationBottomBarProps) {
  const { user } = useUser();
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasLoadedMessagesRef = useRef(false);

  // Load existing messages
  useEffect(() => {
    if (!conversationId || !user?.id || hasLoadedMessagesRef.current) return;

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const dbMessages = await getConversationMessagesList(conversationId);
        const formattedMessages: UIMessage[] = dbMessages.map((msg) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant" | "system",
          parts: [{ type: "text" as const, text: msg.content }],
        }));
        setInitialMessages(formattedMessages);
        hasLoadedMessagesRef.current = true;
      } catch (error) {
        console.error("Failed to load conversation messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [conversationId, user?.id]);

  const [inputValue, setInputValue] = useState("");

  // Use chat hook
  const { messages, setMessages, sendMessage, status } = useChat({
    experimental_throttle: 120,
    transport: new DefaultChatTransport({
      api: "/api/conversation-chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          conversationId,
          userId: user?.id,
        },
      }),
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Update messages when initial messages load
  useEffect(() => {
    if (
      initialMessages.length > 0 &&
      hasLoadedMessagesRef.current &&
      messages.length === 0
    ) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isChatExpanded) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [isChatExpanded]);

  // Expand chat when user starts typing or sends message
  useEffect(() => {
    if (inputValue.trim() && !isChatExpanded) {
      setIsChatExpanded(true);
    }
  }, [inputValue, isChatExpanded]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    // Expand chat if not already expanded
    if (!isChatExpanded) {
      setIsChatExpanded(true);
    }

    sendMessage({
      parts: [{ type: "text", text: inputValue.trim() }],
    });
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 px-6 py-4 pointer-events-none">
      <div className="mx-auto max-w-2xl pointer-events-auto">
        <div className={`${isChatExpanded && "bg-card/95 backdrop-blur-sm border border-border"}  rounded-2xl shadow-lg overflow-hidden transition-all duration-300 ease-in-out`}>
          {/* Header - Only visible when expanded */}
          {isChatExpanded && (
            <div className="flex items-center justify-end px-4 py-0.5 ">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-accent/50"
                onClick={() => setIsChatExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Messages Section - Only visible when expanded */}
          {isChatExpanded && (
            <div className="">
              <div className="max-h-96 overflow-y-auto p-4 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">
                      No messages yet. Start a conversation!
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((message, index) => {
                      const isLastMessage = index === messages.length - 1;

                      if (message.role === "user") {
                        return (
                          <UserMessage key={message.id} message={message} />
                        );
                      }

                      if (message.role === "assistant") {
                        return (
                          <AssistantMessage
                            key={message.id}
                            message={message}
                            status={
                              isLoading && isLastMessage
                                ? "streaming"
                                : "submitted"
                            }
                            isLastMessage={isLastMessage}
                            onRegenerate={() => {}}
                          />
                        );
                      }

                      return null;
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </div>
          )}

          <div className="p-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                className="gap-2 bg-background/50 backdrop-blur-sm rounded-full text-xs text-muted-foreground shrink-0 border-border/50"
                onClick={onResumeOrStartSession}
                disabled={isCheckingChat}
              >
                {existingChat ? (
                  <>
                    <Play className="h-3 w-3 fill-current" />
                    Resume Session
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-3 w-3" />
                    Start Conversation
                  </>
                )}
              </Button>

              <form
                onSubmit={handleFormSubmit}
                className="flex-1 bg-background/50 border border-border/50 rounded-full pl-4 pr-1 py-0.5 flex items-center justify-between"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => {
                    if (messages.length > 0 && !isChatExpanded) {
                      setIsChatExpanded(true);
                    }
                  }}
                  placeholder="Ask about this conversation..."
                  className="flex-1 text-sm outline-none placeholder:text-muted-foreground bg-transparent backdrop-blur-sm"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0 bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={!inputValue.trim() || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
