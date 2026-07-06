/**
 * Explore router — Explore page content listing, feed, and search.
 *
 * Powers the Explore Journals & Travel Plans screen, Feed screen,
 * and Editor Studio content listing.
 */
import { z } from "zod";
import { router, publicProcedure } from "../trpc/init.js";
import {
  protectedProcedure,
  editorProcedure,
  hasMinimumRole,
} from "../trpc/middleware.js";
import {
  contentTypeSchema,
  verificationStatusSchema,
  userRoleSchema,
  visibilitySchema,
  getContentTypes,
} from "../utils/enums.js";
import { UserRole, VerificationStatus, Visibility, ContentType } from "@nomadlogs/db";
import { buildTagFilter, buildLocationFilter } from "../utils/query.js";
import { geolocateIp, getDistanceKm } from "../utils/geolocation.js";

/** Shared content card select fields for list views. */
const contentCardSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  featuredImageUrl: true,
  visibility: true,
  verificationStatus: true,
  likeCount: true,
  saveCount: true,
  viewCount: true,
  fullReadCount: true,
  commentCount: true,
  popularity: true,
  publishedAt: true,
  createdAt: true,
  author: {
    select: { id: true, name: true, avatarUrl: true, role: true },
  },
  tags: { include: { tag: true } },
  locations: { include: { location: true } },
} as const;

/** Sort options mapping. */
const SORT_MAP = {
  newest: { publishedAt: "desc" as const },
  oldest: { publishedAt: "asc" as const },
  popular: { popularity: "desc" as const },
};

