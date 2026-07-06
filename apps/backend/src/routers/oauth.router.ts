/**
 * OAuth Express router — standard HTTP endpoints for OAuth flows.
 *
 * Exposes redirect-based OAuth endpoints that work with provider callbacks,
 * bypassing tRPC (which cannot handle HTTP redirects).
 *
 * Endpoints:
 *  - GET /api/auth/google/url    → Returns the Google consent screen URL
 *  - GET /api/auth/callback/google → Handles Google's redirect callback
 */
import { Router, type Request } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { resolveOAuthProfile } from "../utils/oauth.js";
import {
  GOOGLE_CLIENT_ID,
  JWT_SECRET,
  FRONTEND_URL,
} from "../config/constants.js";
import { OAuthProvider, UserRole } from "@nomadlogs/db";

const oauthRouter = Router();

/** The redirect URI that Google will call back into. */
function getGoogleRedirectUri(req: Request): string {
  // In production, derive from the Host header; in dev, hardcode to localhost
  const protocol = req.protocol;
  const host = req.get("host") ?? "localhost:4000";
  return `${protocol}://${host}/api/auth/callback/google`;
}

/**
 * GET /api/auth/google/url
 *
 * Returns JSON with the Google OAuth consent URL.
 * The frontend redirects the user's browser to this URL.
 */
oauthRouter.get("/api/auth/google/url", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: "Google OAuth is not configured on this server." });
    return;
  }

  const redirectUri = getGoogleRedirectUri(req);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.json({ url });
});

/**
 * GET /api/auth/callback/google
 *
 * Google redirects back to this endpoint with `?code=...`.
 * We exchange the code for an access token, resolve the user profile,
 * create or find the user, issue a JWT, and redirect the browser
 * back to the frontend with the token in the URL hash fragment.
 */
oauthRouter.get("/api/auth/callback/google", async (req, res) => {
  try {
    const code = req.query["code"];
    const error = req.query["error"];

    if (error) {
      console.error("Google OAuth error:", error);
      res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || typeof code !== "string") {
      res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent("Missing authorization code from Google.")}`);
      return;
    }

    const redirectUri = getGoogleRedirectUri(req);
    const profile = await resolveOAuthProfile(OAuthProvider.GOOGLE, code, redirectUri);

    // Find or create user (mirrors the tRPC oauthCallback logic)
    let oauthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: OAuthProvider.GOOGLE,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    let user = oauthAccount?.user ?? null;

    if (!user) {
      // Check if a user with the same email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (existingUser) {
        // Auto-link this Google account to the existing user
        user = existingUser;
        await prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: OAuthProvider.GOOGLE,
            providerAccountId: profile.providerAccountId,
          },
        });
      } else {
        // Create a brand new user with a unique display name
        let baseName = profile.name;
        let isUnique = false;
        let suffix = 0;
        let finalName = baseName;

        while (!isUnique) {
          const checkName = suffix === 0 ? baseName : `${baseName}${suffix}`;
          const existingNameUser = await prisma.user.findUnique({
            where: { name: checkName },
          });
          if (!existingNameUser) {
            finalName = checkName;
            isUnique = true;
          } else {
            suffix++;
          }
        }

        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: finalName,
            avatarUrl: profile.avatarUrl,
            role: UserRole.UNVERIFIED,
          },
        });

        await prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: OAuthProvider.GOOGLE,
            providerAccountId: profile.providerAccountId,
          },
        });
      }
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

    // Redirect to the frontend callback page with the token in the hash
    // Using hash fragment prevents the token from being sent to the server in subsequent requests
    res.redirect(`${FRONTEND_URL}/auth/callback#token=${token}`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    const errorMessage = err instanceof Error ? err.message : "Authentication failed.";
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(errorMessage)}`);
  }
});

export { oauthRouter };
