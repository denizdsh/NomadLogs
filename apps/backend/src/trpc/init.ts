/**
 * tRPC initialisation — single `t` instance.
 *
 * Import from here whenever you need `router`, `procedure`,
 * or `middleware`. Never call `initTRPC.create()` elsewhere.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

/**
 * Public (unauthenticated) procedure.
 *
 * Accessible to everyone — guests and authenticated users.
 */
export const publicProcedure = t.procedure;

export const router = t.router;
export const middleware = t.middleware;
