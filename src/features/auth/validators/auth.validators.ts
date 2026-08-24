import { z } from 'zod';

import { ROLES } from '@/features/auth/permissions';

/**
 * Shared validation schemas.
 *
 * One source of truth for client and server (CODING_STANDARDS.md): the same schema
 * drives the form and the route handler, so a rule cannot drift between them.
 */

/**
 * Password policy.
 *
 * 12 characters minimum. Length dominates complexity for resistance to offline
 * cracking, so this deliberately does not demand a symbol-and-digit ceremony that
 * pushes users toward `Password1!` and a sticky note.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use no more than 128 characters.');

export const emailSchema = z
  .string()
  .min(1, 'Enter your email address.')
  .email('Enter a valid email address.')
  // Normalising prevents duplicate accounts differing only by case.
  .transform((value) => value.trim().toLowerCase());

export const nameSchema = z
  .string()
  .min(1, 'Enter your name.')
  .max(100, 'Use no more than 100 characters.')
  .transform((value) => value.trim());

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  // Not `passwordSchema`: an existing password set under an older policy must still
  // be accepted at sign-in. Validating length here would lock those users out.
  password: z.string().min(1, 'Enter your password.'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export const twoFactorCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});

export const backupCodeSchema = z.object({
  code: z.string().trim().min(1, 'Enter a backup code.'),
});

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Use at least 2 characters.')
    .max(80, 'Use no more than 80 characters.')
    .transform((value) => value.trim()),
  slug: z
    .string()
    .min(2, 'Use at least 2 characters.')
    .max(48, 'Use no more than 48 characters.')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Use lowercase letters, numbers, and single hyphens.',
    )
    .optional(),
});

export const switchOrganizationSchema = z.object({
  organizationId: z.string().uuid('Invalid organization.'),
});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  // `owner` is excluded: ownership transfers through a dedicated flow, never by
  // inviting someone as owner (permissions.ts → canAssignRole).
  role: z.enum(['admin', 'member', 'viewer']),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(ROLES),
});

export const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid('Invalid audit-log cursor.').optional(),
});

/** Derives a URL-safe slug from an organization name. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      // Strip diacritics so "Café" becomes "cafe" rather than losing the letter.
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
  );
}
