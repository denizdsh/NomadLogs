/**
 * Comment router — create, delete, list threaded comments.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc/init.js";
import {
  protectedProcedure,
  editorProcedure,
  hasMinimumRole,
} from "../trpc/middleware.js";
import { notFoundError, badRequestError, forbiddenError } from "../utils/errors.js";
import { UserRole, CommentStatus, NotificationType } from "@nomadlogs/db";
import { updateContentCommentStats } from "../utils/comment.js";

/** Exactly one of blogId, journalId, or travelPlanId must be provided. */
const contentTargetSchema = z
  .object({
    blogId: z.uuid().optional(),
    journalId: z.uuid().optional(),
    travelPlanId: z.uuid().optional(),
  })
  .refine(
    (data) => {
      const set = [data.blogId, data.journalId, data.travelPlanId].filter(
        Boolean
      );
      return set.length === 1;
    },
    { message: "Exactly one of blogId, journalId, or travelPlanId is required." }
  );

export const commentRouter = router({
  /**
   * List comments for a piece of content.
   *
   * Returns top-level comments with nested replies up to 3 levels.
   * Cursor-based pagination on top-level comments.
   */
  list: publicProcedure
    .input(
      z
        .object({
          blogId: z.uuid().optional(),
          journalId: z.uuid().optional(),
          travelPlanId: z.uuid().optional(),
          cursor: z.uuid().optional(),
          limit: z.number().int().min(1).max(50).default(20),
        })
        .refine(
          (data) =>
            [data.blogId, data.journalId, data.travelPlanId].filter(Boolean)
              .length === 1,
          {
            message:
              "Exactly one of blogId, journalId, or travelPlanId is required.",
          }
        )
    )
    .query(async ({ ctx, input }) => {
      const isEditorOrAbove =
        ctx.user && hasMinimumRole(ctx.user.role, UserRole.EDITOR);

      // Determine which statuses the current user can see
      const visibleStatuses = isEditorOrAbove
        ? [CommentStatus.VERIFIED, CommentStatus.UNVERIFIED, CommentStatus.DELETED]
        : [CommentStatus.VERIFIED, CommentStatus.DELETED]; // DELETED shown as "[Deleted]"

      const contentWhere = input.blogId
        ? { blogId: input.blogId }
        : input.journalId
          ? { journalId: input.journalId }
          : { travelPlanId: input.travelPlanId };

      const comments = await ctx.prisma.comment.findMany({
        where: {
          ...contentWhere,
          parentId: null, // Top-level only
          status: { in: visibleStatuses as any },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          author: { select: { id: true, name: true, avatarUrl: true, role: true } },
          replies: {
            where: { status: { in: visibleStatuses as any } },
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { id: true, name: true, avatarUrl: true, role: true } },
              replies: {
                where: { status: { in: visibleStatuses as any } },
                orderBy: { createdAt: "asc" },
                include: {
                  author: { select: { id: true, name: true, avatarUrl: true, role: true } },
                  // Max 3 levels — no more nesting
                },
              },
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (comments.length > input.limit) {
        const next = comments.pop();
        nextCursor = next?.id;
      }

      return { comments, nextCursor };
    }),

  /** Create a new comment or reply. */
  create: protectedProcedure
    .input(
      z.object({
        blogId: z.uuid().optional(),
        journalId: z.uuid().optional(),
        travelPlanId: z.uuid().optional(),
        parentId: z.uuid().optional(),
        body: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isVerifiedAuthor = hasMinimumRole(ctx.user.role, UserRole.VERIFIED);
      const status = isVerifiedAuthor ? CommentStatus.VERIFIED : CommentStatus.UNVERIFIED;

      let depth = 0;

      // Validate parent comment exists and determine depth
      if (input.parentId) {
        const parent = await ctx.prisma.comment.findUnique({
          where: { id: input.parentId },
        });

        if (!parent) {
          throw notFoundError("Parent comment");
        }

        if (parent.depth >= 2) {
          throw badRequestError("Maximum nesting depth (3 levels) reached.");
        }

        depth = parent.depth + 1;
      }

      let contentAuthorId: string | null = null;
      let contentTitle = "";
      let linkUrl = "";

      if (input.blogId) {
        const blog = await ctx.prisma.blog.findUnique({
          where: { id: input.blogId },
          select: { authorId: true, title: true, slug: true },
        });
        if (blog) {
          contentAuthorId = blog.authorId;
          contentTitle = blog.title;
          linkUrl = `/blog/${blog.slug}`;
        }
      } else if (input.journalId) {
        const journal = await ctx.prisma.journal.findUnique({
          where: { id: input.journalId },
          select: { authorId: true, title: true, slug: true },
        });
        if (journal) {
          contentAuthorId = journal.authorId;
          contentTitle = journal.title;
          linkUrl = `/journal/${journal.slug}`;
        }
      } else if (input.travelPlanId) {
        const plan = await ctx.prisma.travelPlan.findUnique({
          where: { id: input.travelPlanId },
          select: { authorId: true, title: true, slug: true },
        });
        if (plan) {
          contentAuthorId = plan.authorId;
          contentTitle = plan.title;
          linkUrl = `/plan/${plan.slug}`;
        }
      }

      const contentData = input.blogId
        ? { blogId: input.blogId }
        : input.journalId
          ? { journalId: input.journalId }
          : { travelPlanId: input.travelPlanId };

      const comment = await ctx.prisma.$transaction(async (tx) => {
        const created = await tx.comment.create({
          data: {
            authorId: ctx.user.id,
            parentId: input.parentId,
            body: input.body,
            status,
            depth,
            ...contentData,
          },
        });

        // Update counter cache if comment is verified
        if (status === CommentStatus.VERIFIED) {
          await updateContentCommentStats(tx, input, "increment");
        }

        return created;
      });

      // Create notification for post owner (NEW_COMMENT)
      if (contentAuthorId && contentAuthorId !== ctx.user.id) {
        await ctx.prisma.notification.create({
          data: {
            recipientId: contentAuthorId,
            type: NotificationType.NEW_COMMENT,
            message: `${ctx.user.name} commented on your post "${contentTitle}".`,
            linkUrl,
            actorId: ctx.user.id,
          },
        });
      }

      // Create notification for parent comment author (COMMENT_REPLY)
      if (input.parentId) {
        const parent = await ctx.prisma.comment.findUnique({
          where: { id: input.parentId },
          select: { authorId: true },
        });
        if (parent && parent.authorId !== ctx.user.id && parent.authorId !== contentAuthorId) {
          await ctx.prisma.notification.create({
            data: {
              recipientId: parent.authorId,
              type: NotificationType.COMMENT_REPLY,
              message: `${ctx.user.name} replied to your comment.`,
              linkUrl,
              actorId: ctx.user.id,
            },
          });
        }
      }

      return comment;
    }),

  /**
   * Delete a comment.
   *
   * If the comment has replies, its body is replaced with "[Deleted]".
   * If it has no replies, it is removed entirely.
   */
  delete: protectedProcedure
    .input(z.object({ commentId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUnique({
        where: { id: input.commentId },
        include: { _count: { select: { replies: true } } },
      });

      if (!comment) {
        throw notFoundError("Comment");
      }

      const isAuthor = comment.authorId === ctx.user.id;
      const isEditorOrAbove = hasMinimumRole(ctx.user.role, UserRole.EDITOR);

      if (!isAuthor && !isEditorOrAbove) {
        throw forbiddenError("You can only delete your own comments.");
      }

      if (comment._count.replies > 0) {
        // Soft delete — keep replies
        await ctx.prisma.comment.update({
          where: { id: input.commentId },
          data: { body: "[Deleted]", status: CommentStatus.DELETED },
        });
      } else {
        // Hard delete
        await ctx.prisma.comment.delete({ where: { id: input.commentId } });
      }

      // Decrement counter cache if comment was verified
      if (comment.status === CommentStatus.VERIFIED) {
        await updateContentCommentStats(ctx.prisma, comment, "decrement");
      }

      return { success: true };
    }),
});
