import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';

/**
 * Better Auth handler — mounts sign-in, sign-up, sign-out, email verification,
 * password reset, magic link, OAuth callbacks, 2FA, and organization endpoints.
 *
 * This route is NOT wrapped in withApiHandler: the library owns its own request and
 * response shapes, including OAuth redirects, and forcing our envelope onto them
 * would break the protocol. Errors are surfaced through auth.onAPIError
 * (src/lib/auth.ts). Documented in docs/api/auth.md.
 */
export const { GET, POST } = toNextJsHandler(auth);
