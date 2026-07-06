import jwt from "jsonwebtoken";
import { badRequestError } from "./errors.js";
import { OAuthProvider } from "@nomadlogs/db";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  APPLE_CLIENT_ID,
  APPLE_CLIENT_SECRET,
  FACEBOOK_CLIENT_ID,
  FACEBOOK_CLIENT_SECRET,
} from "../config/constants.js";

export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

/**
 * Base utility to exchange an authorization code for an access token.
 */
async function exchangeOAuth2Code(
  code: string,
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  redirectUri?: string
): Promise<string> {
  const bodyParams: Record<string, string> = {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
  };

  if (redirectUri) {
    bodyParams["redirect_uri"] = redirectUri;
  }

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(bodyParams),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => "");
    console.error(`Token exchange error at ${tokenUrl}:`, errorText);
    throw badRequestError("Failed to exchange authorization code for access token.");
  }

  const { access_token } = (await tokenResponse.json()) as { access_token?: string };
  if (!access_token) {
    throw badRequestError("OAuth provider response did not contain an access token.");
  }

  return access_token;
}

/**
 * Base utility to fetch raw JSON user profile info using a Bearer token.
 */
async function fetchUserProfile(
  profileUrl: string,
  accessToken: string,
  headers?: Record<string, string>
): Promise<any> {
  const profileResponse = await fetch(profileUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
  });

  if (!profileResponse.ok) {
    const errorText = await profileResponse.text().catch(() => "");
    console.error(`Profile fetch error at ${profileUrl}:`, errorText);
    throw badRequestError("Failed to fetch user profile details from OAuth provider.");
  }

  return profileResponse.json();
}

/** Google OAuth Profile Resolver */
async function resolveGoogleProfile(code: string, redirectUri: string): Promise<OAuthProfile> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw badRequestError("Google OAuth credentials are not configured on this server.");
  }

  const token = await exchangeOAuth2Code(
    code,
    "https://oauth2.googleapis.com/token",
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const profile = await fetchUserProfile("https://www.googleapis.com/oauth2/v2/userinfo", token);

  return {
    providerAccountId: profile.id,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture ?? null,
  };
}

/** Facebook OAuth Profile Resolver */
async function resolveFacebookProfile(code: string, redirectUri: string): Promise<OAuthProfile> {
  if (!FACEBOOK_CLIENT_ID || !FACEBOOK_CLIENT_SECRET) {
    throw badRequestError("Facebook OAuth credentials are not configured on this server.");
  }

  const token = await exchangeOAuth2Code(
    code,
    "https://graph.facebook.com/v18.0/oauth/access_token",
    FACEBOOK_CLIENT_ID,
    FACEBOOK_CLIENT_SECRET,
    redirectUri
  );

  const profile = await fetchUserProfile(
    "https://graph.facebook.com/me?fields=id,name,email,picture.type(large)",
    token
  );

  return {
    providerAccountId: profile.id,
    email: profile.email ?? `${profile.id}@facebook.com`, // Fallback if user hides email
    name: profile.name,
    avatarUrl: profile.picture?.data?.url ?? null,
  };
}

/** GitHub OAuth Profile Resolver */
async function resolveGithubProfile(code: string): Promise<OAuthProfile> {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw badRequestError("GitHub OAuth credentials are not configured on this server.");
  }

  const token = await exchangeOAuth2Code(
    code,
    "https://github.com/login/oauth/access_token",
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET
  );

  const profile = await fetchUserProfile("https://api.github.com/user", token, {
    "User-Agent": "NomadLogs-API",
  });

  let email = profile.email;

  // GitHub user profile might not contain email if it is private.
  if (!email) {
    const emails = await fetchUserProfile("https://api.github.com/user/emails", token, {
      "User-Agent": "NomadLogs-API",
    });

    if (Array.isArray(emails)) {
      const primaryEmail = emails.find((e: any) => e.primary);
      email = primaryEmail ? primaryEmail.email : emails[0]?.email ?? null;
    }
  }

  if (!email) {
    throw badRequestError("GitHub login failed: account must have a primary email address.");
  }

  return {
    providerAccountId: String(profile.id),
    email,
    name: profile.name ?? profile.login,
    avatarUrl: profile.avatar_url ?? null,
  };
}

/** Apple OAuth Profile Resolver */
async function resolveAppleProfile(code: string, redirectUri: string): Promise<OAuthProfile> {
  if (!APPLE_CLIENT_ID || !APPLE_CLIENT_SECRET) {
    throw badRequestError("Apple OAuth credentials are not configured on this server.");
  }

  // Apple expects standard form-urlencoded parameters
  const body = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    client_secret: APPLE_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => "");
    console.error("Apple token exchange error:", errorText);
    throw badRequestError("Failed to exchange code for Apple identity token.");
  }

  const { id_token } = (await tokenResponse.json()) as { id_token?: string };
  if (!id_token) {
    throw badRequestError("Apple OAuth did not return an ID token.");
  }

  const decoded = jwt.decode(id_token) as { sub: string; email?: string } | null;
  if (!decoded || !decoded.sub) {
    throw badRequestError("Invalid Apple identity ID token.");
  }

  return {
    providerAccountId: decoded.sub,
    email: decoded.email ?? `${decoded.sub}@apple.com`, // Fallback if email hides
    name: "Apple User", // Apple only sends display name once, fallback is used
    avatarUrl: null,
  };
}

/**
 * Resolves user profile details from third-party OAuth provider.
 * Supports mock flows for local development and testing.
 */
export async function resolveOAuthProfile(
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<OAuthProfile> {
  if (code.startsWith("mock_")) {
    const parts = code.split("_");
    const identifier = parts[2] ?? "user";
    const name = identifier.charAt(0).toUpperCase() + identifier.slice(1);
    return {
      providerAccountId: `${provider.toLowerCase()}-${identifier}-id`,
      email: `${identifier}@example.com`,
      name: `${name} Travel`,
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${identifier}`,
    };
  }

  if (provider === OAuthProvider.GOOGLE) {
    return resolveGoogleProfile(code, redirectUri);
  }

  if (provider === OAuthProvider.GITHUB) {
    return resolveGithubProfile(code);
  }

  if (provider === OAuthProvider.FACEBOOK) {
    return resolveFacebookProfile(code, redirectUri);
  }

  if (provider === OAuthProvider.APPLE) {
    return resolveAppleProfile(code, redirectUri);
  }

  throw badRequestError(`${provider} OAuth client integration is not supported on this server.`);
}
