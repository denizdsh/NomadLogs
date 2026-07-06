/**
 * Cron jobs — scheduled cleanup tasks.
 *
 * Uses node-cron to run nightly at 02:00 UTC:
 *
 * 1. **Notification cleanup:**
 *    - DELETE read notifications older than 7 days
 *    - DELETE unread notifications older than 30 days
 *
 * 2. **Chat cleanup:**
 *    - DELETE inactive chats (no new messages) older than 30 days
 *
 * Per APP-SPECIFICATIONS.md.
 */
import cron from "node-cron";
import { prisma } from "../db.js";

/**
 * Clean up stale notifications.
 */
async function cleanNotifications(): Promise<void> {
  const now = new Date();

  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const oneMonthAgo = new Date(now);
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const [readDeleted, unreadDeleted] = await Promise.all([
    // Delete read notifications older than 1 week
    prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: oneWeekAgo },
      },
    }),
    // Delete unread notifications older than 1 month
    prisma.notification.deleteMany({
      where: {
        isRead: false,
        createdAt: { lt: oneMonthAgo },
      },
    }),
  ]);

  console.log(
    `[cron:notifications] Cleaned ${readDeleted.count} read (>7d) + ${unreadDeleted.count} unread (>30d) notifications.`
  );
}

/**
 * Clean up inactive pending content chats.
 *
 * A chat is "inactive" if its lastMessageAt (or createdAt, if no messages
 * were ever sent) is older than 30 days.
 */
async function cleanInactiveChats(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deleted = await prisma.pendingContentChat.deleteMany({
    where: {
      OR: [
        // Chats with messages but inactive for 30 days
        {
          lastMessageAt: { not: null, lt: thirtyDaysAgo },
        },
        // Chats that never received a message and were created 30+ days ago
        {
          lastMessageAt: null,
          createdAt: { lt: thirtyDaysAgo },
        },
      ],
    },
  });

  console.log(
    `[cron:chats] Cleaned ${deleted.count} inactive chats (>30d no activity).`
  );
}

/**
 * Run a task wrapped inside a PostgreSQL advisory lock to ensure single execution.
 */
async function runWithAdvisoryLock(lockId: number, task: () => Promise<void>): Promise<void> {
  try {
    // pg_try_advisory_lock returns true if the lock was successfully acquired
    const lockResult = await prisma.$queryRaw<any[]>`
      SELECT pg_try_advisory_lock(${lockId}) AS acquired
    `;
    const acquired = !!lockResult[0]?.acquired;

    if (!acquired) {
      console.log(`[cron] Lock ${lockId} busy. Task execution skipped on this instance.`);
      return;
    }

    console.log(`[cron] Lock ${lockId} acquired successfully. Executing task...`);
    await task();
  } catch (error) {
    console.error(`[cron] Advisory lock manager error for lock ${lockId}:`, error);
  } finally {
    try {
      await prisma.$queryRaw`
        SELECT pg_advisory_unlock(${lockId})
      `;
      console.log(`[cron] Released advisory lock ${lockId}.`);
    } catch (error) {
      console.error(`[cron] Failed to release advisory lock ${lockId}:`, error);
    }
  }
}

/**
 * Register all cron jobs.
 *
 * Call this once during server startup. Jobs run nightly at 02:00 UTC.
 */
export function registerCronJobs(): void {
  // Run nightly at 02:00 UTC
  cron.schedule(
    "0 2 * * *",
    async () => {
      console.log(`[cron] Running nightly cleanup trigger at ${new Date().toISOString()}...`);

      // Use lock ID 1001 for nightly cleanups
      await runWithAdvisoryLock(1001, async () => {
        try {
          await cleanNotifications();
        } catch (error) {
          console.error("[cron:notifications] Cleanup failed:", error);
        }

        try {
          await cleanInactiveChats();
        } catch (error) {
          console.error("[cron:chats] Cleanup failed:", error);
        }

        console.log("[cron] Nightly cleanup logic finished.");
      });

      console.log("[cron] Nightly cleanup process complete.");
    },
    {
      timezone: "UTC",
    }
  );

  console.log("📅 Cron jobs registered (nightly at 02:00 UTC with advisory locking).");
}
