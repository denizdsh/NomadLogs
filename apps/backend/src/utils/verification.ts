import { type PrismaClient, UserRole, VerificationStatus, Visibility } from "@nomadlogs/db";
import { hasMinimumRole } from "../trpc/middleware.js";

/**
 * Updates the author's verified post count cache and auto-promotes the author
 * to a VERIFIED role if their verified post count reaches 2.
 */
export async function updateAuthorPostCountAndRole(
  tx: Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
  >,
  authorId: string,
  oldStatus: VerificationStatus,
  newStatus: VerificationStatus
): Promise<void> {
  if (
    oldStatus !== VerificationStatus.VERIFIED &&
    newStatus === VerificationStatus.VERIFIED
  ) {
    const author = await tx.user.update({
      where: { id: authorId },
      data: { verifiedPostCount: { increment: 1 } },
    });

    if (
      author.verifiedPostCount >= 2 &&
      author.role === UserRole.UNVERIFIED
    ) {
      await tx.user.update({
        where: { id: authorId },
        data: { role: UserRole.VERIFIED },
      });
    }
  } else if (
    oldStatus === VerificationStatus.VERIFIED &&
    newStatus !== VerificationStatus.VERIFIED
  ) {
    await tx.user.update({
      where: { id: authorId },
      data: { verifiedPostCount: { decrement: 1 } },
    });
  }
}

/**
 * Determines the new verification status when visibility changes from private.
 */
export function determineVerificationStatus(
  currentStatus: VerificationStatus,
  currentVisibility: Visibility,
  newVisibility: Visibility,
  authorRole: UserRole
): VerificationStatus {
  if (
    currentVisibility === Visibility.PRIVATE &&
    newVisibility !== Visibility.PRIVATE
  ) {
    const authorIsVerified = hasMinimumRole(authorRole, UserRole.VERIFIED);
    return authorIsVerified ? VerificationStatus.VERIFIED : VerificationStatus.PENDING;
  }
  return currentStatus;
}
