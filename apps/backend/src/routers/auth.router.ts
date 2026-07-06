/**
 * Auth router — OAuth authentication and provider management.
 *
 * Handles OAuth callback processing, session management,
 * and linking/unlinking of OAuth providers.
 */
import { z } from "zod";

import { router, publicProcedure } from "../trpc/init.js";
import { protectedProcedure } from "../trpc/middleware.js";
import { oauthProviderSchema } from "../utils/enums.js";
import { badRequestError } from "../utils/errors.js";
import { UserRole, OAuthProvider } from "@nomadlogs/db";

import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/constants.js";
import { resolveOAuthProfile } from "../utils/oauth.js";

export const authRouter = router({
  /**
   * Process an OAuth callback.
   *
   * Called after the frontend completes an OAuth flow. The frontend sends
   * the provider + the code/token received from the OAuth provider.
   * The backend verifies the token, resolves the user's email, and either
   * finds/creates a user or links the provider to an existing account.
   */
  oauthCallback: publicProcedure
    .input(
      z.object({
        provider: oauthProviderSchema,
        code: z.string().min(1),
        /** The redirect URI used during the OAuth flow, for token exchange */
        redirectUri: z.url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await resolveOAuthProfile(input.provider, input.code, input.redirectUri);

      let oauthAccount = await ctx.prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: input.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
        include: { user: true },
      });

      let user = oauthAccount?.user ?? null;

      if (!user) {
        // Search if user with matching email already exists
        const existingUser = await ctx.prisma.user.findUnique({
          where: { email: profile.email },
        });

        if (existingUser) {
          // Auto-link provider
          user = existingUser;
          await ctx.prisma.oAuthAccount.create({
            data: {
              userId: user.id,
              provider: input.provider,
              providerAccountId: profile.providerAccountId,
            },
          });
        } else {
          // Create new user profile + link
          // We ensure display name is unique by checking if it exists and appending random if necessary
          let baseName = profile.name;
          let isUnique = false;
          let suffix = 0;
          let finalName = baseName;

          while (!isUnique) {
            const checkName = suffix === 0 ? baseName : `${baseName}${suffix}`;
            const existingNameUser = await ctx.prisma.user.findUnique({
              where: { name: checkName },
            });
            if (!existingNameUser) {
              finalName = checkName;
              isUnique = true;
            } else {
              suffix++;
            }
          }

          user = await ctx.prisma.user.create({
            data: {
              email: profile.email,
              name: finalName,
              avatarUrl: profile.avatarUrl,
              role: UserRole.UNVERIFIED,
            },
          });

          await ctx.prisma.oAuthAccount.create({
            data: {
              userId: user.id,
              provider: input.provider,
              providerAccountId: profile.providerAccountId,
            },
          });
        }
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

      return { token, user };
    }),

  /**
   * Get current session info.
   */
  getSession: publicProcedure.query(({ ctx }) => {
    return { user: ctx.user };
  }),

  /**
   * Link an additional OAuth provider to the authenticated user.
   */
  linkProvider: protectedProcedure
    .input(
      z.object({
        provider: oauthProviderSchema,
        code: z.string().min(1),
        redirectUri: z.url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await resolveOAuthProfile(input.provider, input.code, input.redirectUri);

      // Verify email matches the logged-in user's email
      if (profile.email !== ctx.user.email) {
        throw badRequestError(`The email of the ${input.provider} account (${profile.email}) does not match your profile email (${ctx.user.email}).`);
      }

      // Check if provider is already linked to anyone
      const existingAccount = await ctx.prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: input.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
      });

      if (existingAccount) {
        throw badRequestError(`This ${input.provider} account is already linked to another user.`);
      }

      // Check if user already has this provider linked
      const userHasProvider = await ctx.prisma.oAuthAccount.findUnique({
        where: {
          userId_provider: {
            userId: ctx.user.id,
            provider: input.provider,
          },
        },
      });

      if (userHasProvider) {
        throw badRequestError(`You have already linked a ${input.provider} account.`);
      }

      // Link the account
      await ctx.prisma.oAuthAccount.create({
        data: {
          userId: ctx.user.id,
          provider: input.provider,
          providerAccountId: profile.providerAccountId,
        },
      });

      return { success: true };
    }),

  /**
   * Unlink an OAuth provider from the authenticated user.
   * Prevents unlinking the last remaining provider.
   */
  unlinkProvider: protectedProcedure
    .input(
      z.object({
        provider: oauthProviderSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.prisma.oAuthAccount.count({
        where: { userId: ctx.user.id },
      });

      if (count <= 1) {
        throw badRequestError("Cannot unlink your only OAuth provider. Link another provider first.");
      }

      await ctx.prisma.oAuthAccount.deleteMany({
        where: { userId: ctx.user.id, provider: input.provider },
      });

      return { success: true };
    }),

  /**
   * List OAuth providers linked to the authenticated user.
   */
  getLinkedProviders: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.prisma.oAuthAccount.findMany({
      where: { userId: ctx.user.id },
      select: { provider: true, createdAt: true },
    });
    return accounts;
  }),
});
