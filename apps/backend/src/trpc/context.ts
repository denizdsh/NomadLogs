/**
 * tRPC context factory.
 *
 * The context is created fresh for every incoming request and provides
 * the Prisma client plus the authenticated user (if any) to all
 * procedures.
 *
 * Authentication details are extracted from the request here.
 * The actual session/token verification is a placeholder until
 * the auth layer (OAuth) is implemented.
 */
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "@nomadlogs/db";
import { prisma } from "../db.js";
import { getUserIdFromHeaders } from "../utils/auth.js";

export interface Context {
  prisma: typeof prisma;
  user: User | null;
  /** Raw IP for anonymous content-view deduplication */
  ipAddress: string | null;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<Context> {
  const { req } = opts;

  const userId = getUserIdFromHeaders(req.headers);

  let user: User | null = null;
  if (userId) {
    user = await prisma.user.findUnique({ where: { id: userId } });
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ipAddress =
    (typeof forwarded === "string" ? forwarded.split(",")[0] : undefined) ??
    req.socket.remoteAddress ??
    null;

  return { prisma, user, ipAddress };
}
