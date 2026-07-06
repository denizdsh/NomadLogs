/**
 * User router — profile management, follow/unfollow, analytics.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc/init.js";
import { protectedProcedure, editorProcedure } from "../trpc/middleware.js";
import { userRoleSchema } from "../utils/enums.js";
import { notFoundError, badRequestError, forbiddenError } from "../utils/errors.js";
import { UserRole, ContentType } from "@nomadlogs/db";

export const userRouter = router({
  // -----------------------------------------------------------------------
  // Public queries
  // -----------------------------------------------------------------------

  /** Get a user's public profile by ID or unique name. */
  getProfile: publicProcedure
    .input(z.object({ userId: z.uuid().optional(), name: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where = input.userId
        ? { id: input.userId }
        : input.name
          ? { name: input.name }
          : null;

      if (!where) {
        throw badRequestError("Provide userId or name.");
      }

      const user = await ctx.prisma.user.findUnique({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          donationLinks: true,
          createdAt: true,
          _count: {
            select: {
              followers: true,
              following: true,
              blogs: true,
              journals: true,
              travelPlans: true,
            },
          },
        },
      });

      if (!user) {
        throw notFoundError("User");
      }

      return user;
    }),

  /** Check if the authenticated user follows a target user. */
  isFollowing: protectedProcedure
    .input(z.object({ targetUserId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const follow = await ctx.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: ctx.user.id,
            followingId: input.targetUserId,
          },
        },
      });
      return { isFollowing: !!follow };
    }),

  /** Search/autocomplete user profiles by name or email (authenticated users only). */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const term = input.query.trim();
      return ctx.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
        take: input.limit,
      });
    }),

  // -----------------------------------------------------------------------
  // Protected mutations
  // -----------------------------------------------------------------------

  /** Update the authenticated user's profile. */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50).optional(),
        avatarUrl: z.url().optional(),
        donationLinks: z
          .array(z.object({ provider: z.string(), url: z.url() }))
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: input,
      });
    }),

  /** Follow a user. */
  follow: protectedProcedure
    .input(z.object({ targetUserId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.targetUserId) {
        throw badRequestError("Cannot follow yourself.");
      }

      await ctx.prisma.follow.create({
        data: {
          followerId: ctx.user.id,
          followingId: input.targetUserId,
        },
      });

      return { success: true };
    }),

  /** Unfollow a user. */
  unfollow: protectedProcedure
    .input(z.object({ targetUserId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId: ctx.user.id,
            followingId: input.targetUserId,
          },
        },
      });

      return { success: true };
    }),

  /** Delete the authenticated user's account and all their content. */
  deleteAccount: protectedProcedure
    .input(z.object({ confirmationText: z.literal("DELETE") }))
    .mutation(async ({ ctx }) => {
      await ctx.prisma.user.delete({ where: { id: ctx.user.id } });
      return { success: true };
    }),

  // -----------------------------------------------------------------------
  // Editor mutations
  // -----------------------------------------------------------------------

  /** Change a user's role (editor/admin only). */
  changeRole: editorProcedure
    .input(
      z.object({
        targetUserId: z.uuid(),
        newRole: userRoleSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only admins can promote to EDITOR or ADMIN
      if (
        (input.newRole === UserRole.EDITOR || input.newRole === UserRole.ADMIN) &&
        ctx.user.role !== UserRole.ADMIN
      ) {
        throw forbiddenError("Only admins can assign EDITOR or ADMIN roles.");
      }

      return ctx.prisma.user.update({
        where: { id: input.targetUserId },
        data: { role: input.newRole },
      });
    }),

  // -----------------------------------------------------------------------
  // Analytics (dashboard)
  // -----------------------------------------------------------------------

  /** Get aggregated analytics for the authenticated user's content. */
  getAnalytics: protectedProcedure.query(async ({ ctx }) => {
    const [blogStats, journalStats, travelPlanStats, followerCount] =
      await Promise.all([
        ctx.prisma.blog.aggregate({
          where: { authorId: ctx.user.id },
          _sum: {
            viewCount: true,
            fullReadCount: true,
            likeCount: true,
            saveCount: true,
            commentCount: true,
          },
          _count: true,
        }),
        ctx.prisma.journal.aggregate({
          where: { authorId: ctx.user.id },
          _sum: {
            viewCount: true,
            fullReadCount: true,
            likeCount: true,
            saveCount: true,
            commentCount: true,
          },
          _count: true,
        }),
        ctx.prisma.travelPlan.aggregate({
          where: { authorId: ctx.user.id },
          _sum: {
            viewCount: true,
            fullReadCount: true,
            likeCount: true,
            saveCount: true,
            commentCount: true,
          },
          _count: true,
        }),
        ctx.prisma.follow.count({ where: { followingId: ctx.user.id } }),
      ]);

    const totalPosts =
      blogStats._count + journalStats._count + travelPlanStats._count;

    const sum = (
      a: number | null,
      b: number | null,
      c: number | null
    ): number => (a ?? 0) + (b ?? 0) + (c ?? 0);

    const totals = {
      posts: totalPosts,
      views: sum(
        blogStats._sum.viewCount,
        journalStats._sum.viewCount,
        travelPlanStats._sum.viewCount
      ),
      fullReads: sum(
        blogStats._sum.fullReadCount,
        journalStats._sum.fullReadCount,
        travelPlanStats._sum.fullReadCount
      ),
      likes: sum(
        blogStats._sum.likeCount,
        journalStats._sum.likeCount,
        travelPlanStats._sum.likeCount
      ),
      saves: sum(
        blogStats._sum.saveCount,
        journalStats._sum.saveCount,
        travelPlanStats._sum.saveCount
      ),
      comments: sum(
        blogStats._sum.commentCount,
        journalStats._sum.commentCount,
        travelPlanStats._sum.commentCount
      ),
      followers: followerCount,
    };

    const avg = (total: number) =>
      totalPosts > 0 ? Math.round((total / totalPosts) * 100) / 100 : 0;

    return {
      totals,
      averages: {
        views: avg(totals.views),
        fullReads: avg(totals.fullReads),
        likes: avg(totals.likes),
        saves: avg(totals.saves),
        comments: avg(totals.comments),
      },
    };
  }),

  /** Get the top 5 most popular posts across all content types. */
  getTopPosts: protectedProcedure.query(async ({ ctx }) => {
    const [blogs, journals, travelPlans] = await Promise.all([
      ctx.prisma.blog.findMany({
        where: { authorId: ctx.user.id },
        orderBy: { popularity: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          featuredImageUrl: true,
          popularity: true,
          viewCount: true,
          fullReadCount: true,
          likeCount: true,
          saveCount: true,
          commentCount: true,
        },
      }),
      ctx.prisma.journal.findMany({
        where: { authorId: ctx.user.id },
        orderBy: { popularity: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          featuredImageUrl: true,
          popularity: true,
          viewCount: true,
          fullReadCount: true,
          likeCount: true,
          saveCount: true,
          commentCount: true,
        },
      }),
      ctx.prisma.travelPlan.findMany({
        where: { authorId: ctx.user.id },
        orderBy: { popularity: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          featuredImageUrl: true,
          popularity: true,
          viewCount: true,
          fullReadCount: true,
          likeCount: true,
          saveCount: true,
          commentCount: true,
        },
      }),
    ]);

    type PostWithType = (typeof blogs)[number] & { contentType: string };

    const all: PostWithType[] = [
      ...blogs.map((b) => ({ ...b, contentType: ContentType.BLOG })),
      ...journals.map((j) => ({ ...j, contentType: ContentType.JOURNAL })),
      ...travelPlans.map((t) => ({
        ...t,
        contentType: ContentType.TRAVEL_PLAN,
      })),
    ];

    all.sort((a, b) => b.popularity - a.popularity);

    return all.slice(0, 5);
  }),
});
