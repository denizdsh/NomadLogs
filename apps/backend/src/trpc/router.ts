/**
 * Root tRPC router — merges all domain routers into the appRouter.
 *
 * This is the single entrypoint that the Express adapter mounts.
 * The `AppRouter` type is exported for client-side type inference.
 */
import { router } from "./init.js";
import { authRouter } from "../routers/auth.router.js";
import { userRouter } from "../routers/user.router.js";
import { blogRouter } from "../routers/blog.router.js";
import { journalRouter } from "../routers/journal.router.js";
import { travelPlanRouter } from "../routers/travelPlan.router.js";
import { commentRouter } from "../routers/comment.router.js";
import { exploreRouter } from "../routers/explore.router.js";
import { notificationRouter } from "../routers/notification.router.js";
import { chatRouter } from "../routers/chat.router.js";
import { tagRouter } from "../routers/tag.router.js";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  blog: blogRouter,
  journal: journalRouter,
  travelPlan: travelPlanRouter,
  comment: commentRouter,
  explore: exploreRouter,
  notification: notificationRouter,
  chat: chatRouter,
  tag: tagRouter,
});

/** Type export for client-side tRPC type inference. */
export type AppRouter = typeof appRouter;
