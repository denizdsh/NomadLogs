/**
 * Blog router — CRUD, visibility, verification, likes, saves, views.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc/init.js";
import {
  protectedProcedure,
  editorProcedure,
  hasMinimumRole,
} from "../trpc/middleware.js";
import { slugify } from "../utils/slugify.js";
import { calculatePopularity } from "../utils/popularity.js";
import { notifyFollowers } from "../utils/notifications.js";
import { visibilitySchema, verificationStatusSchema } from "../utils/enums.js";
import { notFoundError, forbiddenError } from "../utils/errors.js";
import { UserRole, VerificationStatus, Visibility, ContentType, NotificationType } from "@nomadlogs/db";
import { updateAuthorPostCountAndRole, determineVerificationStatus } from "../utils/verification.js";
import { POPULARITY_MULTIPLIERS } from "../utils/popularity.js";

export const blogRouter = router({
  // -----------------------------------------------------------------------
  // Public queries
  // -----------------------------------------------------------------------

  /** Get a single blog by slug (public or with elevated access). */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const blog = await ctx.prisma.blog.findUnique({
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
          tags: { include: { tag: true } },
          locations: { include: { location: true }, orderBy: { order: "asc" } },
          journal: { select: { id: true, title: true, slug: true } },
        },
      });

      if (!blog) {
        throw notFoundError("Blog");
      }

      // Visibility checks
      const isAuthor = ctx.user?.id === blog.authorId;
      const isEditorOrAbove =
        ctx.user && hasMinimumRole(ctx.user.role, UserRole.EDITOR);

      if (blog.visibility === Visibility.PRIVATE && !isAuthor) {
        throw notFoundError("Blog");
      }

      if (
        blog.verificationStatus !== VerificationStatus.VERIFIED &&
        !isAuthor &&
        !isEditorOrAbove
      ) {
        throw notFoundError("Blog");
      }

      return blog;
    }),

  /** Get all standalone blogs (blogs not belonging to any journal) for the authenticated user. */
  getStandaloneBlogs: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.blog.findMany({
      where: {
        authorId: ctx.user.id,
        journalId: null,
      },
      include: {
        tags: { include: { tag: true } },
        locations: { include: { location: true }, orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // -----------------------------------------------------------------------
  // Protected mutations
  // -----------------------------------------------------------------------

  /** Create a new blog. */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(500),
        content: z.any(), // Editor.js JSON — validated at app level
        featuredImageUrl: z.url().optional(),
        visibility: visibilitySchema.default("PRIVATE"),
        journalId: z.uuid().optional(),
        tagIds: z.array(z.uuid()).default([]),
        locations: z
          .array(
            z.object({
              locationId: z.uuid(),
              order: z.number().int().min(0),
            })
          )
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isVerifiedAuthor = hasMinimumRole(ctx.user.role, UserRole.VERIFIED);

      const verificationStatus = isVerifiedAuthor ? VerificationStatus.VERIFIED : VerificationStatus.UNVERIFIED;
      const publishedAt =
        input.visibility !== Visibility.PRIVATE && isVerifiedAuthor
          ? new Date()
          : undefined;

      // Determine order in journal if applicable
      let orderInJournal: number | undefined;
      if (input.journalId) {
        const maxOrder = await ctx.prisma.blog.aggregate({
          where: { journalId: input.journalId },
          _max: { orderInJournal: true },
        });
        orderInJournal = (maxOrder._max.orderInJournal ?? 0) + 1;
      }

      const slug = await slugify(input.title, ctx.prisma);

      const blog = await ctx.prisma.$transaction(async (tx) => {
        const created = await tx.blog.create({
          data: {
            authorId: ctx.user.id,
            title: input.title,
            slug,
            description: input.description,
            content: input.content,
            featuredImageUrl: input.featuredImageUrl,
            visibility: input.visibility,
            verificationStatus,
            publishedAt,
            journalId: input.journalId,
            orderInJournal,
            tags: {
              createMany: {
                data: input.tagIds.map((tagId) => ({ tagId })),
              },
            },
            locations: {
              createMany: {
                data: input.locations.map((loc) => ({
                  locationId: loc.locationId,
                  order: loc.order,
                })),
              },
            },
          },
        });

        // Update journal blog count if applicable
        if (input.journalId) {
          await tx.journal.update({
            where: { id: input.journalId },
            data: { blogCount: { increment: 1 } },
          });
        }

        return created;
      });

      if (blog.visibility === "PUBLIC" && blog.verificationStatus === "VERIFIED") {
        notifyFollowers(ctx.prisma, ctx.user.id, ctx.user.name, "BLOG", blog.title, `/blog/${blog.slug}`).catch(console.error);
      }

      return blog;
    }),

  /** Update an existing blog. */
  update: protectedProcedure
    .input(
      z.object({
        blogId: z.uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(500).optional(),
        content: z.any().optional(),
        featuredImageUrl: z.url().nullable().optional(),
        tagIds: z.array(z.uuid()).optional(),
        locations: z
          .array(
            z.object({
              locationId: z.uuid(),
              order: z.number().int().min(0),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const blog = await ctx.prisma.blog.findUnique({
        where: { id: input.blogId },
      });

      if (!blog || blog.authorId !== ctx.user.id) {
        throw notFoundError("Blog");
      }

      return ctx.prisma.$transaction(async (tx) => {
        // Replace tags if provided
        if (input.tagIds) {
          await tx.blogTag.deleteMany({ where: { blogId: input.blogId } });
          await tx.blogTag.createMany({
            data: input.tagIds.map((tagId) => ({
              blogId: input.blogId,
              tagId,
            })),
          });
        }

        // Replace locations if provided
        if (input.locations) {
          await tx.blogLocation.deleteMany({
            where: { blogId: input.blogId },
          });
          await tx.blogLocation.createMany({
            data: input.locations.map((loc) => ({
              blogId: input.blogId,
              locationId: loc.locationId,
              order: loc.order,
            })),
          });
        }

        return tx.blog.update({
          where: { id: input.blogId },
          data: {
            title: input.title,
            description: input.description,
            content: input.content ?? undefined,
            featuredImageUrl: input.featuredImageUrl,
          },
        });
      });
    }),

  /** Change blog visibility. */
  changeVisibility: protectedProcedure
    .input(
      z.object({
        blogId: z.uuid(),
        visibility: visibilitySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const blog = await ctx.prisma.blog.findUnique({
        where: { id: input.blogId },
        include: { author: { select: { role: true } } },
      });

      if (!blog) {
        throw notFoundError("Blog");
      }

      const isAuthor = blog.authorId === ctx.user.id;
      const isEditorOrAbove = hasMinimumRole(ctx.user.role, UserRole.EDITOR);

      if (!isAuthor && !isEditorOrAbove) {
        throw forbiddenError("Not allowed.");
      }

      // Determine verification status when going from private → public/unlisted
      const verificationStatus = determineVerificationStatus(
        blog.verificationStatus,
        blog.visibility,
        input.visibility,
        blog.author.role
      );

      const publishedAt =
        !blog.publishedAt && input.visibility !== Visibility.PRIVATE
          ? new Date()
          : blog.publishedAt;

      const updated = await ctx.prisma.blog.update({
        where: { id: input.blogId },
        data: {
          visibility: input.visibility,
          verificationStatus,
          publishedAt,
        },
      });

      if (
        updated.visibility === Visibility.PUBLIC &&
        updated.verificationStatus === VerificationStatus.VERIFIED &&
        !(blog.visibility === Visibility.PUBLIC && blog.verificationStatus === VerificationStatus.VERIFIED)
      ) {
        // Resolve author name to display in notification
        ctx.prisma.user.findUnique({
          where: { id: blog.authorId },
          select: { name: true },
        }).then((authorUser) => {
          if (authorUser) {
            notifyFollowers(ctx.prisma, blog.authorId, authorUser.name, ContentType.BLOG, updated.title, `/blog/${updated.slug}`).catch(console.error);
          }
        });
      }

      return updated;
    }),

  /** Delete a blog. */
  delete: protectedProcedure
    .input(z.object({ blogId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const blog = await ctx.prisma.blog.findUnique({
        where: { id: input.blogId },
      });

      if (!blog || blog.authorId !== ctx.user.id) {
        throw notFoundError("Blog");
      }

      await ctx.prisma.$transaction(async (tx) => {
        // Decrement journal blog count if applicable
        if (blog.journalId) {
          await tx.journal.update({
            where: { id: blog.journalId },
            data: { blogCount: { decrement: 1 } },
          });
        }

        await tx.blog.delete({ where: { id: input.blogId } });
      });

      return { success: true };
    }),

  /** Move blog to a different journal (or make standalone). */
  moveToJournal: protectedProcedure
    .input(
      z.object({
        blogId: z.uuid(),
        targetJournalId: z.uuid().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const blog = await ctx.prisma.blog.findUnique({
        where: { id: input.blogId },
      });

      if (!blog || blog.authorId !== ctx.user.id) {
        throw notFoundError("Blog");
      }

      return ctx.prisma.$transaction(async (tx) => {
        // Decrement old journal count
        if (blog.journalId) {
          await tx.journal.update({
            where: { id: blog.journalId },
            data: { blogCount: { decrement: 1 } },
          });
        }

        let orderInJournal: number | null = null;

        // Increment new journal count + determine order
        if (input.targetJournalId) {
          const maxOrder = await tx.blog.aggregate({
            where: { journalId: input.targetJournalId },
            _max: { orderInJournal: true },
          });
          orderInJournal = (maxOrder._max.orderInJournal ?? 0) + 1;

          await tx.journal.update({
            where: { id: input.targetJournalId },
            data: { blogCount: { increment: 1 } },
          });
        }

        return tx.blog.update({
          where: { id: input.blogId },
          data: {
            journalId: input.targetJournalId,
            orderInJournal,
          },
        });
      });
    }),

  // -----------------------------------------------------------------------
  // Interactions (like, save, view)
  // -----------------------------------------------------------------------

  /** Toggle like on a blog. */
  toggleLike: protectedProcedure
    .input(z.object({ blogId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.like.findFirst({
        where: { userId: ctx.user.id, blogId: input.blogId },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.like.delete({ where: { id: existing.id } }),
          ctx.prisma.blog.update({
            where: { id: input.blogId },
            data: {
              likeCount: { decrement: 1 },
              popularity: {
                decrement: POPULARITY_MULTIPLIERS.like,
              },
            },
          }),
        ]);
        return { liked: false };
      }

      await ctx.prisma.$transaction([
        ctx.prisma.like.create({
          data: { userId: ctx.user.id, blogId: input.blogId },
        }),
        ctx.prisma.blog.update({
          where: { id: input.blogId },
          data: {
            likeCount: { increment: 1 },
            popularity: { increment: POPULARITY_MULTIPLIERS.like },
          },
        }),
      ]);
      return { liked: true };
    }),

  /** Toggle save (bookmark) on a blog. */
  toggleSave: protectedProcedure
    .input(z.object({ blogId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.save.findFirst({
        where: { userId: ctx.user.id, blogId: input.blogId },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.save.delete({ where: { id: existing.id } }),
          ctx.prisma.blog.update({
            where: { id: input.blogId },
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
          data: { userId: ctx.user.id, blogId: input.blogId },
        }),
        ctx.prisma.blog.update({
          where: { id: input.blogId },
          data: {
            saveCount: { increment: 1 },
            popularity: { increment: POPULARITY_MULTIPLIERS.save },
          },
        }),
      ]);
      return { saved: true };
    }),

  /** Record a view on a blog (deduplicated per user or IP). */
  recordView: publicProcedure
    .input(z.object({ blogId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id ?? null;
      const ipHash = !userId ? ctx.ipAddress : null;

      // Skip if neither user nor IP available
      if (!userId && !ipHash) return { recorded: false };

      const where = userId
        ? { userId_blogId: { userId, blogId: input.blogId } }
        : { ipHash_blogId: { ipHash: ipHash!, blogId: input.blogId } };

      const existing = await ctx.prisma.contentView.findUnique({ where });

      if (existing) return { recorded: false };

      await ctx.prisma.$transaction([
        ctx.prisma.contentView.create({
          data: { userId, ipHash, blogId: input.blogId },
        }),
        ctx.prisma.blog.update({
          where: { id: input.blogId },
          data: {
            viewCount: { increment: 1 },
            popularity: { increment: POPULARITY_MULTIPLIERS.view },
          },
        }),
      ]);

      return { recorded: true };
    }),

  /** Record a full read (scroll to bottom) on a blog. */
  recordFullRead: publicProcedure
    .input(z.object({ blogId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id ?? null;
      const ipHash = !userId ? ctx.ipAddress : null;

      if (!userId && !ipHash) return { recorded: false };

      const where = userId
        ? { userId_blogId: { userId, blogId: input.blogId } }
        : { ipHash_blogId: { ipHash: ipHash!, blogId: input.blogId } };

      const existing = await ctx.prisma.contentView.findUnique({ where });

      if (!existing || existing.hasFullRead) return { recorded: false };

      await ctx.prisma.$transaction([
        ctx.prisma.contentView.update({
          where: { id: existing.id },
          data: { hasFullRead: true },
        }),
        ctx.prisma.blog.update({
          where: { id: input.blogId },
          data: {
            fullReadCount: { increment: 1 },
            popularity: { increment: POPULARITY_MULTIPLIERS.fullRead },
          },
        }),
      ]);

      return { recorded: true };
    }),

  // -----------------------------------------------------------------------
  // Editor actions
  // -----------------------------------------------------------------------

  /** Verify or reject a blog (editor only). */
  setVerificationStatus: editorProcedure
    .input(
      z.object({
        blogId: z.uuid(),
        status: verificationStatusSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const blog = await ctx.prisma.blog.findUnique({
        where: { id: input.blogId },
      });

      if (!blog) {
        throw notFoundError("Blog");
      }

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.blog.update({
          where: { id: input.blogId },
          data: { verificationStatus: input.status },
        });

        // Handle verified post count for auto-promotion
        await updateAuthorPostCountAndRole(
          tx,
          blog.authorId,
          blog.verificationStatus,
          input.status
        );

        // Create notification for the author
        const statusText = input.status === VerificationStatus.VERIFIED ? "verified" : input.status.toLowerCase();
        await tx.notification.create({
          data: {
            recipientId: blog.authorId,
            type: NotificationType.VERIFICATION_CHANGE,
            message: `Your blog "${blog.title}" verification status is now ${statusText}.`,
            linkUrl: `/blog/${blog.slug}`,
            actorId: ctx.user.id,
          },
        });

        // Notify followers if newly verified and public
        if (
          input.status === VerificationStatus.VERIFIED &&
          blog.verificationStatus !== VerificationStatus.VERIFIED &&
          blog.visibility === Visibility.PUBLIC
        ) {
          const authorUser = await tx.user.findUnique({
            where: { id: blog.authorId },
            select: { name: true },
          });
          if (authorUser) {
            await notifyFollowers(tx, blog.authorId, authorUser.name, ContentType.BLOG, blog.title, `/blog/${blog.slug}`);
          }
        }

        return updated;
      });
    }),
});
