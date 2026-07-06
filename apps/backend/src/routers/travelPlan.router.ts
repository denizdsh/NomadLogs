/**
 * Travel Plan router — CRUD, block management, interactions.
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
import {
  visibilitySchema,
  verificationStatusSchema,
  seasonSchema,
  travelPlanBlockTypeSchema,
} from "../utils/enums.js";
import { notFoundError, forbiddenError } from "../utils/errors.js";
import { UserRole, VerificationStatus, Visibility, ContentType, TravelPlanBlockType, NotificationType } from "@nomadlogs/db";
import { updateAuthorPostCountAndRole, determineVerificationStatus } from "../utils/verification.js";
import { POPULARITY_MULTIPLIERS } from "../utils/popularity.js";

export const travelPlanRouter = router({
  // -----------------------------------------------------------------------
  // Public queries
  // -----------------------------------------------------------------------

  /** Get a travel plan by slug with blocks. */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const plan = await ctx.prisma.travelPlan.findUnique({
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
          blocks: {
            orderBy: { order: "asc" },
            include: {
              locations: {
                include: { location: true },
                orderBy: { order: "asc" },
              },
            },
          },
          tags: { include: { tag: true } },
          locations: { include: { location: true } },
        },
      });

      if (!plan) {
        throw notFoundError("Travel plan");
      }

      const isAuthor = ctx.user?.id === plan.authorId;
      const isEditorOrAbove =
        ctx.user && hasMinimumRole(ctx.user.role, "EDITOR");

      if (plan.visibility === "PRIVATE" && !isAuthor) {
        throw notFoundError("Travel plan");
      }

      if (
        plan.verificationStatus !== "VERIFIED" &&
        !isAuthor &&
        !isEditorOrAbove
      ) {
        throw notFoundError("Travel plan");
      }

      return plan;
    }),

  // -----------------------------------------------------------------------
  // Protected mutations
  // -----------------------------------------------------------------------

  /** Create a new travel plan. */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(500),
        featuredImageUrl: z.url().optional(),
        season: seasonSchema.default("ALL"),
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

      const travelPlan = await ctx.prisma.travelPlan.create({
        data: {
          authorId: ctx.user.id,
          title: input.title,
          slug,
          description: input.description,
          featuredImageUrl: input.featuredImageUrl,
          season: input.season,
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

      if (travelPlan.visibility === Visibility.PUBLIC && travelPlan.verificationStatus === VerificationStatus.VERIFIED) {
        notifyFollowers(ctx.prisma, ctx.user.id, ctx.user.name, ContentType.TRAVEL_PLAN, travelPlan.title, `/plan/${travelPlan.slug}`).catch(console.error);
      }

      return travelPlan;
    }),

  /** Update a travel plan's metadata. */
  update: protectedProcedure
    .input(
      z.object({
        travelPlanId: z.uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(500).optional(),
        featuredImageUrl: z.url().nullable().optional(),
        season: seasonSchema.optional(),
        tagIds: z.array(z.uuid()).optional(),
        locationIds: z.array(z.uuid()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id: input.travelPlanId },
      });

      if (!plan || plan.authorId !== ctx.user.id) {
        throw notFoundError("Travel plan");
      }

      return ctx.prisma.$transaction(async (tx) => {
        if (input.tagIds) {
          await tx.travelPlanTag.deleteMany({
            where: { travelPlanId: input.travelPlanId },
          });
          await tx.travelPlanTag.createMany({
            data: input.tagIds.map((tagId) => ({
              travelPlanId: input.travelPlanId,
              tagId,
            })),
          });
        }

        if (input.locationIds) {
          await tx.travelPlanLocation.deleteMany({
            where: { travelPlanId: input.travelPlanId },
          });
          await tx.travelPlanLocation.createMany({
            data: input.locationIds.map((locationId) => ({
              travelPlanId: input.travelPlanId,
              locationId,
            })),
          });
        }

        return tx.travelPlan.update({
          where: { id: input.travelPlanId },
          data: {
            title: input.title,
            description: input.description,
            featuredImageUrl: input.featuredImageUrl,
            season: input.season,
          },
        });
      });
    }),

  /** Delete a travel plan. */
  delete: protectedProcedure
    .input(z.object({ travelPlanId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id: input.travelPlanId },
      });

      if (!plan || plan.authorId !== ctx.user.id) {
        throw notFoundError("Travel plan");
      }

      await ctx.prisma.travelPlan.delete({
        where: { id: input.travelPlanId },
      });

      return { success: true };
    }),

  /** Change travel plan visibility. */
  changeVisibility: protectedProcedure
    .input(
      z.object({
        travelPlanId: z.uuid(),
        visibility: visibilitySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id: input.travelPlanId },
        include: { author: { select: { role: true } } },
      });

      if (!plan) {
        throw notFoundError("Travel plan");
      }

      const isAuthor = plan.authorId === ctx.user.id;
      const isEditorOrAbove = hasMinimumRole(ctx.user.role, UserRole.EDITOR);

      if (!isAuthor && !isEditorOrAbove) {
        throw forbiddenError("Not allowed.");
      }

      // Determine verification status when going from private → public/unlisted
      const verificationStatus = determineVerificationStatus(
        plan.verificationStatus,
        plan.visibility,
        input.visibility,
        plan.author.role
      );

      const publishedAt =
        !plan.publishedAt && input.visibility !== Visibility.PRIVATE
          ? new Date()
          : plan.publishedAt;

      const updated = await ctx.prisma.travelPlan.update({
        where: { id: input.travelPlanId },
        data: {
          visibility: input.visibility,
          verificationStatus,
          publishedAt,
        },
      });

      if (
        updated.visibility === Visibility.PUBLIC &&
        updated.verificationStatus === VerificationStatus.VERIFIED &&
        !(plan.visibility === Visibility.PUBLIC && plan.verificationStatus === VerificationStatus.VERIFIED)
      ) {
        ctx.prisma.user.findUnique({
          where: { id: plan.authorId },
          select: { name: true },
        }).then((authorUser) => {
          if (authorUser) {
            notifyFollowers(ctx.prisma, plan.authorId, authorUser.name, ContentType.TRAVEL_PLAN, updated.title, `/plan/${updated.slug}`).catch(console.error);
          }
        });
      }

      return updated;
    }),

  // -----------------------------------------------------------------------
  // Block management
  // -----------------------------------------------------------------------

  /** Add a block (day or custom) to a travel plan. */
  addBlock: protectedProcedure
    .input(
      z.object({
        travelPlanId: z.uuid(),
        type: travelPlanBlockTypeSchema,
        title: z.string().min(1).max(200),
        content: z.any(),
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
      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id: input.travelPlanId },
      });

      if (!plan || plan.authorId !== ctx.user.id) {
        throw notFoundError("Travel plan");
      }

      // Determine order and day number
      const maxOrder = await ctx.prisma.travelPlanBlock.aggregate({
        where: { travelPlanId: input.travelPlanId },
        _max: { order: true },
      });
      const order = (maxOrder._max.order ?? 0) + 1;

      let dayNumber: number | undefined;
      if (input.type === TravelPlanBlockType.DAY) {
        const maxDay = await ctx.prisma.travelPlanBlock.aggregate({
          where: {
            travelPlanId: input.travelPlanId,
            type: TravelPlanBlockType.DAY,
          },
          _max: { dayNumber: true },
        });
        dayNumber = (maxDay._max.dayNumber ?? 0) + 1;
      }

      return ctx.prisma.$transaction(async (tx) => {
        const block = await tx.travelPlanBlock.create({
          data: {
            travelPlanId: input.travelPlanId,
            type: input.type,
            title: input.title,
            dayNumber,
            order,
            content: input.content,
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

        if (input.type === TravelPlanBlockType.DAY) {
          await tx.travelPlan.update({
            where: { id: input.travelPlanId },
            data: { dayCount: { increment: 1 } },
          });
        }

        return block;
      });
    }),

  /** Update a block's content. */
  updateBlock: protectedProcedure
    .input(
      z.object({
        blockId: z.uuid(),
        title: z.string().min(1).max(200).optional(),
        content: z.any().optional(),
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
      const block = await ctx.prisma.travelPlanBlock.findUnique({
        where: { id: input.blockId },
        include: { travelPlan: { select: { authorId: true } } },
      });

      if (!block || block.travelPlan.authorId !== ctx.user.id) {
        throw notFoundError("Block");
      }

      return ctx.prisma.$transaction(async (tx) => {
        if (input.locations) {
          await tx.travelPlanBlockLocation.deleteMany({
            where: { blockId: input.blockId },
          });
          await tx.travelPlanBlockLocation.createMany({
            data: input.locations.map((loc) => ({
              blockId: input.blockId,
              locationId: loc.locationId,
              order: loc.order,
            })),
          });
        }

        return tx.travelPlanBlock.update({
          where: { id: input.blockId },
          data: {
            title: input.title,
            content: input.content ?? undefined,
          },
        });
      });
    }),

  /** Delete a block from a travel plan. */
  deleteBlock: protectedProcedure
    .input(z.object({ blockId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const block = await ctx.prisma.travelPlanBlock.findUnique({
        where: { id: input.blockId },
        include: { travelPlan: { select: { id: true, authorId: true } } },
      });

      if (!block || block.travelPlan.authorId !== ctx.user.id) {
        throw notFoundError("Block");
      }

      await ctx.prisma.$transaction(async (tx) => {
        await tx.travelPlanBlock.delete({ where: { id: input.blockId } });

        if (block.type === TravelPlanBlockType.DAY) {
          await tx.travelPlan.update({
            where: { id: block.travelPlan.id },
            data: { dayCount: { decrement: 1 } },
          });
        }
      });

      return { success: true };
    }),

  /** Reorder blocks within a travel plan. */
  reorderBlocks: protectedProcedure
    .input(
      z.object({
        travelPlanId: z.uuid(),
        blockIds: z.array(z.uuid()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id: input.travelPlanId },
      });

      if (!plan || plan.authorId !== ctx.user.id) {
        throw notFoundError("Travel plan");
      }

      // Update order for all blocks and recalculate day numbers
      await ctx.prisma.$transaction(async (tx) => {
        let dayCounter = 0;

        for (let i = 0; i < input.blockIds.length; i++) {
          const blockId = input.blockIds[i]!;

          const block = await tx.travelPlanBlock.findUnique({
            where: { id: blockId },
            select: { type: true },
          });

          const dayNumber = block?.type === TravelPlanBlockType.DAY ? ++dayCounter : undefined;

          await tx.travelPlanBlock.update({
            where: { id: blockId },
            data: {
              order: i + 1,
              ...(block?.type === TravelPlanBlockType.DAY ? { dayNumber } : {}),
            },
          });
        }
      });

      return { success: true };
    }),

  // -----------------------------------------------------------------------
  // Interactions
  // -----------------------------------------------------------------------

  toggleLike: protectedProcedure
    .input(z.object({ travelPlanId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.like.findFirst({
        where: { userId: ctx.user.id, travelPlanId: input.travelPlanId },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.like.delete({ where: { id: existing.id } }),
          ctx.prisma.travelPlan.update({
            where: { id: input.travelPlanId },
            data: { likeCount: { decrement: 1 }, popularity: { decrement: POPULARITY_MULTIPLIERS.like } },
          }),
        ]);
        return { liked: false };
      }

      await ctx.prisma.$transaction([
        ctx.prisma.like.create({
          data: { userId: ctx.user.id, travelPlanId: input.travelPlanId },
        }),
        ctx.prisma.travelPlan.update({
          where: { id: input.travelPlanId },
          data: { likeCount: { increment: 1 }, popularity: { increment: POPULARITY_MULTIPLIERS.like } },
        }),
      ]);
      return { liked: true };
    }),

  toggleSave: protectedProcedure
    .input(z.object({ travelPlanId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.save.findFirst({
        where: { userId: ctx.user.id, travelPlanId: input.travelPlanId },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.save.delete({ where: { id: existing.id } }),
          ctx.prisma.travelPlan.update({
            where: { id: input.travelPlanId },
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
          data: { userId: ctx.user.id, travelPlanId: input.travelPlanId },
        }),
        ctx.prisma.travelPlan.update({
          where: { id: input.travelPlanId },
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

  setVerificationStatus: editorProcedure
    .input(
      z.object({
        travelPlanId: z.uuid(),
        status: verificationStatusSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.travelPlan.findUnique({
        where: { id: input.travelPlanId },
      });

      if (!plan) {
        throw notFoundError("Travel plan");
      }

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.travelPlan.update({
          where: { id: input.travelPlanId },
          data: { verificationStatus: input.status },
        });

        // Handle verified post count for auto-promotion
        await updateAuthorPostCountAndRole(
          tx,
          plan.authorId,
          plan.verificationStatus,
          input.status
        );

        // Create notification for the author
        const statusText = input.status === VerificationStatus.VERIFIED ? "verified" : input.status.toLowerCase();
        await tx.notification.create({
          data: {
            recipientId: plan.authorId,
            type: NotificationType.VERIFICATION_CHANGE,
            message: `Your travel plan "${plan.title}" verification status is now ${statusText}.`,
            linkUrl: `/plan/${plan.slug}`,
            actorId: ctx.user.id,
          },
        });

        // Notify followers if newly verified and public
        if (
          input.status === VerificationStatus.VERIFIED &&
          plan.verificationStatus !== VerificationStatus.VERIFIED &&
          plan.visibility === Visibility.PUBLIC
        ) {
          const authorUser = await tx.user.findUnique({
            where: { id: plan.authorId },
            select: { name: true },
          });
          if (authorUser) {
            await notifyFollowers(tx, plan.authorId, authorUser.name, ContentType.TRAVEL_PLAN, plan.title, `/plan/${plan.slug}`);
          }
        }

        return updated;
      });
    }),
});
