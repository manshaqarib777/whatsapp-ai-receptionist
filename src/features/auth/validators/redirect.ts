/**
 * Post-authentication redirect validation.
 *
 * An unvalidated `?next=` parameter after login is a classic phishing vector: an
 * attacker sends `/login?next=https://evil.com`, the victim authenticates against the
 * real site, and is then handed to the attacker's page still believing they are on
 * ours (SECURITY_RULES.md → Open redirect).
 *
 * The rule is an allow-list of shapes, not a deny-list of known-bad strings. Deny-lists
 * for this problem have been bypassed repeatedly for two decades.
 */

/** Where a user lands when no valid destination was supplied. */
export const DEFAULT_REDIRECT = '/dashboard';

/**
 * Paths that must never be a post-login destination — bouncing a freshly
 * authenticated user back to an auth screen is confusing at best and a redirect loop
 * at worst.
 */
const FORBIDDEN_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/two-factor',
  '/api/',
];

/**
 * Returns the supplied path if it is a safe same-origin destination, otherwise the
 * default. Never throws — a malformed value is simply not trusted.
 */
export function safeRedirect(
  next: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (!next) return fallback;

  // Reject anything that is not a plain relative path before parsing. A single
  // leading slash followed by a non-slash is the only accepted shape.
  if (!next.startsWith('/')) return fallback;

  // "//evil.com" and "/\evil.com" are protocol-relative URLs: the browser treats
  // them as absolute and leaves the origin. Both are rejected.
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback;

  // Backslashes are normalised to forward slashes by some browsers, so "/\/evil.com"
  // can escape the origin. Reject them outright — no legitimate path contains one.
  if (next.includes('\\')) return fallback;

  // Control characters and whitespace can be used to smuggle a scheme past naive
  // checks (e.g. "/\tjavascript:alert(1)").
  if (/[\x00-\x1f\x7f\s]/.test(next)) return fallback;

  // Decode repeatedly so encoded traversal ("%2f%2fevil.com") cannot hide a
  // disallowed shape. Malformed encoding is itself grounds for rejection.
  let decoded = next;
  for (let i = 0; i < 3; i += 1) {
    try {
      const once = decodeURIComponent(decoded);
      if (once === decoded) break;
      decoded = once;
    } catch {
      return fallback;
    }
  }

  if (decoded.startsWith('//') || decoded.includes('\\') || !decoded.startsWith('/')) {
    return fallback;
  }

  // Re-check control characters AFTER decoding. Checking only the raw value lets
  // "/%09javascript:alert(1)" through, because the tab is still encoded at that
  // point and only becomes a control character here.
  if (/[\x00-\x1f\x7f]/.test(decoded)) return fallback;

  // A scheme anywhere in the decoded value means it is not a relative path.
  // Leading whitespace is stripped first so "/ javascript:..." cannot evade the
  // anchor by pushing the scheme past position 0.
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded.slice(1).trimStart())) return fallback;

  const pathOnly = decoded.split(/[?#]/)[0] ?? '';

  if (FORBIDDEN_PREFIXES.some((prefix) => pathOnly.startsWith(prefix))) {
    return fallback;
  }

  return next;
}
