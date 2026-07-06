/**
 * Chat router — Pending Content Chats (editor ↔ author messaging).
 *
 * Features:
 *  - List chats with full-text search (by chat ID, user name/email, content title)
 *  - View a chat with its message history
 *  - Create a chat (editor only)
 *  - Send messages with real-time SSE broadcast
 *  - Pending chat count for editor studio badge
 */
import { z } from "zod";
import { router } from "../trpc/init.js";
import {
  protectedProcedure,
  editorProcedure,
  hasMinimumRole,
} from "../trpc/middleware.js";
import { broadcastToChat } from "../sse/chatStream.js";
import { contentTypeSchema } from "../utils/enums.js";
import { notFoundError, forbiddenError, badRequestError } from "../utils/errors.js";
import { UserRole, ContentType, NotificationType } from "@nomadlogs/db";

export const chatRouter = router({
  /**
   * List pending content chats with optional search.
   *
   * Editors see all chats. Authors see only their own.
   *
   * **Search** filters by:
   *  - Chat ID (exact prefix match)
   *  - Author or editor name/email (case-insensitive contains)
   *  - Content title (case-insensitive contains)
   */
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        cursor: z.uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const isEditorOrAbove = hasMinimumRole(ctx.user.role, UserRole.EDITOR);

      const roleWhere = isEditorOrAbove
        ? {} // Editors see all
        : { authorId: ctx.user.id }; // Authors see only their own

      // Build search filter
      let searchWhere = {};
      if (input.search && input.search.trim().length > 0) {
        const term = input.search.trim();
        searchWhere = {
          OR: [
            // Match chat ID (starts with)
            { id: { startsWith: term } },
            // Match author name or email
            {
              author: {
                OR: [
                  { name: { contains: term, mode: "insensitive" as const } },
                  { email: { contains: term, mode: "insensitive" as const } },
                ],
              },
            },
            // Match editor name or email
            {
              editor: {
                OR: [
                  { name: { contains: term, mode: "insensitive" as const } },
                  { email: { contains: term, mode: "insensitive" as const } },
                ],
              },
            },
            // Match content title
            {
              blog: {
                title: { contains: term, mode: "insensitive" as const },
              },
            },
            {
              journal: {
                title: { contains: term, mode: "insensitive" as const },
              },
            },
            {
              travelPlan: {
                title: { contains: term, mode: "insensitive" as const },
              },
            },
          ],
        };
      }

      const chats = await ctx.prisma.pendingContentChat.findMany({
        where: { ...roleWhere, ...searchWhere },
        orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          author: { select: { id: true, name: true, email: true } },
          editor: { select: { id: true, name: true, email: true } },
          blog: { select: { id: true, title: true } },
          journal: { select: { id: true, title: true } },
          travelPlan: { select: { id: true, title: true } },
        },
      });

      let nextCursor: string | undefined;
      if (chats.length > input.limit) {
        nextCursor = chats.pop()?.id;
      }

      return { chats, nextCursor };
    }),

  /** Get a single chat with its messages. */
  getById: protectedProcedure
    .input(z.object({ chatId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const chat = await ctx.prisma.pendingContentChat.findUnique({
        where: { id: input.chatId },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          editor: { select: { id: true, name: true, email: true, avatarUrl: true } },
          blog: { select: { id: true, title: true, slug: true } },
          journal: { select: { id: true, title: true, slug: true } },
          travelPlan: { select: { id: true, title: true, slug: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              sender: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          },
        },
      });

      if (!chat) {
        throw notFoundError("Chat");
      }

      // Only author, editor, or higher-role users can access
      const isParticipant =
        chat.authorId === ctx.user.id || chat.editorId === ctx.user.id;
      const isEditorOrAbove = hasMinimumRole(ctx.user.role, UserRole.EDITOR);

      if (!isParticipant && !isEditorOrAbove) {
        throw forbiddenError();
      }

      return chat;
    }),

  /** Start a new pending content chat (editor only). */
  create: editorProcedure
    .input(
      z.object({
        contentType: contentTypeSchema,
        blogId: z.uuid().optional(),
        journalId: z.uuid().optional(),
        travelPlanId: z.uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Resolve the author from the content
      let authorId: string;

      if (input.contentType === ContentType.BLOG && input.blogId) {
        const blog = await ctx.prisma.blog.findUnique({
          where: { id: input.blogId },
          select: { authorId: true },
        });
        if (!blog) throw notFoundError("Blog");
        authorId = blog.authorId;
      } else if (input.contentType === ContentType.JOURNAL && input.journalId) {
        const journal = await ctx.prisma.journal.findUnique({
          where: { id: input.journalId },
          select: { authorId: true },
        });
        if (!journal) throw notFoundError("Journal");
        authorId = journal.authorId;
      } else if (input.contentType === ContentType.TRAVEL_PLAN && input.travelPlanId) {
        const plan = await ctx.prisma.travelPlan.findUnique({
          where: { id: input.travelPlanId },
          select: { authorId: true },
        });
        if (!plan) throw notFoundError("Travel plan");
        authorId = plan.authorId;
      } else {
        throw badRequestError("Content type and matching ID are required.");
      }

      const chat = await ctx.prisma.pendingContentChat.create({
        data: {
          contentType: input.contentType,
          blogId: input.blogId,
          journalId: input.journalId,
          travelPlanId: input.travelPlanId,
          authorId,
          editorId: ctx.user.id,
        },
      });

      await ctx.prisma.notification.create({
        data: {
          recipientId: authorId,
          type: NotificationType.CHAT_MESSAGE,
          message: "An editor started a conversation about your content.",
          linkUrl: `/chats?chatId=${chat.id}`,
          actorId: ctx.user.id,
        },
      });

      return chat;
    }),

  /**
   * Send a message in a chat.
   *
   * After persisting the message, broadcasts it to all connected
   * SSE clients on that chat for real-time delivery.
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        chatId: z.uuid(),
        body: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const chat = await ctx.prisma.pendingContentChat.findUnique({
        where: { id: input.chatId },
      });

      if (!chat) {
        throw notFoundError("Chat");
      }

      const isParticipant =
        chat.authorId === ctx.user.id || chat.editorId === ctx.user.id;

      if (!isParticipant) {
        throw forbiddenError();
      }

      const [message] = await ctx.prisma.$transaction([
        ctx.prisma.chatMessage.create({
          data: {
            chatId: input.chatId,
            senderId: ctx.user.id,
            body: input.body,
          },
        }),
        ctx.prisma.pendingContentChat.update({
          where: { id: input.chatId },
          data: { lastMessageAt: new Date() },
        }),
      ]);

      // Broadcast via SSE to all connected clients on this chat
      void broadcastToChat(input.chatId, {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        senderName: ctx.user.name,
        senderAvatarUrl: ctx.user.avatarUrl,
        body: message.body,
        createdAt: message.createdAt,
      });

      // Create notification for the other participant
      const recipientId =
        chat.authorId === ctx.user.id ? chat.editorId : chat.authorId;

      await ctx.prisma.notification.create({
        data: {
          recipientId,
          type: NotificationType.CHAT_MESSAGE,
          message: `New message from ${ctx.user.name}.`,
          linkUrl: `/chats?chatId=${input.chatId}`,
          actorId: ctx.user.id,
        },
      });

      return message;
    }),

  /** Get count of pending content chats (for editor studio badge). */
  pendingCount: editorProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.pendingContentChat.count();
    return { count };
  }),
});
