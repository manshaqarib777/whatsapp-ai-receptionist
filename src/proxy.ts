import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy } from '@/lib/security-headers';
import { isDevelopment } from '@/lib/env';

const PROTECTED = [
  '/dashboard',
  '/settings',
  '/onboarding',
  '/inbox',
  '/contacts',
  '/appointments',
  '/crm',
  '/quotes',
  '/invoices',
  '/workflows',
  '/broadcast',
  '/analytics',
  '/reviews',
  '/loyalty',
  '/accept-invitation',
  '/admin',
];

/** Optimistic redirect convenience; authoritative authorization remains server-side. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cookie = getSessionCookie(request);
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = contentSecurityPolicy(nonce, isDevelopment);

  if (
    !cookie &&
    PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    const response = NextResponse.redirect(url);
    response.headers.set('Content-Security-Policy', policy);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
