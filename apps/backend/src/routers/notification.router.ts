/**
 * Notification router — listing, marking as read, unread count.
 */
import { z } from "zod";
import { router } from "../trpc/init.js";
import { protectedProcedure } from "../trpc/middleware.js";

export const notificationRouter = router({
  /** Get paginated notifications for the authenticated user. */
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.uuid().optional(),
        limit: z.number().int().min(1).max(50).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const notifications = await ctx.prisma.notification.findMany({
        where: { recipientId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          actor: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (notifications.length > input.limit) {
        nextCursor = notifications.pop()?.id;
      }

      return { notifications, nextCursor };
    }),

  /** Get unread notification count (for header badge). */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: { recipientId: ctx.user.id, isRead: false },
    });
    return { count };
  }),

  /**
   * Mark all notifications as read.
   *
   * Called when the notifications tab is opened (per spec:
   * "all notifications are read when the notifications tab is opened").
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: { recipientId: ctx.user.id, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }),
});
