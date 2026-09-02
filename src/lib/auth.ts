import { randomUUID } from 'node:crypto';

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { magicLink, organization, twoFactor } from 'better-auth/plugins';
import {
  adminAc,
  defaultAc,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access';

import { env, isProduction, serverAppUrl } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * Better Auth instance — see docs/architecture/decisions/ADR-0001-better-auth.md.
 *
 * This module is the ONLY place the library is configured. Application code depends
 * on the helpers in src/server/auth-context.ts, never on this export directly, so
 * that replacing the library touches one file rather than the whole codebase
 * (ARCHITECTURE_RULES.md §13).
 */

/**
 * Social providers are configured only when their credentials are present. An
 * unconfigured provider must not break the app or the test suite — it simply does
 * not appear on the sign-in screen.
 */
function socialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers['google'] = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers['github'] = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }

  return providers;
}

const viewerAc = defaultAc.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ['read'],
});

export const auth = betterAuth({
  appName: 'WhatsApp AI Receptionist',
  baseURL: serverAppUrl,
  secret: env.AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    // Single-use, one hour. SECURITY_RULES.md → reset tokens.
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your password',
        body: `Reset your password using this link. It expires in one hour and can be used once.\n\n${url}`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        body: `Confirm your email address to finish setting up your account.\n\n${url}`,
      });
    },
  },

  socialProviders: socialProviders(),

  session: {
    // Database-backed, not stateless: revocation must be immediate (ADR-0001).
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      // Tenant selectors and revocation are database-backed security state. A
      // cached session would keep an old organization/branch (or revoked login)
      // authoritative until cache expiry.
      enabled: false,
    },
  },

  /**
   * Per-IP rate limiting on /api/auth/*, configured explicitly rather than left to
   * the library's defaults. Storage is in-memory, so it is per-process and resets on
   * deploy — the same limitation as src/lib/rate-limit.ts, and resolved the same way
   * in Milestone 24 when Redis lands.
   */
  rateLimit: {
    enabled: true,
    window: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: env.AUTH_RATE_LIMIT_MAX,
    /**
     * Better Auth ships stricter built-in rules for credential paths (3 per 10s)
     * which the global `max` above does NOT override. Restating them here makes the
     * real limit visible in our own code — an invisible default is one nobody
     * reviews, and it silently shaped test behaviour before it was found.
     */
    customRules: {
      '/sign-in/email': { window: 10, max: env.AUTH_CREDENTIAL_RATE_LIMIT_MAX },
      '/sign-up/email': { window: 10, max: env.AUTH_CREDENTIAL_RATE_LIMIT_MAX },
      '/change-password': { window: 10, max: env.AUTH_CREDENTIAL_RATE_LIMIT_MAX },
      '/change-email': { window: 10, max: env.AUTH_CREDENTIAL_RATE_LIMIT_MAX },
    },
  },

  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
    },
    database: {
      /**
       * Better Auth generates nanoid-style ids by default ("RcwvRt61U2kt…"), which
       * Postgres rejects for our `@db.Uuid` columns. Generating real UUIDs here keeps
       * the native uuid type — smaller than text, and indexed properly — rather than
       * widening every primary key to text to accommodate the library.
       */
      generateId: () => randomUUID(),
    },
  },

  plugins: [
    organization({
      // A user may belong to several organizations with a different role in each.
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 200,
      creatorRole: 'owner',
      roles: { owner: ownerAc, admin: adminAc, member: memberAc, viewer: viewerAc },
      invitationExpiresIn: 60 * 60 * 48,
      sendInvitationEmail: async ({ email, organization: org, inviter, id }) => {
        await sendEmail({
          to: email,
          subject: `You have been invited to join ${org.name}`,
          body: `${inviter.user.name ?? 'A colleague'} invited you to join ${org.name}.\n\n${serverAppUrl}/accept-invitation/${id}`,
        });
      },
    }),

    twoFactor({
      issuer: 'WhatsApp AI Receptionist',
      // 10 single-use codes, shown exactly once at enrolment.
      backupCodeOptions: { amount: 10, length: 10 },
    }),

    magicLink({
      // Short-lived and single-use. SECURITY_RULES.md → magic links.
      expiresIn: 60 * 15,
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: 'Your sign-in link',
          body: `Sign in using this link. It expires in 15 minutes and can be used once.\n\n${url}`,
        });
      },
    }),

    // NOTE: the `admin` plugin governs PLATFORM-level administrators (impersonation,
    // cross-tenant user management). That is Milestone 22 (Admin Portal), not this
    // milestone. Organization roles come from the `organization` plugin above.

    // Must be last: bridges Better Auth's cookie handling into Next's cookie API.
    nextCookies(),
  ],

  onAPIError: {
    onError: (error) => {
      // Never log credentials or tokens — the logger's redaction paths cover the
      // known fields, but auth errors are logged deliberately terse regardless.
      logger.warn(
        { err: error instanceof Error ? error.message : 'unknown' },
        'auth api error',
      );
    },
  },
});

export type Auth = typeof auth;
