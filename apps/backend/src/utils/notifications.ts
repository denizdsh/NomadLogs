import type { PrismaClient } from "@nomadlogs/db";

/**
 * Notifies all followers of an author when they publish new public content.
 */
export async function notifyFollowers(
  prisma: any,
  authorId: string,
  authorName: string,
  contentType: "BLOG" | "JOURNAL" | "TRAVEL_PLAN",
  contentTitle: string,
  linkUrl: string
): Promise<void> {
  const followers = await prisma.follow.findMany({
    where: { followingId: authorId },
    select: { followerId: true },
  });

  if (followers.length === 0) return;

  const typeLabels = {
    BLOG: "blog",
    JOURNAL: "journal",
    TRAVEL_PLAN: "travel plan",
  };

  // Create notifications in bulk using createMany
  await prisma.notification.createMany({
    data: followers.map((f: { followerId: string }) => ({
      recipientId: f.followerId,
      type: "NEW_CONTENT",
      message: `${authorName} published a new ${typeLabels[contentType]}: "${contentTitle}".`,
      linkUrl,
      actorId: authorId,
    })),
  });
}
