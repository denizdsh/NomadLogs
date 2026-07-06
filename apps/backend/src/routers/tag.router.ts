/**
 * Tag & Location router — listing, searching, and CRUD for tags and locations.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc/init.js";
import { protectedProcedure } from "../trpc/middleware.js";

export const tagRouter = router({
  // -----------------------------------------------------------------------
  // Tags
  // -----------------------------------------------------------------------

  /** List all tags, optionally filtered by search term. */
  listTags: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.tag.findMany({
        where: input.search
          ? { name: { contains: input.search, mode: "insensitive" } }
          : undefined,
        orderBy: { name: "asc" },
        take: input.limit,
      });
    }),

  /** Create a custom tag. */
  createTag: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      // Upsert to avoid duplicates (case-insensitive match)
      const existing = await ctx.prisma.tag.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" } },
      });

      if (existing) return existing;

      return ctx.prisma.tag.create({
        data: { name: input.name, isCustom: true },
      });
    }),

  // -----------------------------------------------------------------------
  // Locations
  // -----------------------------------------------------------------------

  /** Search locations by name. */
  searchLocations: publicProcedure
    .input(
      z.object({
        search: z.string().min(1),
        limit: z.number().int().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.location.findMany({
        where: { name: { contains: input.search, mode: "insensitive" } },
        orderBy: { name: "asc" },
        take: input.limit,
      });
    }),

  /** Create or find a location (deduplication by osmId). */
  upsertLocation: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        latitude: z.number(),
        longitude: z.number(),
        osmId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Deduplicate by osmId if provided
      if (input.osmId) {
        const existing = await ctx.prisma.location.findUnique({
          where: { osmId: input.osmId },
        });
        if (existing) return existing;
      }

      return ctx.prisma.location.create({
        data: {
          name: input.name,
          latitude: input.latitude,
          longitude: input.longitude,
          osmId: input.osmId,
        },
      });
    }),
});
