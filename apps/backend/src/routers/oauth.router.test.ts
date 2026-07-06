import { describe, it, expect, vi, beforeEach } from "vitest";
import { oauthRouter } from "./oauth.router.js";
import { prisma } from "../db.js";
import { resolveOAuthProfile } from "../utils/oauth.js";
import jwt from "jsonwebtoken";
import { FRONTEND_URL, JWT_SECRET } from "../config/constants.js";
import type { Request, Response } from "express";

// Mock the dependencies
vi.mock("../db.js", () => ({
  prisma: {
    oAuthAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("../utils/oauth.js", () => ({
  resolveOAuthProfile: vi.fn(),
}));

describe("oauthRouter", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let redirectMock: any;
  let jsonMock: any;
  let statusMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock = vi.fn();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      protocol: "http",
      get: vi.fn().mockReturnValue("localhost:4000"),
      query: {},
    };

    mockRes = {
      redirect: redirectMock,
      json: jsonMock,
      status: statusMock,
    };
  });

  describe("GET /api/auth/google/url", () => {
    it("should return the Google OAuth consent URL", () => {
      // Find the handler
      const layer = oauthRouter.stack.find(
        (s) => s.route?.path === "/api/auth/google/url"
      );
      expect(layer).toBeDefined();

      const routeStack = layer?.route?.stack;
      expect(routeStack).toBeDefined();
      const handler = routeStack?.[0]?.handle;
      expect(handler).toBeDefined();

      if (typeof handler === "function") {
        handler(mockReq as Request, mockRes as Response, () => {});
      }

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("https://accounts.google.com/o/oauth2/v2/auth"),
        })
      );
    });
  });

  describe("GET /api/auth/callback/google", () => {
    let handler: any;

    beforeEach(() => {
      const layer = oauthRouter.stack.find(
        (s) => s.route?.path === "/api/auth/callback/google"
      );
      expect(layer).toBeDefined();
      
      const routeStack = layer?.route?.stack;
      expect(routeStack).toBeDefined();
      handler = routeStack?.[0]?.handle;
      expect(handler).toBeDefined();
    });

    it("should redirect to login with error query param if error is present in query", async () => {
      mockReq.query = { error: "access_denied" };

      await handler(mockReq as Request, mockRes as Response);

      expect(redirectMock).toHaveBeenCalledWith(
        `${FRONTEND_URL}/login?error=access_denied`
      );
    });

    it("should redirect to login with error query param if code is missing", async () => {
      mockReq.query = {};

      await handler(mockReq as Request, mockRes as Response);

      expect(redirectMock).toHaveBeenCalledWith(
        `${FRONTEND_URL}/login?error=${encodeURIComponent("Missing authorization code from Google.")}`
      );
    });

    it("should login user and redirect with token if account already exists", async () => {
      mockReq.query = { code: "valid_code" };
      const mockProfile = {
        providerAccountId: "google-12345",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: "http://avatar.com/test.png",
      };
      
      vi.mocked(resolveOAuthProfile).mockResolvedValue(mockProfile);

      const mockUser = {
        id: "user-uuid-123",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: "http://avatar.com/test.png",
        role: "UNVERIFIED",
      };

      vi.mocked(prisma.oAuthAccount.findUnique).mockResolvedValue({
        id: "oauth-id",
        userId: "user-uuid-123",
        provider: "GOOGLE",
        providerAccountId: "google-12345",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
      } as any);

      await handler(mockReq as Request, mockRes as Response);

      expect(resolveOAuthProfile).toHaveBeenCalledWith(
        "GOOGLE",
        "valid_code",
        "http://localhost:4000/api/auth/callback/google"
      );

      expect(redirectMock).toHaveBeenCalledWith(
        expect.stringContaining(`${FRONTEND_URL}/auth/callback#token=`)
      );

      // Verify the generated token
      const redirectUrl = redirectMock.mock.calls[0][0];
      const token = redirectUrl.split("#token=")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      expect(decoded.userId).toBe("user-uuid-123");
    });

    it("should link account to existing user by email if oauth account does not exist", async () => {
      mockReq.query = { code: "valid_code" };
      const mockProfile = {
        providerAccountId: "google-12345",
        email: "existing@example.com",
        name: "Existing User",
        avatarUrl: "http://avatar.com/existing.png",
      };

      vi.mocked(resolveOAuthProfile).mockResolvedValue(mockProfile);
      vi.mocked(prisma.oAuthAccount.findUnique).mockResolvedValue(null);

      const mockUser = {
        id: "user-existing-uuid",
        email: "existing@example.com",
        name: "Existing User",
        role: "VERIFIED",
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      await handler(mockReq as Request, mockRes as Response);

      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: {
          userId: "user-existing-uuid",
          provider: "GOOGLE",
          providerAccountId: "google-12345",
        },
      });

      expect(redirectMock).toHaveBeenCalledWith(
        expect.stringContaining(`${FRONTEND_URL}/auth/callback#token=`)
      );
    });

    it("should create a new user and link oauth account if neither exist", async () => {
      mockReq.query = { code: "valid_code" };
      const mockProfile = {
        providerAccountId: "google-12345",
        email: "newuser@example.com",
        name: "New User",
        avatarUrl: "http://avatar.com/new.png",
      };

      vi.mocked(resolveOAuthProfile).mockResolvedValue(mockProfile);
      vi.mocked(prisma.oAuthAccount.findUnique).mockResolvedValue(null);
      
      // User with email and display name does not exist
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const createdUser = {
        id: "new-user-uuid",
        email: "newuser@example.com",
        name: "New User",
        avatarUrl: "http://avatar.com/new.png",
        role: "UNVERIFIED",
      };
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser as any);

      await handler(mockReq as Request, mockRes as Response);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "newuser@example.com",
          name: "New User",
          avatarUrl: "http://avatar.com/new.png",
          role: "UNVERIFIED",
        },
      });

      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: {
          userId: "new-user-uuid",
          provider: "GOOGLE",
          providerAccountId: "google-12345",
        },
      });

      expect(redirectMock).toHaveBeenCalledWith(
        expect.stringContaining(`${FRONTEND_URL}/auth/callback#token=`)
      );
    });
  });
});
