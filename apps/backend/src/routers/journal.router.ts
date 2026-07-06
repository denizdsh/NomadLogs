/**
 * Journal router — CRUD, blog management within journals, interactions.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc/init.js";
import {
  protectedProcedure,
  editorProcedure,
  hasMinimumRole,
} from "../trpc/middleware.js";
import { slugify } from "../utils/slugify.js";
import { notifyFollowers } from "../utils/notifications.js";
import { visibilitySchema, verificationStatusSchema } from "../utils/enums.js";
import { notFoundError, badRequestError, forbiddenError } from "../utils/errors.js";
import { UserRole, VerificationStatus, Visibility, ContentType, NotificationType } from "@nomadlogs/db";
import { updateAuthorPostCountAndRole, determineVerificationStatus } from "../utils/verification.js";
import { POPULARITY_MULTIPLIERS } from "../utils/popularity.js";

export const journalRouter = router({
  // -----------------------------------------------------------------------
  // Public queries
  // -----------------------------------------------------------------------

  /** Get a journal by slug with its blogs. */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const journal = await ctx.prisma.journal.findUnique({
        where: { slug: input.slug },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              role: true,
              donationLinks: true,
            },
          },
          blogs: {
            orderBy: { orderInJournal: "asc" },
            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              featuredImageUrl: true,
              orderInJournal: true,
              visibility: true,
              verificationStatus: true,
            },
          },
          tags: { include: { tag: true } },
          locations: { include: { location: true } },
        },
      });

      if (!journal) {
        throw notFoundError("Journal");
      }

      const isAuthor = ctx.user?.id === journal.authorId;
      const isEditorOrAbove =
        ctx.user && hasMinimumRole(ctx.user.role, "EDITOR");

      if (journal.visibility === "PRIVATE" && !isAuthor) {
        throw notFoundError("Journal");
      }

      if (
        journal.verificationStatus !== "VERIFIED" &&
        !isAuthor &&
        !isEditorOrAbove
      ) {
        throw notFoundError("Journal");
      }

      return journal;
    }),

  /** Get all journals owned by the authenticated user. */
  getMyJournals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.journal.findMany({
      where: {
        authorId: ctx.user.id,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // -----------------------------------------------------------------------
  // Protected mutations
  // -----------------------------------------------------------------------

  /** Create a new journal. */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(500),
        featuredImageUrl: z.url().optional(),
        visibility: visibilitySchema.default("PRIVATE"),
        tagIds: z.array(z.uuid()).default([]),
        locationIds: z.array(z.uuid()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isVerifiedAuthor = hasMinimumRole(ctx.user.role, UserRole.VERIFIED);
      const verificationStatus = isVerifiedAuthor ? VerificationStatus.VERIFIED : VerificationStatus.UNVERIFIED;
      const publishedAt =
        input.visibility !== Visibility.PRIVATE && isVerifiedAuthor
          ? new Date()
          : undefined;

      const slug = await slugify(input.title, ctx.prisma);

      const journal = await ctx.prisma.journal.create({
        data: {
          authorId: ctx.user.id,
          title: input.title,
          slug,
          description: input.description,
          featuredImageUrl: input.featuredImageUrl,
          visibility: input.visibility,
          verificationStatus,
          publishedAt,
          tags: {
            createMany: {
              data: input.tagIds.map((tagId) => ({ tagId })),
            },
          },
          locations: {
            createMany: {
              data: input.locationIds.map((locationId) => ({ locationId })),
            },
          },
        },
      });

      if (journal.visibility === Visibility.PUBLIC && journal.verificationStatus === VerificationStatus.VERIFIED) {
        notifyFollowers(ctx.prisma, ctx.user.id, ctx.user.name, ContentType.JOURNAL, journal.title, `/journal/${journal.slug}`).catch(console.error);
      }

      return journal;
    }),

  /** Update a journal. */
  update: protectedProcedure
    .input(
      z.object({
        journalId: z.uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(500).optional(),
        featuredImageUrl: z.url().nullable().optional(),
        tagIds: z.array(z.uuid()).optional(),
        locationIds: z.array(z.uuid()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const journal = await ctx.prisma.journal.findUnique({
        where: { id: input.journalId },
      });

      if (!journal || journal.authorId !== ctx.user.id) {
        throw notFoundError("Journal");
      }

      return ctx.prisma.$transaction(async (tx) => {
        if (input.tagIds) {
          await tx.journalTag.deleteMany({
            where: { journalId: input.journalId },
          });
          await tx.journalTag.createMany({
            data: input.tagIds.map((tagId) => ({
              journalId: input.journalId,
              tagId,
            })),
          });
        }

        if (input.locationIds) {
          await tx.journalLocation.deleteMany({
            where: { journalId: input.journalId },
          });
          await tx.journalLocation.createMany({
            data: input.locationIds.map((locationId) => ({
              journalId: input.journalId,
              locationId,
            })),
          });
        }

        return tx.journal.update({
          where: { id: input.journalId },
          data: {
            title: input.title,
            description: input.description,
            featuredImageUrl: input.featuredImageUrl,
          },
        });
      });
    }),

  /**
   * Delete a journal.
   *
   * Two modes: "collection-only" keeps blogs as standalone,
   * "everything" deletes the journal and all its blogs.
   */
  delete: protectedProcedure
    .input(
      z.object({
        journalId: z.uuid(),
        deleteBlogs: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const journal = await ctx.prisma.journal.findUnique({
        where: { id: input.journalId },
      });

      if (!journal || journal.authorId !== ctx.user.id) {
        throw notFoundError("Journal");
      }

      await ctx.prisma.$transaction(async (tx) => {
        if (input.deleteBlogs) {
          // Delete all blogs in this journal
          await tx.blog.deleteMany({ where: { journalId: input.journalId } });
        } else {
          // Detach blogs — they become standalone (SetNull FK handles this,
          // but we also clear orderInJournal explicitly)
          await tx.blog.updateMany({
            where: { journalId: input.journalId },
            data: { journalId: null, orderInJournal: null },
          });
        }

        await tx.journal.delete({ where: { id: input.journalId } });
      });

      return { success: true };
    }),

  /** Change journal visibility. */
  changeVisibility: protectedProcedure
    .input(
      z.object({
        journalId: z.uuid(),
        visibility: visibilitySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const journal = await ctx.prisma.journal.findUnique({
        where: { id: input.journalId },
        include: { author: { select: { role: true } } },
      });

      if (!journal) {
        throw notFoundError("Journal");
      }

      const isAuthor = journal.authorId === ctx.user.id;
      const isEditorOrAbove = hasMinimumRole(ctx.user.role, UserRole.EDITOR);

      if (!isAuthor && !isEditorOrAbove) {
        throw forbiddenError("Not allowed.");
      }

      // Determine verification status when going from private → public/unlisted
      const verificationStatus = determineVerificationStatus(
        journal.verificationStatus,
        journal.visibility,
        input.visibility,
        journal.author.role
      );

      const publishedAt =
        !journal.publishedAt && input.visibility !== Visibility.PRIVATE
          ? new Date()
          : journal.publishedAt;

      const updated = await ctx.prisma.journal.update({
        where: { id: input.journalId },
        data: {
          visibility: input.visibility,
          verificationStatus,
          publishedAt,
        },
      });

      if (
        updated.visibility === Visibility.PUBLIC &&
        updated.verificationStatus === VerificationStatus.VERIFIED &&
        !(journal.visibility === Visibility.PUBLIC && journal.verificationStatus === VerificationStatus.VERIFIED)
      ) {
        ctx.prisma.user.findUnique({
          where: { id: journal.authorId },
          select: { name: true },
        }).then((authorUser) => {
          if (authorUser) {
            notifyFollowers(ctx.prisma, journal.authorId, authorUser.name, ContentType.JOURNAL, updated.title, `/journal/${updated.slug}`).catch(console.error);
          }
        });
      }

      return updated;
    }),

  /** Reorder blogs within a journal. */
  reorderBlogs: protectedProcedure
    .input(
      z.object({
        journalId: z.uuid(),
        /** Ordered array of blog IDs representing the new order */
        blogIds: z.array(z.uuid()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const journal = await ctx.prisma.journal.findUnique({
        where: { id: input.journalId },
      });

      if (!journal || journal.authorId !== ctx.user.id) {
        throw notFoundError("Journal");
      }

      await ctx.prisma.$transaction(
        input.blogIds.map((blogId, index) =>
          ctx.prisma.blog.update({
            where: { id: blogId },
            data: { orderInJournal: index + 1 },
          })
        )
      );

      return { success: true };
    }),

  /** Add an existing standalone blog to a journal. */
  addBlog: protectedProcedure
    .input(
      z.object({
        journalId: z.uuid(),
        blogId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [journal, blog] = await Promise.all([
        ctx.prisma.journal.findUnique({ where: { id: input.journalId } }),
        ctx.prisma.blog.findUnique({ where: { id: input.blogId } }),
      ]);

      if (!journal || journal.authorId !== ctx.user.id) {
        throw notFoundError("Journal");
      }

      if (!blog || blog.authorId !== ctx.user.id) {
        throw notFoundError("Blog");
      }

      if (blog.journalId) {
        throw badRequestError(
          "Blog already belongs to a journal. Remove it first or use the move action."
        );
      }

      const maxOrder = await ctx.prisma.blog.aggregate({
        where: { journalId: input.journalId },
        _max: { orderInJournal: true },
      });

      await ctx.prisma.$transaction([
        ctx.prisma.blog.update({
          where: { id: input.blogId },
          data: {
            journalId: input.journalId,
            orderInJournal: (maxOrder._max.orderInJournal ?? 0) + 1,
          },
        }),
        ctx.prisma.journal.update({
          where: { id: input.journalId },
          data: { blogCount: { increment: 1 } },
        }),
      ]);

      return { success: true };
    }),

  /** Remove a blog from a journal (makes it standalone). */
  removeBlog: protectedProcedure
    .input(
      z.object({
        journalId: z.uuid(),
        blogId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const journal = await ctx.prisma.journal.findUnique({
        where: { id: input.journalId },
      });

      if (!journal || journal.authorId !== ctx.user.id) {
        throw notFoundError("Journal");
      }

      await ctx.prisma.$transaction([
        ctx.prisma.blog.update({
          where: { id: input.blogId },
          data: { journalId: null, orderInJournal: null },
        }),
        ctx.prisma.journal.update({
          where: { id: input.journalId },
          data: { blogCount: { decrement: 1 } },
        }),
      ]);

      return { success: true };
    }),

  // -----------------------------------------------------------------------
  // Interactions
  // -----------------------------------------------------------------------

  /** Toggle like on a journal. */
  toggleLike: protectedProcedure
    .input(z.object({ journalId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.like.findFirst({
        where: { userId: ctx.user.id, journalId: input.journalId },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.like.delete({ where: { id: existing.id } }),
          ctx.prisma.journal.update({
            where: { id: input.journalId },
            data: { likeCount: { decrement: 1 }, popularity: { decrement: POPULARITY_MULTIPLIERS.like } },
          }),
        ]);
        return { liked: false };
      }

      await ctx.prisma.$transaction([
        ctx.prisma.like.create({
          data: { userId: ctx.user.id, journalId: input.journalId },
        }),
        ctx.prisma.journal.update({
          where: { id: input.journalId },
          data: { likeCount: { increment: 1 }, popularity: { increment: POPULARITY_MULTIPLIERS.like } },
        }),
      ]);
      return { liked: true };
    }),

  /** Toggle save on a journal. */
  toggleSave: protectedProcedure
    .input(z.object({ journalId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.save.findFirst({
        where: { userId: ctx.user.id, journalId: input.journalId },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.save.delete({ where: { id: existing.id } }),
          ctx.prisma.journal.update({
            where: { id: input.journalId },
            data: {
              saveCount: { decrement: 1 },
              popularity: { decrement: POPULARITY_MULTIPLIERS.save },
            },
          }),
        ]);
        return { saved: false };
      }

      await ctx.prisma.$transaction([
        ctx.prisma.save.create({
          data: { userId: ctx.user.id, journalId: input.journalId },
        }),
        ctx.prisma.journal.update({
          where: { id: input.journalId },
          data: {
            saveCount: { increment: 1 },
            popularity: { increment: POPULARITY_MULTIPLIERS.save },
          },
        }),
      ]);
      return { saved: true };
    }),

  // -----------------------------------------------------------------------
  // Editor actions
  // -----------------------------------------------------------------------

  /** Verify or reject a journal (editor only). */
  setVerificationStatus: editorProcedure
    .input(
      z.object({
        journalId: z.uuid(),
        status: verificationStatusSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const journal = await ctx.prisma.journal.findUnique({
        where: { id: input.journalId },
      });

      if (!journal) {
        throw notFoundError("Journal");
      }

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.journal.update({
          where: { id: input.journalId },
          data: { verificationStatus: input.status },
        });

        // Handle verified post count for auto-promotion
        await updateAuthorPostCountAndRole(
          tx,
          journal.authorId,
          journal.verificationStatus,
          input.status
        );

        // Create notification for the author
        const statusText = input.status === VerificationStatus.VERIFIED ? "verified" : input.status.toLowerCase();
        await tx.notification.create({
          data: {
            recipientId: journal.authorId,
            type: NotificationType.VERIFICATION_CHANGE,
            message: `Your journal "${journal.title}" verification status is now ${statusText}.`,
            linkUrl: `/journal/${journal.slug}`,
            actorId: ctx.user.id,
          },
        });

        // Notify followers if newly verified and public
        if (
          input.status === VerificationStatus.VERIFIED &&
          journal.verificationStatus !== VerificationStatus.VERIFIED &&
          journal.visibility === Visibility.PUBLIC
        ) {
          const authorUser = await tx.user.findUnique({
            where: { id: journal.authorId },
            select: { name: true },
          });
          if (authorUser) {
            await notifyFollowers(tx, journal.authorId, authorUser.name, ContentType.JOURNAL, journal.title, `/journal/${journal.slug}`);
          }
        }

        return updated;
      });
    }),
});
