import { createServerFn } from "@tanstack/react-start";
import { getClient } from "../../db/db";

export interface Session {
  id: string;
  user_id: string;
  expires_at: Date;
}

// Save or update user in database
export const saveUser = createServerFn({
  method: "POST",
})
  .inputValidator((d: any) => d)
  .handler(async ({ data: user }) => {
    const client = await getClient();
    if (!client) {
      console.warn("Database client not available, skipping user save");
      return null;
    }

    try {
      // Upsert user (insert or update if exists)
      await client.query(
        `INSERT INTO users (id, name, email, avatar, provider, access_token, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id)
         DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           avatar = EXCLUDED.avatar,
           provider = EXCLUDED.provider,
           access_token = EXCLUDED.access_token,
           updated_at = CURRENT_TIMESTAMP`,
        [
          user.id,
          user.name,
          user.email,
          user.avatar || null,
          user.provider,
          user.accessToken,
        ]
      );
      return user;
    } catch (error) {
      console.error("Failed to save user:", error);
      throw error;
    }
  });

// Create a new session for a user
export const createSession = createServerFn({
  method: "POST",
})
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data: { userId } }) => {
    const client = await getClient();
    if (!client) {
      console.warn("Database client not available, skipping session creation");
      return null;
    }

    try {
      // Generate session ID using UUID (Web Crypto API for browser compatibility)
      const sessionId = crypto.randomUUID();
      // Session expires in 30 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await client.query(
        `INSERT INTO sessions (id, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [sessionId, userId, expiresAt.toISOString()]
      );

      return { id: sessionId, userId, expiresAt };
    } catch (error) {
      console.error("Failed to create session:", error);
      throw error;
    }
  });

// Get user by session ID
export const getUserBySession = createServerFn({
  method: "GET",
})
  .inputValidator((d: { sessionId: string }) => d)
  .handler(async ({ data: { sessionId } }) => {
    const client = await getClient();
    if (!client) {
      return null;
    }

    try {
      const result = (await client.query(
        `SELECT u.id, u.name, u.email, u.avatar, u.provider, u.access_token as "accessToken"
         FROM users u
         INNER JOIN sessions s ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
        [sessionId]
      )) as Array<any>;

      if (result && result.length > 0) {
        return result[0];
      }
      return null;
    } catch (error) {
      console.error("Failed to get user by session:", error);
      return null;
    }
  });

// Get active session for a user
export const getActiveSession = createServerFn({
  method: "GET",
})
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data: { userId } }) => {
    const client = await getClient();
    if (!client) {
      return null;
    }

    try {
      const result = (await client.query(
        `SELECT id, user_id, expires_at
         FROM sessions
         WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      )) as Array<{ id: string; user_id: string; expires_at: string }>;

      if (result && result.length > 0) {
        const row = result[0];
        return {
          id: row.id,
          user_id: row.user_id,
          expires_at: new Date(row.expires_at),
        };
      }
      return null;
    } catch (error) {
      console.error("Failed to get active session:", error);
      return null;
    }
  });

// Delete session (logout)
export const deleteSession = createServerFn({
  method: "POST",
})
  .inputValidator((d: { sessionId: string }) => d)
  .handler(async ({ data: { sessionId } }) => {
    const client = await getClient();
    if (!client) {
      return;
    }

    try {
      await client.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  });

// Delete all sessions for a user
export const deleteUserSessions = createServerFn({
  method: "POST",
})
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data: { userId } }) => {
    const client = await getClient();
    if (!client) {
      return;
    }

    try {
      await client.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    } catch (error) {
      console.error("Failed to delete user sessions:", error);
    }
  });
