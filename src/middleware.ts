import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optimistic route protection.
 *
 * IMPORTANT: this is a redirect convenience, NOT the security boundary. It checks
 * only for the presence of a session cookie — it does not validate the session,
 * because doing database work in middleware runs on every request including assets.
 *
 * The authoritative check is server-side in the (app) layout and in every API route
 * via requireAuth/requireOrg/requirePermission. A request that bypasses middleware
 * entirely is still rejected (MILESTONE_02_PLAN.md, Risk 8).
 */

const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/onboarding', '/inbox', '/contacts', '/appointments'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const cookie = getSessionCookie(request);

  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    // Preserve where the user was heading so login can return them there. The
    // value is validated by safeRedirect before it is ever used.
    url.searchParams.set('next', `${pathname}${search}`);

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/onboarding/:path*',
    '/inbox/:path*',
    '/contacts/:path*',
    '/appointments/:path*',
  ],
};
