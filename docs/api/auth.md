# Authentication API

Milestone 2. Implementation: `src/lib/auth.ts`, `src/app/api/auth/[...all]/route.ts`.

---

## `ALL /api/auth/[...all]`

Better Auth's handler (ADR-0001). It mounts sign-in, sign-up, sign-out, email
verification, password reset, magic link, OAuth callbacks, two-factor, and
organization endpoints.

**This route is deliberately not wrapped in `withApiHandler`.** The library owns its
own request and response shapes, including OAuth redirects; forcing our envelope onto
them would break the protocol. Errors are surfaced through `auth.onAPIError`.

Consume it through `src/lib/auth-client.ts` on the client and
`src/server/auth-context.ts` on the server — never by calling these paths directly.

### Endpoints in use

| Path | Method | Purpose |
|---|---|---|
| `/api/auth/sign-up/email` | POST | Create an account; sends verification |
| `/api/auth/sign-in/email` | POST | Password sign-in |
| `/api/auth/sign-in/magic-link` | POST | Request a magic link |
| `/api/auth/sign-in/social` | POST | Begin an OAuth flow |
| `/api/auth/sign-out` | POST | End the session |
| `/api/auth/get-session` | GET | Current session |
| `/api/auth/verify-email` | GET | Consume a verification token |
| `/api/auth/request-password-reset` | POST | Send a reset link |
| `/api/auth/reset-password` | POST | Consume a reset token |
| `/api/auth/two-factor/enable` | POST | Begin TOTP enrolment |
| `/api/auth/two-factor/verify-totp` | POST | Verify a TOTP code |
| `/api/auth/two-factor/verify-backup-code` | POST | Use a backup code |
| `/api/auth/two-factor/disable` | POST | Remove TOTP |
| `/api/auth/organization/set-active` | POST | Set the session's active organization |

---

## Security Properties

These are contractual, and each is covered by a test.

### Account enumeration

Sign-in, sign-up, forgotten-password, and magic-link **all** return an outcome that
does not reveal whether an address is registered:

- Sign-in failure is always "Those details are not correct."
- Sign-up always shows "Check your email", including for an existing address.
- Password reset and magic link always show "If an account exists…".

Tested in `login-form.test.tsx` and `tests/e2e/auth.spec.ts`.

### Token lifetimes

| Token | Expiry | Single use |
|---|---|---|
| Email verification | 24 hours | Yes |
| Password reset | 1 hour | Yes |
| Magic link | 15 minutes | Yes |
| Invitation | 48 hours | Yes |
| Session | 30 days, 24h rolling refresh | n/a |

### Sessions

Database-backed, not stateless JWTs, so revocation is immediate. Cookies are
`httpOnly`, `sameSite=lax`, and `secure` in production.

The **active organization is stored on the session row**. It is never read from a
request body, query parameter, or header — this is what makes `organizationId`
trustworthy for tenant scoping.

### Passwords

Minimum 12 characters, maximum 128. Hashed by the library (scrypt); never hand-rolled.
Length is favoured over complexity ceremony.

### Two-factor

TOTP, 30-second step. Ten single-use backup codes, shown exactly once at enrolment.
Enabling **and** disabling both require the account password.

### OAuth

Google and GitHub are configured only when both the client id and secret are present.
An unconfigured provider does not appear on the sign-in screen and does not break the
app. State and PKCE are handled by the library.

### Open redirect

The `?next=` parameter is validated by `safeRedirect`
(`src/features/auth/validators/redirect.ts`) before any use. Absolute URLs,
protocol-relative URLs, backslash and encoded-traversal variants, control characters,
and auth routes are all rejected in favour of `/dashboard`. 30 unit tests.

### Rate limiting

In-process (`src/lib/rate-limit.ts`). Sign-in 5/min, sign-up 3/15min, password reset
3/15min, magic link 3/15min, two-factor 5/5min.

**Known limitation**: per-process and resets on deploy. Redis replaces the store in
Milestone 24.

---

## Known Limitations

1. ~~No email provider.~~ **Resolved.** Real SMTP via nodemailer. Development uses
   Mailpit (docker compose) on `localhost:1025`, with an inbox at
   http://localhost:8025. Production points `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` at
   any provider. Environment validation **refuses to boot** in production unless
   `EMAIL_TRANSPORT=smtp`, so account-critical mail can never be silently discarded.
2. **OAuth is unverified end to end** — no credentials are available. The configuration
   logic and the disabled path are tested; the redirect round-trip is not.
