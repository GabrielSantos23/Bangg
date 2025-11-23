import { useState, useRef, useEffect } from "react";
import { useGeminiSearch } from "@/hooks/useGeminiSearch";
import type { ChatMessage } from "@/hooks/useGeminiSearch";
import { v4 as uuid } from "uuid";

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { loading, error, data, search } = useGeminiSearch();

  useEffect(() => {
    if (data) {
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "assistant",
          content: data,
        },
      ]);
    }
  }, [data]);

  // auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: uuid(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    search(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen  p-4">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={
              msg.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={`max-w-[75%] p-3 rounded-xl whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-800 text-zinc-100"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 p-3 rounded-xl italic opacity-70">
              Thinking…
            </div>
          </div>
        )}

        {error && <div className="text-red-400 text-sm">{error}</div>}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="mt-4 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask anything…"
          className="flex-1 bg-zinc-800 p-3 rounded-xl text-zinc-100 outline-none"
        />

        <button
          onClick={sendMessage}
          className="px-4 py-3 bg-blue-600 rounded-xl hover:bg-blue-700 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
