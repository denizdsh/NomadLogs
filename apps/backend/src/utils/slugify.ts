/**
 * Slug utility — generates URL-friendly slugs from titles.
 *
 * Ensures uniqueness by appending a numeric suffix when collisions are detected.
 */
import type { PrismaClient } from "@nomadlogs/db";

/**
 * Convert a title to a URL-friendly slug and ensure it's unique
 * across blogs, journals, and travel plans.
 */
export async function slugify(
  title: string,
  prisma: PrismaClient
): Promise<string> {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/-+/g, "-") // Collapse consecutive hyphens
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing hyphens

  let slug = base;
  let suffix = 0;

  // Check uniqueness across all content types
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;

    const [blog, journal, travelPlan] = await Promise.all([
      prisma.blog.findUnique({ where: { slug: candidate }, select: { id: true } }),
      prisma.journal.findUnique({ where: { slug: candidate }, select: { id: true } }),
      prisma.travelPlan.findUnique({ where: { slug: candidate }, select: { id: true } }),
    ]);

    if (!blog && !journal && !travelPlan) {
      return candidate;
    }

    suffix++;
  }
}
