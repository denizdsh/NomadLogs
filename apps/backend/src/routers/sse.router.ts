import { Router } from "express";
import { prisma } from "../db.js";
import { addChatConnection } from "../sse/chatStream.js";
import { authenticate, requireAuth, type AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { UserRole } from "@nomadlogs/db";

const sseRouter = Router();

/**
 * GET /sse/chat/:chatId
 *
 * Establishes a Server-Sent Events connection for a specific chat.
 * Clients receive `event: message` events when new messages are sent.
 */
sseRouter.get(
  "/sse/chat/:chatId",
  authenticate,
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const { chatId } = req.params;

    if (!chatId || typeof chatId !== "string") {
      res.status(400).json({ error: "Chat ID is required." });
      return;
    }

    // Since requireAuth passed, req.user is guaranteed to be populated
    const user = req.user!;

    try {
      // Verify access to the chat
      const chat = await prisma.pendingContentChat.findUnique({
        where: { id: chatId },
        select: { authorId: true, editorId: true },
      });

      if (!chat) {
        res.status(404).json({ error: "Chat not found." });
        return;
      }

      const isParticipant = chat.authorId === user.id || chat.editorId === user.id;
      const isEditor = user.role === UserRole.EDITOR || user.role === UserRole.ADMIN;

      if (!isParticipant && !isEditor) {
        res.status(403).json({ error: "Access denied." });
        return;
      }

      // Register the SSE connection
      addChatConnection(chatId, res);
    } catch (error) {
      console.error("SSE connection setup error:", error);
      res.status(500).json({ error: "Failed to establish real-time connection." });
    }
  }
);

export { sseRouter };
