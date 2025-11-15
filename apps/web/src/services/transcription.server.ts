import { createServerFn } from "@tanstack/react-start";
import { getClient } from "../../db/db";

export interface Transcription {
  id: string;
  userId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptionSegment {
  id: string;
  transcriptionId: string;
  text: string;
  startTime?: number;
  endTime?: number;
  createdAt: Date;
}

// Create a new transcription session
export const createTranscription = createServerFn({
  method: "POST",
})
  .inputValidator((d: { userId: string; title?: string }) => d)
  .handler(async ({ data: { userId, title } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      const { randomUUID } = await import("crypto");
      
      // First, create a conversation
      const conversationId = randomUUID();
      await client.query(
        `INSERT INTO conversations (id, user_id, title, type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [conversationId, userId, title || "New Transcription", "transcription"]
      );
      
      // Then, create the transcription linked to the conversation
      const transcriptionId = randomUUID();
      await client.query(
        `INSERT INTO transcriptions (id, conversation_id, user_id, title, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [transcriptionId, conversationId, userId, title || "New Transcription"]
      );

      return {
        id: transcriptionId,
        userId,
        title: title || "New Transcription",
        conversationId,
      };
    } catch (error) {
      console.error("Failed to create transcription:", error);
      throw error;
    }
  });

// Get all transcriptions for a user
export const getUserTranscriptions = createServerFn({
  method: "GET",
})
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data: { userId } }) => {
    const client = await getClient();
    if (!client) {
      return [];
    }

    try {
      const result = await client.query(
        `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
         FROM transcriptions
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [userId]
      );

      return result as Transcription[];
    } catch (error) {
      console.error("Failed to get user transcriptions:", error);
      return [];
    }
  });

// Get a single transcription by ID
export const getTranscription = createServerFn({
  method: "GET",
})
  .inputValidator((d: { transcriptionId: string }) => d)
  .handler(async ({ data: { transcriptionId } }) => {
    const client = await getClient();
    if (!client) {
      return null;
    }

    try {
      const result = (await client.query(
        `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
         FROM transcriptions
         WHERE id = $1`,
        [transcriptionId]
      )) as Transcription[];

      if (result && result.length > 0) {
        return result[0];
      }
      return null;
    } catch (error) {
      console.error("Failed to get transcription:", error);
      return null;
    }
  });

// Save a transcription segment to the database
export const saveTranscriptionSegment = createServerFn({
  method: "POST",
})
  .inputValidator(
    (d: {
      transcriptionId: string;
      text: string;
      startTime?: number;
      endTime?: number;
    }) => d
  )
  .handler(async ({ data: { transcriptionId, text, startTime, endTime } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      const { randomUUID } = await import("crypto");
      const segmentId = randomUUID();
      await client.query(
        `INSERT INTO transcription_segments (id, transcription_id, text, start_time, end_time, created_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [segmentId, transcriptionId, text, startTime || null, endTime || null]
      );

      // Update transcription's updated_at timestamp
      await client.query(
        `UPDATE transcriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transcriptionId]
      );

      return {
        id: segmentId,
        transcriptionId,
        text,
        startTime,
        endTime,
      };
    } catch (error) {
      console.error("Failed to save transcription segment:", error);
      throw error;
    }
  });

// Save multiple transcription segments at once
export const saveTranscriptionSegments = createServerFn({
  method: "POST",
})
  .inputValidator(
    (d: {
      transcriptionId: string;
      segments: Array<{
        text: string;
        startTime?: number;
        endTime?: number;
      }>;
    }) => d
  )
  .handler(async ({ data: { transcriptionId, segments } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      const { randomUUID } = await import("crypto");
      const savedSegments: TranscriptionSegment[] = [];

      for (const segment of segments) {
        const segmentId = randomUUID();
        await client.query(
          `INSERT INTO transcription_segments (id, transcription_id, text, start_time, end_time, created_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            segmentId,
            transcriptionId,
            segment.text,
            segment.startTime || null,
            segment.endTime || null,
          ]
        );

        savedSegments.push({
          id: segmentId,
          transcriptionId,
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          createdAt: new Date(),
        });
      }

      // Update transcription's updated_at timestamp
      await client.query(
        `UPDATE transcriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transcriptionId]
      );

      return savedSegments;
    } catch (error) {
      console.error("Failed to save transcription segments:", error);
      throw error;
    }
  });

// Get all segments for a transcription
export const getTranscriptionSegments = createServerFn({
  method: "GET",
})
  .inputValidator((d: { transcriptionId: string }) => d)
  .handler(async ({ data: { transcriptionId } }) => {
    const client = await getClient();
    if (!client) {
      return [];
    }

    try {
      const result = await client.query(
        `SELECT id, transcription_id as "transcriptionId", text, start_time as "startTime", end_time as "endTime", created_at as "createdAt"
         FROM transcription_segments
         WHERE transcription_id = $1
         ORDER BY created_at ASC`,
        [transcriptionId]
      );

      return result as TranscriptionSegment[];
    } catch (error) {
      console.error("Failed to get transcription segments:", error);
      return [];
    }
  });

// Get all segments for a conversation (via transcription)
export const getTranscriptionSegmentsByConversationId = createServerFn({
  method: "GET",
})
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data: { conversationId } }) => {
    const client = await getClient();
    if (!client) {
      return [];
    }

    try {
      const result = await client.query(
        `SELECT 
          ts.id, 
          ts.transcription_id as "transcriptionId", 
          ts.text, 
          ts.start_time as "startTime", 
          ts.end_time as "endTime", 
          ts.created_at as "createdAt"
         FROM transcription_segments ts
         INNER JOIN transcriptions t ON ts.transcription_id = t.id
         WHERE t.conversation_id = $1
         ORDER BY 
           COALESCE(ts.start_time, 0) ASC,
           ts.created_at ASC`,
        [conversationId]
      );

      return result as TranscriptionSegment[];
    } catch (error) {
      console.error("Failed to get transcription segments by conversation:", error);
      return [];
    }
  });

// Get full transcription text (all segments concatenated)
export const getTranscriptionText = createServerFn({
  method: "GET",
})
  .inputValidator((d: { transcriptionId: string }) => d)
  .handler(async ({ data: { transcriptionId } }) => {
    const client = await getClient();
    if (!client) {
      return "";
    }

    try {
      const result = (await client.query(
        `SELECT text
         FROM transcription_segments
         WHERE transcription_id = $1
         ORDER BY created_at ASC`,
        [transcriptionId]
      )) as Array<{ text: string }>;

      if (result && result.length > 0) {
        return result.map((segment) => segment.text).join(" ");
      }
      return "";
    } catch (error) {
      console.error("Failed to get transcription text:", error);
      return "";
    }
  });

// Update transcription title
export const updateTranscriptionTitle = createServerFn({
  method: "POST",
})
  .inputValidator((d: { transcriptionId: string; title: string }) => d)
  .handler(async ({ data: { transcriptionId, title } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      await client.query(
        `UPDATE transcriptions SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [title, transcriptionId]
      );
      return { success: true };
    } catch (error) {
      console.error("Failed to update transcription title:", error);
      throw error;
    }
  });

// Delete a transcription
export const deleteTranscription = createServerFn({
  method: "POST",
})
  .inputValidator((d: { transcriptionId: string }) => d)
  .handler(async ({ data: { transcriptionId } }) => {
    const client = await getClient();
    if (!client) {
      throw new Error("Database client not available");
    }

    try {
      // Segments will be deleted automatically due to CASCADE
      await client.query(`DELETE FROM transcriptions WHERE id = $1`, [
        transcriptionId,
      ]);
      return { success: true };
    } catch (error) {
      console.error("Failed to delete transcription:", error);
      throw error;
    }
  });
