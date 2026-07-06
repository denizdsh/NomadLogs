import { Redis } from "ioredis";
import { REDIS_URL, NODE_ENV } from "../config/constants.js";

const isProduction = NODE_ENV === "production";

// In development, stop retrying after 3 failed attempts to avoid log spamming
const maxRetries = isProduction ? undefined : 3;

/**
 * Redis client for general caching, state storage, and Pub/Sub publishing.
 */
export const redisPublish = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (maxRetries !== undefined && times > maxRetries) {
      console.warn("⚠️ Redis offline: local real-time chat SSE features will run in single-instance fallback mode.");
      return null; // Stop retrying to prevent log spamming
    }
    return Math.min(times * 150, 2000);
  },
});

/**
 * Dedicated Redis client for Pub/Sub subscriptions.
 */
export const redisSubscribe = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (maxRetries !== undefined && times > maxRetries) {
      return null; // Stop retrying
    }
    return Math.min(times * 150, 2000);
  },
});

redisPublish.on("error", (err) => {
  // Only log if connection is still attempting
  if (redisPublish.status !== "end") {
    console.error("Redis Publish Client Error:", err.message);
  }
});

redisSubscribe.on("error", (err) => {
  if (redisSubscribe.status !== "end") {
    console.error("Redis Subscribe Client Error:", err.message);
  }
});
