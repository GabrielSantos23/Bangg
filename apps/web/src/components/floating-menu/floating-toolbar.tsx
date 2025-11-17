import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Eye,
  X,
  GripVertical,
  EyeOff,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./panels/chat-panel";
import { GridPanel } from "./panels/grid-panel";
import { ModelsPanel } from "./panels/models-panel";
import { HelpPanel } from "./panels/help-panel";
import { SettingsPanel } from "./panels/settings-panel";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useUser } from "@/hooks/useUser";
import { AudioRecorder } from "./AudioRecorder";
import { HatGlassesIcon } from "../../../public/HatGlasses";
import { Separator } from "../ui/separator";
import { DashedBorder } from "../DashedBorder";
import { useVisibility } from "@/contexts/VisibilityContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import {
  startSystemAudioRecording,
  stopSystemAudioRecordingAndTranscribe,
} from "@/lib/systemAudioRecording";
import {
  createTranscription,
  saveTranscriptionSegments,
} from "@/services/transcription.server";
import { listen } from "@tauri-apps/api/event";
import { usePanelWindowResize } from "@/hooks/usePanelWindowResize";
import { useScreenCapture } from "@/hooks/useScreenCapture";

type PanelType = "chat" | "grid" | "models" | "help" | "settings" | null;

export function FloatingToolbar() {
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const { isVisible, isContentProtected, toggleVisibilityAndProtection } =
    useVisibility();
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<
    string | null
  >(null);
  const [isClosingChat, setIsClosingChat] = useState(false);
  const [autoScreenshot, setAutoScreenshot] = useState(true);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const chatPanelKey = useRef(0);
  const { user } = useUser();
  const userId = user?.id;

  // Hook para gerenciar redimensionamento automático da janela baseado no painel ativo
  usePanelWindowResize({ activePanel, restoreDelay: 350 });

  const { startCapture, capturedImage, isCapturing } = useScreenCapture();

  // Intercept close event to hide window instead of closing
  useEffect(() => {
    const appWindow = getCurrentWindow();

    // Interceptar o evento de fechar
    const setupCloseHandler = async () => {
      try {
        const unlisten = await appWindow.onCloseRequested(async (event) => {
          // Prevenir o fechamento padrão
          event.preventDefault();

          // Fechar chat se estiver aberto
          setChatId(undefined);
          setActivePanel(null);
          chatPanelKey.current += 1;

          // Parar transcrição se estiver ativa
          try {
            await stopSystemAudioRecordingAndTranscribe();
          } catch (error) {
            // Ignore errors if recording is not active
            console.log("No active recording to stop");
          }

          // Apenas ocultar a janela
          await appWindow.hide();
        });

        return unlisten;
      } catch (error) {
        console.error("Error setting up close handler:", error);
        return null;
      }
    };

    let unlistenFn: (() => void) | null = null;

    setupCloseHandler().then((unlisten) => {
      if (unlisten) {
        unlistenFn = unlisten;
      }
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  // Listen for open-chat event
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen<{ chat_id: string }>("open-chat", (event) => {
          const { chat_id: newChatId } = event.payload;
          setChatId(newChatId);
          // Force re-render of chat panel with new chatId
          chatPanelKey.current += 1;
          // Open chat panel if not already open
          setActivePanel((current) => {
            if (current !== "chat") {
              return "chat";
            }
            return current;
          });
        });
      } catch (error) {
        console.error("Failed to setup open-chat listener:", error);
      }
    };

    // Small delay to ensure component is mounted before setting up listener
    const timeoutId = setTimeout(() => {
      setupListener();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Listen for screen capture trigger (from shortcut)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen("trigger-screen-capture", () => {
          // Open chat if not already open
          if (activePanel !== "chat") {
            setActivePanel("chat");
          }
          // Start capture
          startCapture();
        });
      } catch (error) {
        console.error("Failed to setup screen capture listener:", error);
      }
    };

    const timeoutId = setTimeout(() => {
      setupListener();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (unlisten) {
        unlisten();
      }
    };
  }, [activePanel, startCapture]);

  // Handle captured image - open chat and pass image
  useEffect(() => {
    if (capturedImage) {
      // Open chat panel if not already open
      if (activePanel !== "chat") {
        setActivePanel("chat");
      }
      // The image will be passed to ChatPanel via props
    }
  }, [capturedImage, activePanel]);

  const togglePanel = async (panel: PanelType) => {
    const wasActive = activePanel === panel;
    if (activePanel === "chat" && panel !== "chat") {
      chatPanelKey.current += 1;
    }
    if (wasActive && panel === "chat") {
      setIsClosingChat(true);
      // Clear chatId when closing chat panel
      setChatId(undefined);
    }

    if (wasActive) {
      setActivePanel(null);
      setTimeout(() => {
        if (wasActive && panel === "chat") {
          setIsClosingChat(false);
        }
      }, 350);
    } else {
      if (panel === "chat") {
        // If opening chat panel, clear chatId if it exists to start fresh
        // This prevents reloading old conversations when just opening a new chat
        if (chatId) {
          setChatId(undefined);
          chatPanelKey.current += 1;
        }
      }
      setActivePanel(panel);
    }
  };

  const handleChatClosed = () => {
    // Clear chatId when chat is closed
    setChatId(undefined);
    // Force re-render to ensure fresh state
    chatPanelKey.current += 1;
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

  const buttons = [
    {
      id: "visibility" as const,
      icon: isContentProtected ? EyeOff : Eye,
      label: isContentProtected ? "Unprotect" : "Protect",
      onClick: toggleVisibilityAndProtection,
      tooltip: isContentProtected
        ? "Window is protected from screenshots"
        : "Window can be captured in screenshots",
    },
    {
      id: "voice" as const,
      label: "Start Listening",
      onClick: toggleRecording,
    },
    {
      id: "chat" as const,
      icon: MessageSquare,
      label: "Chat",
      panel: "chat" as PanelType,
      onClick: () => togglePanel("chat"),
    },
    {
      id: "capture" as const,
      icon: Camera,
      label: "Capture",
      onClick: () => {
        if (activePanel !== "chat") {
          setActivePanel("chat");
        }
        startCapture();
      },
    },
    {
      id: "grab" as const,
      icon: GripVertical,
      label: "Grab Button",
      onClick: () => togglePanel("chat"),
    },
  ];

  return (
    <>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 250, damping: 22 }}
        className="fixed  left-1/2 z-50 -translate-x-1/2 flex items-center gap-x-4"
      >
        <motion.div
          layout
          className="rounded-full border border-border bg-card/85 shadow-2xl backdrop-blur-xl py-1 relative"
        >
          <DashedBorder isVisible={!isVisible}>
            <div className="flex items-center gap-2">
              {buttons.map((button, index) => {
                const isActive = activePanel === button.panel;
                const isLast = index === buttons.length - 1;
                const isFirst = index === 0;
                const Icon = button.icon;

                if (
                  button.id === "voice" &&
                  (isRecording || isStartingRecording || isTranscribing)
                )
                  return (
                    <motion.div
                      key="recorder"
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <AudioRecorder
                        onStop={toggleRecording}
                        isStarting={isStartingRecording}
                        isTranscribing={isTranscribing}
                      />
                    </motion.div>
                  );

                if (button.id === "voice")
                  return (
                    <motion.div
                      key="voice"
                      layout
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                    >
                      <Button
                        onClick={button.onClick}
                        disabled={isStartingRecording}
                        variant="ghost"
                        className="text-xs px-3! py-0! rounded-full bg-linear-to-b from-[#0845a7] to-[#264070] text-white font-medium shadow-md hover:shadow-lg hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isStartingRecording ? "Starting..." : button.label}
                      </Button>
                    </motion.div>
                  );

                return (
                  <motion.div
                    key={button.id}
                    layout
                    className="flex items-center"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        size="icon"
                        className={cn(
                          "relative h-8 w-8 rounded-full transition-all duration-300",
                          isActive &&
                            "bg-primary text-primary-foreground shadow-lg scale-105",
                          !isActive && "hover:bg-accent",
                          isLast && "mr-2 cursor-grab",
                          isFirst && "ml-2",
                          // Destaque visual quando protegido
                          button.id === "visibility" &&
                            isContentProtected &&
                            "ring-2 ring-amber-500/50"
                        )}
                        {...(button.id === "grab"
                          ? { "data-tauri-drag-region": true }
                          : {})}
                        onClick={() =>
                          button.onClick
                            ? button.onClick()
                            : button.panel && togglePanel(button.panel)
                        }
                        aria-label={button.label}
                        title={button.tooltip}
                      >
                        {Icon && <Icon className="h-4 w-4" />}
                      </Button>
                    </motion.div>
                    {!isLast && <div className="mx-1 h-6 w-px bg-border/80" />}
                  </motion.div>
                );
              })}
            </div>
          </DashedBorder>
        </motion.div>

        <DashedBorder isVisible={!isVisible}>
          <Button
            variant="ghost"
            className="bg-card/85 text-card-foreground hover:bg-card/10! px-2! border rounded-full"
            onClick={async () => {
              const appWindow = getCurrentWindow();

              // Fechar chat se estiver aberto
              setChatId(undefined);
              setActivePanel(null);
              chatPanelKey.current += 1;

              // Parar transcrição se estiver ativa
              if (isRecording || isTranscribing || isStartingRecording) {
                setIsRecording(false);
                setIsTranscribing(false);
                setIsStartingRecording(false);
                try {
                  await stopSystemAudioRecordingAndTranscribe();
                } catch (error) {
                  console.error("Error stopping recording:", error);
                }
              }

              // Esconder a janela
              await appWindow.hide();
            }}
          >
            <X className="w-5 h-5" />
          </Button>
        </DashedBorder>
      </motion.div>

      {/* Animated Panel */}
      <AnimatePresence mode="popLayout">
        {activePanel && (
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.97 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed top-12 left-1/2 z-40 max-w-md w-full -translate-x-1/2 px-4"
          >
            <motion.div
              layout
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="rounded-2xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl overflow-hidden"
            >
              {activePanel === "chat" && (
                <ChatPanel
                  key={chatPanelKey.current}
                  chatId={chatId}
                  autoScreenshot={autoScreenshot}
                  setAutoScreenshot={setAutoScreenshot}
                  onChatClosed={handleChatClosed}
                  initialCapture={capturedImage || undefined}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
