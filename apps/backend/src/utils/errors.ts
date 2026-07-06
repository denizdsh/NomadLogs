import { TRPCError } from "@trpc/server";

/**
 * Standard factory for Not Found (404) tRPC errors.
 */
export function notFoundError(entityName?: string): TRPCError {
  return new TRPCError({
    code: "NOT_FOUND",
    message: entityName ? `${entityName} not found.` : "Resource not found.",
  });
}

/**
 * Standard factory for Forbidden (403) Access Denied tRPC errors.
 */
export function forbiddenError(message = "Access denied. You do not have permission to perform this action."): TRPCError {
  return new TRPCError({
    code: "FORBIDDEN",
    message,
  });
}

/**
 * Standard factory for Bad Request (400) tRPC errors.
 */
export function badRequestError(message: string): TRPCError {
  return new TRPCError({
    code: "BAD_REQUEST",
    message,
  });
}

/**
 * Standard factory for Unauthorized (401) tRPC errors.
 */
export function unauthorizedError(message = "Authentication required. Please log in."): TRPCError {
  return new TRPCError({
    code: "UNAUTHORIZED",
    message,
  });
}
