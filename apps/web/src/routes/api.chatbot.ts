import { createFileRoute } from "@tanstack/react-router";
import { streamText, tool, convertToModelMessages, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import FirecrawlApp from "@mendable/firecrawl-js";

const DEFAULT_SYSTEM_PROMPT = `
You are a helpful AI assistant with real-time web search.
When the webSearch tool is used, ALWAYS write a final answer based on the results.
Never stop after a tool call. Always produce a human-readable answer.
`;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY!,
});

// -------------------------------
// TOOL: FIRECRAWL SEARCH
// -------------------------------
const webSearchTool = tool({
  description: "Search the web using Firecrawl",
  inputSchema: z.object({ query: z.string().min(1) }),

  execute: async ({ query }) => {
    console.log("🔍 Firecrawl search:", query);

    try {
      const res = await firecrawl.search(query);
      const results = res?.data ?? [];

      return {
        query,
        results: results.slice(0, 5).map((r: any) => ({
          title: r.title || "",
          url: r.url || "",
          snippet: r.content?.slice(0, 200) || "",
        })),
      };
    } catch (err: any) {
      return {
        query,
        results: [
          {
            title: "Error",
            url: "",
            snippet: err.message ?? "Unknown error",
          },
        ],
      };
    }
  },
});

// -------------------------------
// API ROUTE
// -------------------------------
export const Route = createFileRoute("/api/chatbot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const messages = convertToModelMessages(body.messages);

          // 1️⃣ First run: allow tool calls
          const run1 = await generateText({
            model: google("gemini-2.0-flash"),
            system: DEFAULT_SYSTEM_PROMPT,
            messages,
            tools: { webSearch: webSearchTool },
          });

          // If no tool was used → stream normally
          if (!run1.toolCalls || run1.toolCalls.length === 0) {
            return new Response(run1.text, { status: 200 });
          }

          // 2️⃣ Tool was used → run search manually
          const toolCall = run1.toolCalls[0];
          const toolResult = await webSearchTool.execute(toolCall.args);

          // 3️⃣ Second model run → final answer using tool result
          const run2 = await streamText({
            model: google("gemini-2.0-flash"),
            system: DEFAULT_SYSTEM_PROMPT,
            messages: [
              ...messages,
              {
                role: "assistant",
                content: [
                  {
                    type: "tool-call",
                    toolName: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                    args: toolCall.args,
                  },
                ],
              },
              {
                role: "tool",
                toolCallId: toolCall.toolCallId,
                content: toolResult,
              },
            ],
          });

          return run2.toAIStreamResponse();
        } catch (err: any) {
          console.error("❌ Chatbot error:", err);

          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
          });
        }
      },
    },
  },
});