export const exploreRouter = router({
  /**
   * Explore content — unified query for blogs, journals, and travel plans.
   *
   * Used by the Explore page, Feed page, User Content screen, and Editor Studio.
   */
  list: publicProcedure
    .input(
      z.object({
        contentTypes: z
          .array(contentTypeSchema)
          .default(getContentTypes()),
        sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
        tagIds: z.array(z.uuid()).optional(),
        locationIds: z.array(z.uuid()).optional(),
        /** Filter by specific author (User Content screen) */
        authorId: z.uuid().optional(),
        /** Search content by title */
        search: z.string().optional(),
        /** Exclude a specific content ID from results */
        excludeId: z.uuid().optional(),
        /** Feature content around user's IP-based location */
        featuredAroundIp: z.boolean().optional(),
        /** Editor-only filters */
        verificationStatus: verificationStatusSchema.optional(),
        authorRole: userRoleSchema.optional(),
        visibilityFilter: visibilitySchema.optional(),
        /** Cursor-based pagination */
        cursor: z.uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const isEditorOrAbove =
        ctx.user && hasMinimumRole(ctx.user.role, UserRole.EDITOR);
      const isAuthor = ctx.user && input.authorId && ctx.user.id === input.authorId;
      const showAllStates = isEditorOrAbove || isAuthor;

      const orderBy = SORT_MAP[input.sort];

      // Build shared WHERE clause
      const baseWhere = {
        // Public-facing: only show PUBLIC + VERIFIED content
        // Editors/Authors: can see all visibilities and verification statuses
        ...(showAllStates
          ? {
            ...(input.verificationStatus
              ? { verificationStatus: input.verificationStatus }
              : {}),
            ...(input.visibilityFilter
              ? { visibility: input.visibilityFilter }
              : {}),
          }
          : {
            visibility: Visibility.PUBLIC,
            verificationStatus: VerificationStatus.VERIFIED,
          }),
        ...(input.authorId ? { authorId: input.authorId } : {}),
        ...(input.authorRole
          ? { author: { role: input.authorRole } }
          : {}),
      };

      // Search by title filter
      const searchFilter = input.search
        ? { title: { contains: input.search, mode: "insensitive" as const } }
        : {};

      // Exclude specific ID filter
      const excludeFilter = input.excludeId
        ? { id: { not: input.excludeId } }
        : {};

      // Handle geolocation filter if requested
      let nearbyLocationIds: string[] | undefined;
      if (input.featuredAroundIp) {
        const coords = await geolocateIp(ctx.ipAddress);
        const allLocations = await ctx.prisma.location.findMany({
          select: { id: true, latitude: true, longitude: true },
        });

        const nearby = allLocations
          .map((loc) => ({
            id: loc.id,
            distance: getDistanceKm(
              coords.latitude,
              coords.longitude,
              loc.latitude,
              loc.longitude
            ),
          }))
          .filter((loc) => loc.distance <= 500)
          .sort((a, b) => a.distance - b.distance);

        // Fallback to a dummy UUID so query returns empty if no locations match nearby
        nearbyLocationIds =
          nearby.length > 0
            ? nearby.map((loc) => loc.id)
            : ["00000000-0000-0000-0000-000000000000"];
      }

      const mergedLocationIds = [
        ...(input.locationIds ?? []),
        ...(nearbyLocationIds ?? []),
      ];

      const locationFilter =
        input.locationIds?.length || nearbyLocationIds !== undefined
          ? buildLocationFilter(mergedLocationIds)
          : {};

      const results: Array<{
        contentType: string;
        items: unknown[];
        nextCursor?: string;
      }> = [];

      // Fetch each content type requested
      if (input.contentTypes.includes(ContentType.BLOG)) {
        const tagFilter = buildTagFilter(input.tagIds);

        const blogs = await ctx.prisma.blog.findMany({
          where: { ...baseWhere, ...tagFilter, ...locationFilter, ...searchFilter, ...excludeFilter },
          orderBy,
          take: input.limit + 1,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
          select: {
            ...contentCardSelect,
            journalId: true,
            journal: { select: { id: true, title: true, slug: true } },
          },
        });

        let nextCursor: string | undefined;
        if (blogs.length > input.limit) {
          nextCursor = blogs.pop()?.id;
        }

        results.push({
          contentType: ContentType.BLOG,
          items: blogs,
          nextCursor,
        });
      }

      if (input.contentTypes.includes(ContentType.JOURNAL)) {
        const tagFilter = buildTagFilter(input.tagIds);

        const journals = await ctx.prisma.journal.findMany({
          where: { ...baseWhere, ...tagFilter, ...locationFilter, ...searchFilter, ...excludeFilter },
          orderBy,
          take: input.limit + 1,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
          select: {
            ...contentCardSelect,
            blogCount: true,
          },
        });

        let nextCursor: string | undefined;
        if (journals.length > input.limit) {
          nextCursor = journals.pop()?.id;
        }

        results.push({
          contentType: ContentType.JOURNAL,
          items: journals,
          nextCursor,
        });
      }

      if (input.contentTypes.includes(ContentType.TRAVEL_PLAN)) {
        const tagFilter = buildTagFilter(input.tagIds);

        const travelPlans = await ctx.prisma.travelPlan.findMany({
          where: { ...baseWhere, ...tagFilter, ...locationFilter, ...searchFilter, ...excludeFilter },
          orderBy,
          take: input.limit + 1,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
          select: {
            ...contentCardSelect,
            season: true,
            dayCount: true,
          },
        });

        let nextCursor: string | undefined;
        if (travelPlans.length > input.limit) {
          nextCursor = travelPlans.pop()?.id;
        }

        results.push({
          contentType: ContentType.TRAVEL_PLAN,
          items: travelPlans,
          nextCursor,
        });
      }

      return results;
    }),

  /**
   * Feed — content from authors the user follows, sorted by newest.
   *
   * Uses a **timestamp-based merged cursor** to paginate across multiple
   * content types in a single chronologically-sorted stream.
   *
   * Cursor format: ISO 8601 timestamp string. Each page returns items
   * published before the cursor timestamp. The client sends back the
   * `publishedAt` of the last item as the next cursor.
   *
   * Algorithm:
   *  1. Over-fetch `limit` items from each active content type,
   *     filtered by `publishedAt < cursor` (if cursor provided).
   *  2. Merge all results into a single array.
   *  3. Sort by `publishedAt DESC`.
   *  4. Slice to `limit` items.
   *  5. Return the `publishedAt` of the last item as `nextCursor`.
   *
   * Over-fetching `limit` per type guarantees we never miss items —
   * in the worst case the merged set is up to 3×limit, but we only
   * return `limit` items. The tradeoff is slightly more DB reads per
   * page, but for a feed this is acceptable and keeps the cursor
   * stateless and shareable.
   */
  feed: protectedProcedure
    .input(
      z.object({
        contentTypes: z
          .array(contentTypeSchema)
          .default(getContentTypes()),
        /** ISO 8601 timestamp cursor — items published BEFORE this timestamp. */
        cursor: z.iso.datetime().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get IDs of followed authors
      const follows = await ctx.prisma.follow.findMany({
        where: { followerId: ctx.user.id },
        select: { followingId: true },
      });

      const followedIds = follows.map((f) => f.followingId);

      if (followedIds.length === 0) {
        return { items: [], nextCursor: undefined, isEmpty: true };
      }

      const cursorDate = input.cursor ? new Date(input.cursor) : undefined;

      const baseWhere = {
        authorId: { in: followedIds },
        visibility: Visibility.PUBLIC,
        verificationStatus: VerificationStatus.VERIFIED,
        ...(cursorDate ? { publishedAt: { lt: cursorDate } } : {}),
      };

      // Over-fetch `limit` items per content type
      const fetches: Array<Promise<Array<Record<string, unknown>>>> = [];

      if (input.contentTypes.includes(ContentType.BLOG)) {
        fetches.push(
          ctx.prisma.blog
            .findMany({
              where: { ...baseWhere, publishedAt: { ...baseWhere.publishedAt, not: null } },
              orderBy: { publishedAt: "desc" },
              take: input.limit,
              select: {
                ...contentCardSelect,
                journalId: true,
              },
            })
            .then((blogs) =>
              blogs.map((b) => ({ ...b, contentType: ContentType.BLOG }))
            ) as Promise<Array<Record<string, unknown>>>
        );
      }

      if (input.contentTypes.includes(ContentType.JOURNAL)) {
        fetches.push(
          ctx.prisma.journal
            .findMany({
              where: { ...baseWhere, publishedAt: { ...baseWhere.publishedAt, not: null } },
              orderBy: { publishedAt: "desc" },
              take: input.limit,
              select: {
                ...contentCardSelect,
                blogCount: true,
              },
            })
            .then((journals) =>
              journals.map((j) => ({ ...j, contentType: ContentType.JOURNAL }))
            ) as Promise<Array<Record<string, unknown>>>
        );
      }

      if (input.contentTypes.includes(ContentType.TRAVEL_PLAN)) {
        fetches.push(
          ctx.prisma.travelPlan
            .findMany({
              where: { ...baseWhere, publishedAt: { ...baseWhere.publishedAt, not: null } },
              orderBy: { publishedAt: "desc" },
              take: input.limit,
              select: {
                ...contentCardSelect,
                season: true,
                dayCount: true,
              },
            })
            .then((plans) =>
              plans.map((p) => ({
                ...p,
                contentType: ContentType.TRAVEL_PLAN,
              }))
            ) as Promise<Array<Record<string, unknown>>>
        );
      }

      const allResults = (await Promise.all(fetches)).flat();

      // Sort merged results by publishedAt descending
      allResults.sort((a, b) => {
        const aDate = a["publishedAt"] as Date | null;
        const bDate = b["publishedAt"] as Date | null;
        return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
      });

      // Slice to requested limit
      const items = allResults.slice(0, input.limit);

      // Compute next cursor from the last item's publishedAt
      let nextCursor: string | undefined;
      if (items.length === input.limit) {
        const lastItem = items[items.length - 1];
        const lastPublished = lastItem?.["publishedAt"] as Date | null;
        if (lastPublished) {
          nextCursor = lastPublished.toISOString();
        }
      }

      return {
        items,
        nextCursor,
        isEmpty: false,
      };
    }),

  /**
   * Get liked content IDs for the authenticated user.
   * Used for toggle state hydration on the explore page.
   */
  getLikedIds: protectedProcedure.query(async ({ ctx }) => {
    const likes = await ctx.prisma.like.findMany({
      where: { userId: ctx.user.id },
      select: { blogId: true, journalId: true, travelPlanId: true },
    });
    return likes;
  }),

  /**
   * Get saved content IDs for the authenticated user.
   */
  getSavedIds: protectedProcedure.query(async ({ ctx }) => {
    const saves = await ctx.prisma.save.findMany({
      where: { userId: ctx.user.id },
      select: { blogId: true, journalId: true, travelPlanId: true },
    });
    return saves;
  }),
});
