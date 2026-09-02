import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';
import {
  getSignInState,
  isLocked,
  recordFailedSignIn,
  recordSuccessfulSignIn,
} from '@/features/auth/services/sign-in-security.service';
import {
  captureAuthEventContext,
  recordAuthEvent,
} from '@/features/auth/services/auth-events.service';

/**
 * Better Auth handler — mounts sign-in, sign-up, sign-out, email verification,
 * password reset, magic link, OAuth callbacks, 2FA, and organization endpoints.
 *
 * This route is NOT wrapped in withApiHandler: the library owns its own request and
 * response shapes, including OAuth redirects, and forcing our envelope onto them
 * would break the protocol. Errors are surfaced through auth.onAPIError
 * (src/lib/auth.ts). Documented in docs/api/auth.md.
 */
const handler = toNextJsHandler(auth);
export const GET = handler.GET;

export async function POST(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, '');
  const isPasswordSignIn = path === '/sign-in/email';

  if (!isPasswordSignIn) {
    const body = (await request
      .clone()
      .json()
      .catch(() => null)) as Record<string, unknown> | null;
    const eventContext = await captureAuthEventContext(request, path, body);
    const response = await handler.POST(request);
    if (response.ok) await recordAuthEvent(request, path, eventContext);
    return response;
  }

  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email : '';
  const state = email ? await getSignInState(email) : null;

  if (isLocked(state)) {
    return Response.json(
      {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many sign-in attempts. Try again later.',
      },
      { status: 429, headers: { 'retry-after': '60' } },
    );
  }

  const response = await handler.POST(request);
  if (response.ok && state) await recordSuccessfulSignIn(state.id, request);
  else if (!response.ok) await recordFailedSignIn(state, request);
  return response;
}
