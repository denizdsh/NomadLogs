/**
 * tRPC middleware definitions.
 *
 * Provides reusable middleware for authentication and role-based access.
 * Each middleware builds on the previous, narrowing the context type.
 */
import { UserRole } from "@nomadlogs/db";
import { unauthorizedError, forbiddenError } from "../utils/errors.js";
import { middleware, publicProcedure } from "./init.js";

// ---------------------------------------------------------------------------
// Auth middleware — ensures `ctx.user` is non-null
// ---------------------------------------------------------------------------
const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw unauthorizedError("You must be logged in to perform this action.");
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * Protected procedure — requires a logged-in user.
 *
 * Downstream resolvers receive `ctx.user` typed as `User` (non-nullable).
 */
export const protectedProcedure = publicProcedure.use(isAuthenticated);

// ---------------------------------------------------------------------------
// Role hierarchy helpers
// ---------------------------------------------------------------------------

/** Ordered list of roles from least to most privileged. */
const ROLE_HIERARCHY: readonly UserRole[] = [
  UserRole.UNVERIFIED,
  UserRole.TEMP_UNVERIFIED,
  UserRole.SUSPENDED,
  UserRole.BANNED,
  UserRole.VERIFIED,
  UserRole.TEMP_VERIFIED,
  UserRole.EDITOR,
  UserRole.ADMIN,
] as const;

function roleIndex(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Returns true if `actual` role is at least as privileged as `required`.
 * Special cases: SUSPENDED and BANNED are never "at least" anything above them.
 */
export function hasMinimumRole(actual: UserRole, required: UserRole): boolean {
  // SUSPENDED and BANNED users have restricted access regardless of hierarchy position
  if (actual === UserRole.SUSPENDED || actual === UserRole.BANNED) {
    return required === actual;
  }
  return roleIndex(actual) >= roleIndex(required);
}

// ---------------------------------------------------------------------------
// Role-gated middleware factory
// ---------------------------------------------------------------------------

function requireRole(minimumRole: UserRole) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw unauthorizedError("You must be logged in to perform this action.");
    }
    if (!hasMinimumRole(ctx.user.role, minimumRole)) {
      throw forbiddenError(`This action requires at least the "${minimumRole}" role.`);
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

/**
 * Verified procedure — user must be VERIFIED, TEMP_VERIFIED, EDITOR, or ADMIN.
 *
 * Used for content creation and mutations that require a trusted author.
 */
export const verifiedProcedure = publicProcedure.use(requireRole(UserRole.VERIFIED));

/**
 * Editor procedure — user must be EDITOR or ADMIN.
 *
 * Used for content moderation: verifying posts, managing user roles,
 * starting pending content chats, etc.
 */
export const editorProcedure = publicProcedure.use(requireRole(UserRole.EDITOR));

/**
 * Admin procedure — user must be ADMIN.
 *
 * Used for system-level operations.
 */
export const adminProcedure = publicProcedure.use(requireRole(UserRole.ADMIN));
