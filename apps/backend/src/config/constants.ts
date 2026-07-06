/**
 * Application configuration and constants.
 * Centralizes environment variable reading, parsing, validation, and defaults.
 */
import "dotenv/config";

export const NODE_ENV = process.env["NODE_ENV"] ?? "development";
export const IS_PROD = NODE_ENV === "production";

// Server Port
export const PORT = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 4000;

// Frontend URL for CORS configuration
export const FRONTEND_URL = process.env["FRONTEND_URL"] ?? "http://localhost:5173";

// JWT Secret - required in production, fallback for development
const rawJwtSecret = process.env["JWT_SECRET"];
if (IS_PROD && !rawJwtSecret) {
  throw new Error("JWT_SECRET environment variable must be set in production.");
}
export const JWT_SECRET = rawJwtSecret ?? "super-secret-key-nomadlogs-2026";

// Database URL - always required
const rawDatabaseUrl = process.env["DATABASE_URL"];
if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL environment variable is required.");
}
export const DATABASE_URL = rawDatabaseUrl;

// Cloudflare R2 / S3 Storage Credentials
export const R2_BUCKET = process.env["R2_BUCKET"] ?? "";
export const R2_ACCOUNT_ID = process.env["R2_ACCOUNT_ID"] ?? "";
export const R2_ACCESS_KEY_ID = process.env["R2_ACCESS_KEY_ID"] ?? "";
export const R2_SECRET_ACCESS_KEY = process.env["R2_SECRET_ACCESS_KEY"] ?? "";
export const R2_PUBLIC_URL = process.env["R2_PUBLIC_URL"] ?? "";

export const IS_R2_CONFIGURED = !!(
  R2_BUCKET &&
  R2_ACCOUNT_ID &&
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY
);

// Redis Configuration for Pub/Sub SSE and Distributed Locking
export const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

// OAuth Credentials (loaded from environment variables)
export const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] ?? "";
export const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
export const GITHUB_CLIENT_ID = process.env["GITHUB_CLIENT_ID"] ?? "";
export const GITHUB_CLIENT_SECRET = process.env["GITHUB_CLIENT_SECRET"] ?? "";
export const APPLE_CLIENT_ID = process.env["APPLE_CLIENT_ID"] ?? "";
export const APPLE_CLIENT_SECRET = process.env["APPLE_CLIENT_SECRET"] ?? "";
export const FACEBOOK_CLIENT_ID = process.env["FACEBOOK_CLIENT_ID"] ?? "";
export const FACEBOOK_CLIENT_SECRET = process.env["FACEBOOK_CLIENT_SECRET"] ?? "";

