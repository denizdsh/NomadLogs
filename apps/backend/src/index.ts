/**
 * Express server entrypoint.
 *
 * Mounts:
 *  - tRPC middleware on `/trpc`
 *  - SSE endpoint on `/sse/chat/:chatId` for real-time chat delivery
 *  - Image upload on `/api/upload`
 *  - Health check on `/health`
 *  - Cron jobs for nightly cleanup
 */
import express from "express";
import cors from "cors";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./trpc/router.js";
import { createContext } from "./trpc/context.js";
import { getActiveConnectionCount } from "./sse/chatStream.js";
import { registerCronJobs } from "./cron/cleanup.js";
import { uploadRouter } from "./routers/upload.router.js";
import { sseRouter } from "./routers/sse.router.js";
import { oauthRouter } from "./routers/oauth.router.js";
import { PORT, FRONTEND_URL } from "./config/constants.js";

import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { prisma } from "./db.js";
import { redisPublish } from "./utils/redis.js";

const app = express();

// ---------------------------------------------------------------------------
// Security & Middleware
// ---------------------------------------------------------------------------
// Configure helmet with cross-origin policies allowed for static image serving
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Protect server from large payload exhaustion attacks
app.use(express.json({ limit: "15kb" }));

// Rate limiters for security
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each IP to 30 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads from this IP. Please try again later." },
});

// Apply limiters to specific endpoints
app.use("/trpc", generalLimiter);
app.use("/api/upload", uploadLimiter);

// Serve local uploads folder statically if R2 is not used
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", async (_req, res) => {
  let dbStatus = "unknown";
  let redisStatus = "unknown";

  try {
    // Ping database
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (err) {
    dbStatus = "disconnected";
  }

  try {
    // Ping Redis
    await redisPublish.ping();
    redisStatus = "connected";
  } catch (err) {
    redisStatus = "disconnected";
  }

  const isHealthy = dbStatus === "connected" && redisStatus === "connected";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    redis: redisStatus,
    sseConnections: getActiveConnectionCount(),
  });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(uploadRouter);
app.use(sseRouter);
app.use(oauthRouter);

// ---------------------------------------------------------------------------
// tRPC
// ---------------------------------------------------------------------------
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// ---------------------------------------------------------------------------
// Cron jobs
// ---------------------------------------------------------------------------
registerCronJobs();

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🌍 NomadLogs API running on http://localhost:${PORT}`);
  console.log(`   tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`   SSE endpoint:  http://localhost:${PORT}/sse/chat/:chatId`);
});
