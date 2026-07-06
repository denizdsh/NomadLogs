import type { Request, Response, NextFunction } from "express";
import type { User } from "@nomadlogs/db";
import { prisma } from "../db.js";
import { getUserIdFromHeaders } from "../utils/auth.js";

/**
 * Custom Request interface containing authenticated user data.
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: User;
}

/**
 * Middleware that extracts and resolves the user ID and user object from request headers,
 * attaching them to the request object. Does not block unauthenticated requests.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  let userId = getUserIdFromHeaders(req.headers);
  
  // Extract token from query param (needed for native SSE EventSource)
  if (!userId && req.query && typeof req.query.token === "string") {
    try {
      const jwt = await import("jsonwebtoken");
      const { JWT_SECRET } = await import("../config/constants.js");
      const decoded = jwt.default.verify(req.query.token, JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch (err) {}
  }

  if (userId) {
    req.userId = userId;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (user) {
        req.user = user;
      }
    } catch (error) {
      console.error("Auth middleware error fetching user:", error);
    }
  }
  next();
}

/**
 * Middleware that requires the request to be authenticated.
 * Returns 401 Unauthorized if no valid user is resolved.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.userId || !req.user) {
    res.status(401).json({ error: "Unauthorized. Authentication required." });
    return;
  }
  next();
}
