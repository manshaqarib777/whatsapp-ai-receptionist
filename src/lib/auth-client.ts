'use client';

import { createAuthClient } from 'better-auth/react';
import {
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from 'better-auth/client/plugins';

/**
 * Browser-side auth client.
 *
 * Plugin list must mirror src/lib/auth.ts — a plugin present on the server but
 * absent here simply has no client methods, which fails at runtime rather than at
 * compile time.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient(), twoFactorClient(), magicLinkClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  organization,
  twoFactor,
} = authClient;
