"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ImageIcon,
  Sparkles,
  Mic,
  ArrowUp,
  X,
  Loader2,
  Monitor,
  Eye,
  EyeOff,
} from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useUser } from "@/hooks/useUser";
import { getChatMessages, type Message } from "@/services/chat";
import { useScreenshot } from "@/hooks/useScreenshot";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useVisibility } from "@/contexts/VisibilityContext";
import { AudioRecorder } from "@/components/floating-menu/AudioRecorder";
import {
  startSystemAudioRecording,
  stopSystemAudioRecordingAndTranscribe,
} from "@/lib/systemAudioRecording";
import {
  createTranscription,
  saveTranscriptionSegments,
} from "@/services/transcription.server";
import { UserMessage } from "@/components/floating-menu/chat-components/UserMessage";
import { AssistantMessage } from "@/components/floating-menu/chat-components/AssistantMessage";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message as MessageComponent,
  MessageContent,
} from "@/components/ai-elements/message";
import { motion } from "framer-motion";

interface FloatingChatProps {
  chatId?: string;
  initialCapture?: string;
  onChatClosed?: () => void;
}

export function FloatingChat({
  chatId: initialChatId,
  initialCapture,
  onChatClosed,
}: FloatingChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(
    initialChatId
  );
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [autoScreenshot, setAutoScreenshot] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<
    string | null
  >(null);
  const { isVisible, isContentProtected, toggleVisibilityAndProtection } =
    useVisibility();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const originalSize = useRef<{ width: number; height: number } | null>(null);
  const isRestoringRef = useRef(false);
  const hasLoadedMessagesRef = useRef(false);
  const initialCaptureAddedRef = useRef(false);
  const { user } = useUser();
  const userId = user?.id;
  const userIdRef = useRef(userId);
  const { takeScreenshot } = useScreenshot();
  const { startCapture, capturedImage, isCapturing } = useScreenCapture();

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  // Handle captured image from screen capture - add to attachments and disable autoScreenshot
  useEffect(() => {
    if (capturedImage) {
      // Add captured image to attachments
      setAttachments((prev) => {
        if (!prev.includes(capturedImage)) {
          return [...prev, capturedImage];
        }
        return prev;
      });
      // Disable autoScreenshot when user manually captures
      setAutoScreenshot(false);
      // Don't expand messages area - just resize window to show preview
    }
  }, [capturedImage]);

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
    if (!initialCapture) {
      initialCaptureAddedRef.current = false;
    }
  }, [initialCapture]);

  useEffect(() => {
    if (initialChatId !== currentChatId) {
      setCurrentChatId(initialChatId);
      hasLoadedMessagesRef.current = false;
      setInitialMessages([]);
      setMessages([]);
    }
  }, [initialChatId, currentChatId]);

  // Load messages from database if chatId exists
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

            // Add attachments as image parts first
            if (
              msg.attachments &&
              Array.isArray(msg.attachments) &&
              msg.attachments.length > 0
            ) {
              msg.attachments.forEach((attachment) => {
                if (attachment && typeof attachment === "string") {
                  parts.push({
                    type: "image",
                    image: attachment,
                  });
                }
              });
            }

            if (msg.content && msg.content.trim()) {
              parts.push({ type: "text" as const, text: msg.content });
            }

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
        // Expand if we have messages
        if (formattedMessages.length > 0) {
          setIsExpanded(true);
        }
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
    experimental_throttle: 120,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => {
        const currentUserId = userIdRef.current;
        if (!currentUserId) {
          throw new Error("User not authenticated. Please sign in.");
        }
        return {
          body: {
            messages,
            chatId: currentChatId,
            userId: currentUserId,
          },
        };
      },
    }),
  });

  useEffect(() => {
    if (
      currentChatId &&
      initialMessages.length > 0 &&
      hasLoadedMessagesRef.current &&
      messages.length === 0
    ) {
      setMessages(initialMessages);
    }
  }, [currentChatId, initialMessages, messages.length, setMessages]);

  // Store original window size on mount
  useEffect(() => {
    const storeOriginalSize = async () => {
      if (originalSize.current) return; // Already stored

      try {
        const appWindow = getCurrentWindow();
        const size = await appWindow.innerSize();
        originalSize.current = { width: size.width, height: size.height };
      } catch (error) {
        console.error("Error getting window size:", error);
      }
    };
    storeOriginalSize();
  }, []);

  // Resize window based on expanded state, messages, and attachments
  useEffect(() => {
    let mounted = true;
    let debounceTimeoutId: NodeJS.Timeout | null = null;
    let restoreTimeoutId: NodeJS.Timeout | null = null;

    const resizeWindow = async () => {
      try {
        const appWindow = getCurrentWindow();
        if (!appWindow || !mounted) return;

        const currentSize = await appWindow.innerSize();
        if (!mounted) return;

        const currentWidth = currentSize.width;
        const hasMessages = messages.length > 0;
        const hasAttachments = attachments.length > 0;
        const shouldExpand = isExpanded || hasMessages;

        if (shouldExpand && !isRestoringRef.current) {
          // Expand to chat height - match the h-[600px] from the component
          const height = 600;
          await appWindow.setSize(new LogicalSize(currentWidth, height));
        } else if (hasAttachments && !shouldExpand && !isRestoringRef.current) {
          // If there are attachments but no messages, resize to show preview
          // Height: input area (~120px) + preview area (~80px) + padding
          const height = 220;
          await appWindow.setSize(new LogicalSize(currentWidth, height));
        } else if (
          !shouldExpand &&
          !hasAttachments &&
          originalSize.current &&
          !isRestoringRef.current
        ) {
          // Restore original size when closing with delay for animations
          isRestoringRef.current = true;

          restoreTimeoutId = setTimeout(async () => {
            if (!mounted) {
              isRestoringRef.current = false;
              return;
            }

            // Check again if still should be collapsed
            const currentSizeCheck = await appWindow.innerSize();
            if (!mounted) {
              isRestoringRef.current = false;
              return;
            }

            if (originalSize.current) {
              // Only restore if current size is different from original
              if (
                currentSizeCheck.width !== originalSize.current.width ||
                currentSizeCheck.height !== originalSize.current.height
              ) {
                await appWindow.setSize(
                  new LogicalSize(
                    originalSize.current.width,
                    originalSize.current.height
                  )
                );
              }
            }
            isRestoringRef.current = false;
          }, 350); // Match the restoreDelay from usePanelWindowResize
        }
      } catch (error) {
        console.error("Error resizing window:", error);
        isRestoringRef.current = false;
      }
    };

    // Debounce resize to avoid too many calls
    debounceTimeoutId = setTimeout(() => {
      resizeWindow();
    }, 100);

    return () => {
      mounted = false;
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
      }
      if (restoreTimeoutId) {
        clearTimeout(restoreTimeoutId);
      }
    };
  }, [isExpanded, messages.length, attachments.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const newAttachments = prev.filter((_, i) => i !== index);
      // Re-enable autoScreenshot when all attachments are removed
      if (newAttachments.length === 0 && !autoScreenshot) {
        setAutoScreenshot(true);
      }
      return newAttachments;
    });
  };

  const toggleRecording = async () => {
    if (isRecording || isTranscribing || isStartingRecording) {
      // Stop recording
      await handleStopRecording();
    } else {
      // Start recording
      await handleStartRecording();
    }
  };

  const handleStartRecording = async () => {
    // Prevent multiple clicks
    if (isRecording || isTranscribing || isStartingRecording) {
      console.warn("Recording already in progress, ignoring click");
      return;
    }

    setIsStartingRecording(true);

    try {
      // Create a new transcription session in the database first
      if (userId) {
        try {
          const newTranscription = await createTranscription({
            data: { userId, title: undefined },
          });
          setCurrentTranscriptionId(newTranscription.id);
          console.log("Transcription session created:", newTranscription.id);
        } catch (dbError) {
          console.warn("Failed to create transcription in database:", dbError);
          // Continue anyway - we can still transcribe without saving
        }
      }

      // Start recording - this should happen after DB creation
      console.log("Starting system audio recording...");
      try {
        await startSystemAudioRecording();
        console.log("Recording started successfully");
        setIsRecording(true);
        setIsStartingRecording(false);
      } catch (recordingError) {
        const errorMessage =
          recordingError instanceof Error
            ? recordingError.message
            : String(recordingError);

        // If recording is already in progress, try to stop it first and retry
        if (errorMessage.includes("Recording already in progress")) {
          console.warn("Recording state was stuck, attempting to reset...");
          try {
            // Try to stop any existing recording
            await stopSystemAudioRecordingAndTranscribe();
          } catch (stopError) {
            console.warn("Failed to stop existing recording:", stopError);
          }

          // Wait a bit and try again
          await new Promise((resolve) => setTimeout(resolve, 500));

          try {
            await startSystemAudioRecording();
            console.log("Recording started successfully after reset");
            setIsRecording(true);
            setIsStartingRecording(false);
          } catch (retryError) {
            setIsStartingRecording(false);
            throw retryError;
          }
        } else {
          setIsStartingRecording(false);
          throw recordingError;
        }
      }
    } catch (err) {
      // Reset state on error
      setIsRecording(false);
      setIsStartingRecording(false);
      setCurrentTranscriptionId(null);
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Failed to start recording:", errorMessage);
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;

    try {
      setIsRecording(false);
      setIsTranscribing(true);

      // Stop recording and transcribe (all done in Rust backend)
      const segments = await stopSystemAudioRecordingAndTranscribe();

      // Save transcription segments to database if we have a transcription ID and userId
      if (segments && segments.length > 0 && currentTranscriptionId && userId) {
        try {
          await saveTranscriptionSegments({
            data: {
              transcriptionId: currentTranscriptionId,
              segments: segments.map((seg) => ({
                text: seg.text,
                startTime: seg.start,
                endTime: seg.end,
              })),
            },
          });
          console.log("Transcription saved to database");
          // Clear the transcription ID after saving
          setTimeout(() => {
            setCurrentTranscriptionId(null);
          }, 3000);
        } catch (dbError) {
          console.error("Failed to save transcription to database:", dbError);
        }
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const isSending =
    status === "submitted" || status === "streaming" || isTakingScreenshot;

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }

    const trimmed = inputValue.trim();
    if ((!trimmed && attachments.length === 0) || isSending || !userId) {
      return;
    }

    const messageText = trimmed || "";
    setInputValue("");
    let attachmentsToSend = [...attachments];
    setAttachments([]);

    // Auto screenshot if enabled
    if (autoScreenshot && attachmentsToSend.length === 0) {
      setIsTakingScreenshot(true);
      try {
        const screenshot = await takeScreenshot();
        if (screenshot) {
          attachmentsToSend = [screenshot];
        }
      } catch (error) {
        console.error("Failed to take screenshot:", error);
      } finally {
        setIsTakingScreenshot(false);
      }
    }

    // Expand if not already expanded
    if (!isExpanded) {
      setIsExpanded(true);
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

  const handleCloseChat = () => {
    setIsExpanded(false);
    setMessages([]);
    setInputValue("");
    setAttachments([]);
    setCurrentChatId(undefined);
    hasLoadedMessagesRef.current = false;
    setInitialMessages([]);
    if (onChatClosed) {
      onChatClosed();
    }
  };

  if (isLoadingMessages && currentChatId) {
    return (
      <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 z-50">
        <div className="bg-transparent rounded-2xl shadow-2xl border border-[#3f3f3f] p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 z-50">
        <div className="bg-card/60 rounded-2xl shadow-2xl border border-[#3f3f3f] p-8 flex flex-col items-center justify-center space-y-4">
          <h3 className="text-lg font-semibold text-gray-300">
            Sign in required
          </h3>
          <p className="text-sm text-gray-400 text-center">
            Please sign in to start chatting with AI
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed  md:left-auto md:right-6 z-50 w-full">
      <div
        className={`bg-card/60 rounded-2xl shadow-2xl border  overflow-hidden transition-all duration-200 ease-out origin-bottom ${
          isExpanded ? "h-[600px] scale-y-100" : "h-auto scale-y-100"
        }`}
        style={{
          transformOrigin: "bottom",
        }}
      >
        <div
          className={`transition-all duration-200 ${
            isExpanded ? "opacity-100 h-[468px]" : "opacity-0 h-0"
          } overflow-hidden`}
        >
          <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
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
                      status={
                        status === "error"
                          ? "awaiting"
                          : (status as
                              | "streaming"
                              | "submitted"
                              | "awaiting"
                              | "in_progress")
                      }
                      isLastMessage={isLastMessage}
                      onRegenerate={regenerate}
                    />
                  );
                default:
                  return null;
              }
            })}

            {/* Show loader when AI is "typing" */}
            {status === "submitted" && (
              <MessageComponent from="assistant">
                <MessageContent>
                  <Loader />
                </MessageContent>
              </MessageComponent>
            )}
          </div>
        </div>

        <div className={`p-4 ${isExpanded ? "border-t border-[#3f3f3f]" : ""}`}>
          <div className="relative">
            {/* Show attachments preview */}
            {attachments.length > 0 && (
              <div className="mb-2 pb-2 border-b border-[#3f3f3f] flex justify-start">
                <div className="space-y-2">
                  {attachments.map((img, index) => (
                    <div
                      key={index}
                      className="relative inline-block rounded-lg border border-[#4a4a4a] overflow-hidden bg-[#1a1a1a]"
                      style={{ display: "inline-block" }}
                    >
                      <img
                        src={`data:image/png;base64,${img}`}
                        alt={`Preview ${index + 1}`}
                        className="max-h-10 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="absolute top-0 right-0 flex items-center justify-center w-6 h-6 bg-[#3a3a3a]/90 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-gray-300 rounded-full transition-all duration-200 border border-white/10 backdrop-blur-xl shadow-xl p-0"
                        aria-label="Remove attachment"
                        disabled={isSending}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything (⏎ for new line)"
              className="w-full bg-transparent text-gray-300 placeholder:text-gray-500 resize-none outline-none text-base leading-relaxed min-h-[24px] max-h-[120px] pr-4"
              rows={1}
              disabled={isSending || !userId}
              style={{
                paddingLeft: "4px",
                borderLeft: "2px solid #0a84ff",
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleVisibilityAndProtection}
                className={`w-8 h-8 flex items-center justify-center hover:bg-[#3a3a3a] rounded-lg transition-colors shrink-0 ${
                  isContentProtected ? "ring-2 ring-amber-500/50" : ""
                }`}
                disabled={isSending}
                title={
                  isContentProtected
                    ? "Window is protected from screenshots"
                    : "Window can be captured in screenshots"
                }
              >
                {isContentProtected ? (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => startCapture()}
                className="w-8 h-8 flex items-center justify-center hover:bg-[#3a3a3a] rounded-lg transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSending || isCapturing}
                title="Capture screen"
              >
                {isCapturing ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {isRecording || isStartingRecording || isTranscribing ? (
                <AudioRecorder
                  onStop={toggleRecording}
                  isStarting={isStartingRecording}
                  isTranscribing={isTranscribing}
                />
              ) : (
                <button
                  onClick={toggleRecording}
                  disabled={isStartingRecording || isSending}
                  className="w-8 h-8 flex items-center justify-center hover:bg-[#3a3a3a] rounded-lg transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Start listening"
                >
                  <Mic className="w-5 h-5 text-gray-400" />
                </button>
              )}
              <button
                onClick={() => setAutoScreenshot(!autoScreenshot)}
                disabled={attachments.length > 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 h-auto rounded-lg text-xs leading-none transition-colors shrink-0 ${
                  attachments.length > 0
                    ? "bg-transparent border border-[#4a4a4a] text-gray-500 cursor-not-allowed opacity-50"
                    : autoScreenshot
                    ? "bg-[#1a2943] border border-[#6dbeef] text-[#6dbeef] hover:bg-[#1b335a]"
                    : "bg-transparent border border-[#4a4a4a] text-gray-400 hover:text-gray-300"
                }`}
                title={
                  attachments.length > 0
                    ? "Remove existing screenshot to enable"
                    : autoScreenshot
                    ? "Disable auto screenshot"
                    : "Enable auto screenshot"
                }
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Use Screen</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => handleSubmit()}
                disabled={
                  (!inputValue.trim() && attachments.length === 0) ||
                  isSending ||
                  !userId
                }
                className="w-10 h-10 rounded-full bg-[#0a84ff] hover:bg-[#0a84ff]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center p-0"
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5 text-white" />
                )}
              </Button>
            </div>
          </div>

          {chatError && (
            <div className="mt-2 rounded-md border border-red-500/50 bg-red-900/10 px-3 py-2 text-xs text-red-400">
              {chatError.message}
            </div>
          )}

          {isExpanded && (
            <button
              onClick={handleCloseChat}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#3a3a3a] hover:bg-[#4a4a4a] flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-300" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
