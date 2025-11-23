import { createFileRoute } from "@tanstack/react-router";
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  type ModelMessage,
} from "ai";
import { google } from "@ai-sdk/google";

import { getClient } from "../../db/db";
import { getCurrentUser } from "@/services/auth";

// --- CORS Configuration (Crucial for Tauri) ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Allows Tauri (custom protocol) to access
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Chat-Id, X-User-Id, Authorization",
  "Access-Control-Max-Age": "86400",
};
// ------------------------------------------------

// Get API key at module level (same pattern as api.chatbot.ts)
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant that chats with the user about productivity and creative workflows. Keep replies concise and actionable.";

function extractTextFromMessage(message: UIMessage | undefined) {
  if (!message || !message.parts) {
    return "";
  }

  return (
    message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("") || ""
  );
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      // Handle CORS preflight requests
      OPTIONS: () => {
        return new Response(null, { status: 204, headers: corsHeaders });
      },
      POST: async ({ request }) => {
        const client = await getClient();
        if (!client) {
          return new Response(
            JSON.stringify({ error: "Database client not available" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        try {
          const body = await request.json();
          const messages = body?.messages as UIMessage[] | undefined;
          const incomingChatId =
            typeof body?.chatId === "string" ? body.chatId : undefined;
          const incomingUserId =
            typeof body?.userId === "string" ? body.userId : undefined;
          const systemPrompt =
            typeof body?.systemPrompt === "string"
              ? body.systemPrompt
              : DEFAULT_SYSTEM_PROMPT;

          // getCurrentUser() returns null on server-side (SSR)
          // Use incomingUserId from request body instead
          let user = null;
          try {
            user = await getCurrentUser();
          } catch (error) {
            // Expected on server-side - getCurrentUser uses Tauri APIs
            console.warn(
              "Failed to get current user (expected on server-side):",
              error
            );
          }
          const userId = user?.id ?? incomingUserId;

          if (!userId) {
            return new Response(
              JSON.stringify({ error: "Unauthorized - userId required" }),
              {
                status: 401,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(
              JSON.stringify({ error: "messages array is required" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          // Import crypto dynamically (only runs on server)
          const { randomUUID } = await import("crypto");

          let chatId = incomingChatId?.trim();

          const lastUserMessage = [...messages]
            .reverse()
            .find((message) => message.role === "user");
          const userMessageContent = extractTextFromMessage(lastUserMessage);
          const derivedTitle = userMessageContent
            ? userMessageContent.substring(0, 60)
            : "Untitled Chat";

          if (chatId) {
            const existingChat = (await client.query(
              `SELECT id, user_id, title
                FROM chats
                WHERE id = $1 AND user_id = $2`,
              [chatId, userId]
            )) as Array<{ id: string; user_id: string; title: string | null }>;

            if (!existingChat.length) {
              return new Response(
                JSON.stringify({ error: "Chat not found for this user" }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json", ...corsHeaders },
                }
              );
            }

            // If chat has no title yet, update it optimistically
            if (!existingChat[0].title && userMessageContent) {
              await client.query(`UPDATE chats SET title = $2 WHERE id = $1`, [
                chatId,
                derivedTitle,
              ]);
            }
          } else {
            // First, create a conversation
            const conversationId = randomUUID();
            await client.query(
              `INSERT INTO conversations (id, user_id, title, type, created_at, updated_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [conversationId, userId, derivedTitle || "Untitled Chat", "chat"]
            );

            // Then, create the chat linked to the conversation
            chatId = randomUUID();
            await client.query(
              `INSERT INTO chats (id, conversation_id, user_id, title, created_at, updated_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [chatId, conversationId, userId, derivedTitle || "Untitled Chat"]
            );
          }

          // Save user message and attachments
          if (lastUserMessage) {
            const messageId = randomUUID();

            // Extract text content
            const textContent = extractTextFromMessage(lastUserMessage);

            // Check if message has image parts (they come as 'image' in the parts but aren't typed that way)
            const hasImages = lastUserMessage.parts?.some((p: any) => {
              return p.type === "image" || p.image || p.data;
            });

            // Save the message
            if (textContent || hasImages) {
              await client.query(
                `INSERT INTO messages (id, chat_id, role, content, created_at)
                  VALUES ($1, $2, 'user', $3, CURRENT_TIMESTAMP)`,
                [messageId, chatId, textContent || "[Image message]"]
              );

              // Save image attachments (if table exists)
              const imageParts =
                lastUserMessage.parts?.filter(
                  (p: any) => p.type === "image" || p.image || p.data
                ) || [];

              for (const imagePart of imageParts) {
                try {
                  const attachmentId = randomUUID();
                  const imageData =
                    (imagePart as any).image || (imagePart as any).data || "";
                  // Extract base64 data from data URL if present
                  const base64Data = imageData.includes(",")
                    ? imageData.split(",")[1]
                    : imageData.replace(/^data:image\/[^;]+;base64,/, "");

                  await client.query(
                    `INSERT INTO message_attachments (id, message_id, attachment_type, attachment_data, mime_type, created_at)
                      VALUES ($1, $2, 'image', $3, 'image/png', CURRENT_TIMESTAMP)`,
                    [attachmentId, messageId, base64Data]
                  );
                } catch (attachmentError: any) {
                  // If table doesn't exist, log warning but continue
                  if (
                    attachmentError?.code === "42P01" ||
                    attachmentError?.message?.includes("does not exist")
                  ) {
                    console.warn(
                      "message_attachments table does not exist. Run migration: create_message_attachments_table.sql"
                    );
                  } else {
                    console.error(
                      "Failed to save image attachment:",
                      attachmentError
                    );
                  }
                  // Continue processing even if attachment save fails
                }
              }
            }
          }

          // Convert UIMessages to ModelMessages and process images correctly
          const modelMessages = messages.map((msg) => {
            // Check if this message has image parts (type assertion needed for runtime check)
            const hasImageParts = msg.parts?.some(
              (p: any) => p.type === "image" || p.image || p.data
            );

            if (hasImageParts && msg.role === "user") {
              // Build content array with text and image parts
              const content: Array<{
                type: "text" | "image";
                text?: string;
                image?: string;
              }> = [];

              for (const part of msg.parts || []) {
                if (part.type === "text") {
                  content.push({
                    type: "text",
                    text: part.text,
                  });
                } else if (
                  (part as any).type === "image" ||
                  (part as any).image ||
                  (part as any).data
                ) {
                  // Handle image part
                  let imageData =
                    (part as any).image || (part as any).data || "";

                  // Remove data URL prefix if present
                  if (typeof imageData === "string") {
                    if (imageData.startsWith("data:")) {
                      imageData =
                        imageData.split(",")[1] ||
                        imageData.replace(/^data:image\/[^;]+;base64,/, "");
                    }

                    // Validate image size (max ~4MB base64 = ~3MB actual)
                    const base64Size = imageData.length;
                    const maxSize = 4 * 1024 * 1024; // 4MB in bytes
                    if (base64Size > maxSize) {
                      console.warn(
                        `Image too large: ${base64Size} bytes, skipping`
                      );
                      continue; // Skip this image
                    }
                  }

                  content.push({
                    type: "image",
                    image: imageData,
                  });
                }
              }

              // Ensure we have at least text content
              if (content.length === 0) {
                content.push({
                  type: "text",
                  text: "[Image message]",
                });
              }

              return {
                role: msg.role,
                content,
              };
            }

            // For non-image messages, use convertToModelMessages
            return convertToModelMessages([msg])[0];
          });

          // Validate modelMessages before sending
          if (!modelMessages || modelMessages.length === 0) {
            return new Response(
              JSON.stringify({ error: "No valid messages to process" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          // Check if Google API key is configured
          if (!GOOGLE_API_KEY) {
            console.error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
            return new Response(
              JSON.stringify({
                error: "AI service not configured",
                details:
                  "Please set GOOGLE_GENERATIVE_AI_API_KEY in your .env file",
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          // Try gemini-2.0-flash first, fallback to gemini-1.5-flash if not available
          const modelName = "gemini-2.0-flash"; // Use stable model

          console.log("Calling Google Gemini API with", {
            model: modelName,
            messageCount: modelMessages.length,
            hasImages: modelMessages.some((msg: any) =>
              msg.content?.some((c: any) => c.type === "image")
            ),
          });

          let result;
          try {
            result = streamText({
              model: google(modelName),
              system: systemPrompt,
              messages: modelMessages as ModelMessage[],
            });
          } catch (streamError: any) {
            console.error("Failed to create streamText:", streamError);
            const streamErrorMessage =
              streamError?.message || String(streamError);
            const streamErrorStatus =
              streamError?.statusCode || streamError?.response?.status;

            // If it's an HTTP error, return it with proper status
            if (streamErrorStatus) {
              return new Response(
                JSON.stringify({
                  error: `AI service error: ${streamErrorMessage}`,
                  details:
                    process.env.NODE_ENV === "development"
                      ? streamErrorMessage
                      : undefined,
                }),
                {
                  status: streamErrorStatus,
                  headers: { "Content-Type": "application/json", ...corsHeaders },
                }
              );
            }

            throw new Error(
              `Failed to initialize AI stream: ${streamErrorMessage}`
            );
          }

          // Return the streaming response directly
          // Errors during streaming will be caught by the outer catch block
          return result.toUIMessageStreamResponse({
            headers: {
              "X-Chat-Id": chatId,
              "Access-Control-Expose-Headers": "X-Chat-Id",
              ...corsHeaders, // Apply CORS headers here
            },
            onFinish: async ({ responseMessage }) => {
              try {
                const assistantContent =
                  extractTextFromMessage(responseMessage);

                if (assistantContent) {
                  await client.query(
                    `INSERT INTO messages (id, chat_id, role, content, created_at)
                      VALUES ($1, $2, 'assistant', $3, CURRENT_TIMESTAMP)`,
                    [randomUUID(), chatId, assistantContent]
                  );
                }

                await client.query(
                  `UPDATE chats
                    SET updated_at = CURRENT_TIMESTAMP,
                        title = CASE
                          WHEN (title IS NULL OR title = '') AND $2 <> '' THEN $2
                          ELSE title
                        END
                    WHERE id = $1`,
                  [chatId, derivedTitle]
                );
              } catch (dbError) {
                // Log but don't fail the response
                console.error(
                  "Error saving assistant message to database:",
                  dbError
                );
              }
            },
          });
        } catch (error: any) {
          console.error("AI chat streaming error:", error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;

          // Check for specific HTTPError from AI SDK
          const isHTTPError =
            error?.name === "HTTPError" || error?.statusCode || error?.response;
          const statusCode =
            error?.statusCode || error?.response?.status || 500;

          console.error("Error details:", {
            errorMessage,
            errorStack,
            isHTTPError,
            statusCode,
            errorName: error?.name,
            errorCause: error?.cause,
          });

          // Return more specific error based on type
          let errorResponse = "Failed to process chat request";
          if (isHTTPError) {
            if (statusCode === 401 || statusCode === 403) {
              errorResponse =
                "AI service authentication failed. Please check API key configuration.";
            } else if (statusCode === 429) {
              errorResponse =
                "AI service rate limit exceeded. Please try again later.";
            } else if (statusCode === 400) {
              errorResponse =
                "Invalid request to AI service. Please check your message format.";
            } else {
              errorResponse = `AI service error (${statusCode}). Please try again.`;
            }
          }

          return new Response(
            JSON.stringify({
              error: errorResponse,
              details:
                process.env.NODE_ENV === "development"
                  ? errorMessage
                  : undefined,
            }),
            {
              status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
              headers: { "Content-Type": "application/json", ...corsHeaders }, // Apply CORS headers here
            }
          );
        }
      },
    },
  },
});
