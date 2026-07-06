/**
 * SSE (Server-Sent Events) connection manager scaled with Redis Pub/Sub.
 *
 * Manages per-chat SSE connections for real-time message delivery
 * in Pending Content Chats. Coordinates broadcasts across multiple server
 * instances using Redis Pub/Sub.
 */
import type { Response } from "express";
import { redisPublish, redisSubscribe } from "../utils/redis.js";

/** Map of chatId → Set of connected SSE Response objects. */
const chatConnections = new Map<string, Set<Response>>();

// Listen for incoming Redis pub/sub messages globally on this instance
redisSubscribe.on("message", (channel, message) => {
  if (channel.startsWith("chat:")) {
    const chatId = channel.substring(5);
    const connections = chatConnections.get(chatId);
    if (connections && connections.size > 0) {
      const payload = `event: message\ndata: ${message}\n\n`;
      for (const res of connections) {
        res.write(payload);
      }
    }
  }
});

/**
 * Register an SSE connection for a specific chat.
 *
 * Sets the required SSE headers, adds the response to the connection pool,
 * and handles subscription to the matching Redis channel.
 */
export async function addChatConnection(chatId: string, res: Response): Promise<void> {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable Nginx buffering if proxied
  });

  // Send an initial heartbeat so the client knows the connection is alive
  res.write(":heartbeat\n\n");

  let isFirst = false;
  if (!chatConnections.has(chatId)) {
    chatConnections.set(chatId, new Set());
    isFirst = true;
  }
  chatConnections.get(chatId)!.add(res);

  // Subscribe to Redis channel if this is the first client on this instance and Redis is ready
  if (isFirst && redisSubscribe.status === "ready") {
    try {
      await redisSubscribe.subscribe(`chat:${chatId}`);
    } catch (err) {
      console.error(`[sse] Failed to subscribe to Redis channel chat:${chatId}:`, err);
    }
  }

  // Cleanup on disconnect
  res.on("close", async () => {
    const connections = chatConnections.get(chatId);
    if (connections) {
      connections.delete(res);
      if (connections.size === 0) {
        chatConnections.delete(chatId);
        if (redisSubscribe.status === "ready") {
          try {
            await redisSubscribe.unsubscribe(`chat:${chatId}`);
          } catch (err) {
            console.error(`[sse] Failed to unsubscribe from Redis channel chat:${chatId}:`, err);
          }
        }
      }
    }
  });
}

/**
 * Broadcast a new message event to all clients connected to a chat (across all instances).
 *
 * Publishes the payload to Redis Pub/Sub, falling back to local memory delivery if Redis is offline.
 */
export async function broadcastToChat(
  chatId: string,
  message: {
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    senderAvatarUrl: string | null;
    body: string;
    createdAt: Date;
  }
): Promise<void> {
  let published = false;

  // Attempt to broadcast via Redis if online
  if (redisPublish.status === "ready") {
    try {
      await redisPublish.publish(`chat:${chatId}`, JSON.stringify(message));
      published = true;
    } catch (err) {
      console.warn(`[sse] Redis broadcast failed, falling back to local memory.`, err);
    }
  }

  // Fallback to local memory broadcast if Redis is offline
  if (!published) {
    const connections = chatConnections.get(chatId);
    if (connections && connections.size > 0) {
      const payload = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
      for (const res of connections) {
        res.write(payload);
      }
    }
  }
}

/**
 * Get the number of active SSE connections (for diagnostics).
 */
export function getActiveConnectionCount(): number {
  let total = 0;
  for (const connections of chatConnections.values()) {
    total += connections.size;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Heartbeat — keep connections alive (every 30 seconds)
// ---------------------------------------------------------------------------
setInterval(() => {
  for (const connections of chatConnections.values()) {
    for (const res of connections) {
      res.write(":heartbeat\n\n");
    }
  }
}, 30_000);
