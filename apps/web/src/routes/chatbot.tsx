import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@/components/ai-elements/sources";

export const Route = createFileRoute("/chatbot")({
  component: ChatbotComponent,
});

// --- Interfaces ---

interface WebSource {
  uri: string;
  title: string;
}

interface GroundingChunk {
  web?: WebSource;
}

interface SearchEntryPoint {
  renderedContent?: string;
}

interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  grounding_chunks?: GroundingChunk[]; // Fallback for snake_case
  searchEntryPoint?: SearchEntryPoint;
  search_entry_point?: SearchEntryPoint; // Fallback for snake_case
}

// The payload structure sent from Rust
interface StreamPayload {
  text?: string;
  is_done: boolean;
  metadata?: GroundingMetadata;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: WebSource[];
  searchHtml?: string;
  isStreaming?: boolean;
}

// Import the environment variable
const API_KEY =
  import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY ||
  import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY;

function ChatbotComponent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // True while waiting for stream start or during stream
  const [error, setError] = useState("");
  const [enableSearch, setEnableSearch] = useState(false); // Controla se a pesquisa está habilitada

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!API_KEY || !input.trim()) {
      setError("API Key missing or no message provided.");
      return;
    }

    const currentInput = input.trim();
    const chatId = Date.now().toString(); // Simple ID for this request session
    const userMsgId = chatId;
    const assistantMsgId = (Date.now() + 1).toString();

    // 1. Add User Message
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: currentInput,
    };

    // 2. Add Placeholder Assistant Message (Empty initially)
    const initialAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setInput("");
    setLoading(true);
    setError("");

    // Prepare history (excluding the current new messages)
    const history = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    let unlisten: (() => void) | undefined;

    try {
      // 3. Set up the Event Listener
      unlisten = await listen<StreamPayload>(
        `gemini-event-${chatId}`,
        (event) => {
          const payload = event.payload;

          // Debug: log metadata when it arrives
          if (payload.metadata) {
            console.log("Received metadata:", payload.metadata);
            console.log("Grounding chunks:", payload.metadata.groundingChunks);
          }

          setMessages((prevMessages) => {
            return prevMessages.map((msg) => {
              if (msg.id !== assistantMsgId) return msg;

              // Create a copy to modify
              const updatedMsg = { ...msg };

              // Append Text
              if (payload.text) {
                updatedMsg.content += payload.text;
              }

              // Handle Metadata (Sources) - accumulate sources from all chunks
              if (payload.metadata) {
                // Extract Web Sources - handle both camelCase and snake_case
                const groundingChunks =
                  payload.metadata.groundingChunks ||
                  payload.metadata.grounding_chunks;

                if (groundingChunks && Array.isArray(groundingChunks)) {
                  const newSources = groundingChunks
                    .filter((c) => c.web)
                    .map((c) => c.web as WebSource);

                  // Accumulate sources, avoiding duplicates
                  const existingSources = updatedMsg.sources || [];
                  const sourceMap = new Map<string, WebSource>();

                  // Add existing sources
                  existingSources.forEach((s) => {
                    sourceMap.set(s.uri, s);
                  });

                  // Add new sources
                  newSources.forEach((s) => {
                    sourceMap.set(s.uri, s);
                  });

                  updatedMsg.sources = Array.from(sourceMap.values());

                  // Debug log
                  if (newSources.length > 0) {
                    console.log("Found sources:", newSources);
                    console.log(
                      "Total sources after merge:",
                      updatedMsg.sources.length
                    );
                  }
                }

                // Extract Search HTML - handle both camelCase and snake_case
                const searchEntryPoint =
                  payload.metadata.searchEntryPoint ||
                  payload.metadata.search_entry_point;

                if (searchEntryPoint) {
                  const renderedContent =
                    searchEntryPoint.renderedContent ||
                    (searchEntryPoint as any).rendered_content;

                  if (renderedContent) {
                    updatedMsg.searchHtml = renderedContent;
                  }
                }
              }

              // Handle Stream Completion
              if (payload.is_done) {
                updatedMsg.isStreaming = false;
                // Debug: log final message state
                if (updatedMsg.sources && updatedMsg.sources.length > 0) {
                  console.log(
                    "Final message has sources:",
                    updatedMsg.sources.length,
                    updatedMsg.sources
                  );
                } else {
                  console.log("Final message has NO sources");
                }
              }

              return updatedMsg;
            });
          });

          if (payload.is_done) {
            setLoading(false);
          }
        }
      );

      // 4. Start the Stream (Invoke Rust Command)
      // Note: This promise resolves when the Rust function returns (after stream ends)
      await invoke("stream_gemini_request", {
        apiKey: API_KEY,
        prompt: currentInput,
        history: history,
        chatId: chatId,
        enableSearch: enableSearch,
      });
    } catch (err: any) {
      console.error("Stream error:", err);
      setError(typeof err === "string" ? err : JSON.stringify(err));

      // Remove the empty assistant message if we failed completely
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMsgId));
    } finally {
      setLoading(false);
      // 5. Cleanup Listener
      if (unlisten) {
        unlisten();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-transparent text-gray-100 font-sans">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Gemini Chat with Search
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              AI-powered chat with Google Search integration
            </p>
          </div>
          {/* Search Toggle Button */}
          <button
            onClick={() => setEnableSearch(!enableSearch)}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              enableSearch
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/50"
                : "bg-gray-700 hover:bg-gray-600 text-gray-300"
            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            title={
              enableSearch
                ? "Pesquisa na internet ativada - Clique para desativar"
                : "Pesquisa na internet desativada - Clique para ativar"
            }
          >
            <span className="text-lg">{enableSearch ? "🔍" : "🔎"}</span>
            <span className="text-sm font-semibold">
              {enableSearch ? "Pesquisa Ativa" : "Pesquisa Inativa"}
            </span>
            {enableSearch && (
              <span className="ml-1 w-2 h-2 bg-white rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">Start a conversation</p>
              <p className="text-sm">
                Ask me anything and I'll search the web to help you!
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-100 border border-gray-700"
                }`}
              >
                {/* Content */}
                <div className="whitespace-pre-wrap leading-relaxed min-h-[20px]">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 ml-1 align-middle bg-emerald-400 animate-pulse" />
                  )}
                </div>

                {/* Sources for assistant messages */}
                {message.role === "assistant" &&
                  message.sources &&
                  message.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <Sources className="text-gray-300">
                        <SourcesTrigger count={message.sources.length} />
                        <SourcesContent>
                          {message.sources.map((source, idx) => (
                            <Source
                              key={idx}
                              href={source.uri}
                              title={source.title}
                              onClick={(e) => {
                                e.preventDefault();
                                // Tauri specific opener or standard window.open
                                window.open(source.uri, "_blank");
                              }}
                            />
                          ))}
                        </SourcesContent>
                      </Sources>
                    </div>
                  )}

                {/* Search Entry Point HTML */}
                {message.role === "assistant" && message.searchHtml && (
                  <div
                    className="mt-4 pt-4 border-t border-gray-700"
                    dangerouslySetInnerHTML={{ __html: message.searchHtml }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Initial Loading State (before first chunk arrives) */}
          {loading &&
            messages.length > 0 &&
            messages[messages.length - 1].content === "" && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="flex gap-1">
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></div>
                    </div>
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

          {error && (
            <div className="p-4 bg-red-900/30 border border-red-800 text-red-300 rounded-lg">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 bg-gray-800/50 backdrop-blur-sm px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Press Enter to send)"
              disabled={loading}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition resize-none min-h-[60px] max-h-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                loading || !input.trim()
                  ? "bg-gray-600 cursor-not-allowed opacity-50"
                  : "bg-blue-600 hover:bg-blue-500 active:scale-95"
              }`}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
