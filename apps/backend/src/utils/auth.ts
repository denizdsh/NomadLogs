import jwt from "jsonwebtoken";
import type { IncomingHttpHeaders } from "http";
import { JWT_SECRET, IS_PROD } from "../config/constants.js";

/**
 * Extracts and verifies the user ID from the request headers.
 * Supports Bearer tokens in the Authorization header and fallback to x-user-id header.
 */
export function getUserIdFromHeaders(
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>
): string | null {
  const authHeader = headers["authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return decoded.userId;
    } catch (err) {
      // Token is invalid or expired
    }
  }

  // Fallback to x-user-id header for debugging/testing/integration checks (development/testing only)
  if (!IS_PROD) {
    const xUserId = headers["x-user-id"];
    if (typeof xUserId === "string") {
      return xUserId;
    }
  }

  return null;
}
