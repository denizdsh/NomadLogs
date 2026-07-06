import { POPULARITY_MULTIPLIERS } from "./popularity.js";

/**
 * Updates comment counts and popularity score caches on Blogs, Journals, or Travel Plans.
 */
export async function updateContentCommentStats(
  tx: any,
  target: { blogId?: string | null; journalId?: string | null; travelPlanId?: string | null },
  action: "increment" | "decrement"
): Promise<void> {
  const value = action === "increment" ? 1 : -1;
  const popularityValue = action === "increment" ? POPULARITY_MULTIPLIERS.comment : -POPULARITY_MULTIPLIERS.comment;

  if (target.blogId) {
    await tx.blog.update({
      where: { id: target.blogId },
      data: {
        commentCount: { increment: value },
        popularity: { increment: popularityValue },
      },
    });
  } else if (target.journalId) {
    await tx.journal.update({
      where: { id: target.journalId },
      data: {
        commentCount: { increment: value },
        popularity: { increment: popularityValue },
      },
    });
  } else if (target.travelPlanId) {
    await tx.travelPlan.update({
      where: { id: target.travelPlanId },
      data: {
        commentCount: { increment: value },
        popularity: { increment: popularityValue },
      },
    });
  }
}
