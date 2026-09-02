# Security posture and OWASP verification

Milestone 23 is a local hardening milestone, not a certification or claim that an
external penetration test occurred.

## Controls

- Authentication is database-session backed; authorization and tenant scope are fresh
  server-side checks. Platform operators use a separate global role.
- Application-owned sensitive actions use atomic PostgreSQL rate buckets keyed by an
  HMAC digest. Raw IPs/emails are not stored. Better Auth retains its own configured
  credential limiter. Milestone 24 can replace the durable backend with Redis.
- Integration credentials use versioned AES-256-GCM envelopes with organization and
  provider as authenticated context. APIs never select or return ciphertext. A
  base64-encoded 32-byte `DATA_ENCRYPTION_KEY` is required when storing credentials.
- Every document response receives a fresh CSP nonce from Proxy. Production script
  policy uses `strict-dynamic` and contains neither `unsafe-inline` nor `unsafe-eval`.
  Request-time rendering lets Next attach the nonce to framework scripts.
- Customer access and erasure requests are tenant-owned lifecycle records. Exports are
  transient; erasure reuses the atomic PII redaction registry; both are audited without
  PII. Soft deletion is not represented as regulatory erasure.
- PostgreSQL backup and restore-verification procedures are documented separately in
  `docs/operations/backups.md`.

## OWASP-oriented regression matrix

| Risk | Automated evidence |
|---|---|
| Broken access control | Tenant-isolation integration matrix, permission tests, privacy/admin owner/member/operator E2E denials. |
| Cryptographic failures | AES-GCM round-trip, wrong-context and tamper rejection; ciphertext omitted from DTO selection. |
| Injection | Strict Zod boundaries, parameterized Prisma/SQL, prompt-injection guardrails, no raw HTML rendering. |
| Insecure design | Destructive confirmation, optimistic concurrency, closed AI tools, consent checks, scoped repositories. |
| Security misconfiguration | CSP/HSTS/nosniff/frame/referrer/permissions E2E assertions and production build. |
| Vulnerable components | Lockfile plus high/critical production `npm audit` gate. |
| Authentication failures | Progressive lockout, 2FA, generic outcomes, credential throttling, session revocation tests. |
| Integrity failures | Append-only audit repository, webhook signatures, idempotency, migration/seed/drift gates. |
| Logging failures | Correlation ids, structured redacted logger, audit metadata allow-list, sanitized admin logs. |
| SSRF | Integration URLs require HTTPS and are not fetched by generic server code; provider adapters own fixed endpoints. |

## Local penetration test boundary

The Playwright security suite exercises the deployed production bundle as an untrusted
browser: direct unauthorized APIs, role escalation boundaries, nonce policy, privacy
workflow, output redaction, accessibility, and mobile behavior. Integration tests send
cross-tenant identifiers, stale versions, tampered ciphertext, and concurrent limiter
requests. These tests are safe and deterministic; they do not scan or attack external
hosts. A qualified independent assessment remains a pre-production operational task.

## Key rotation

Ciphertext starts with envelope version `v1` and the row records key version `1`.
Rotation must introduce the new key alongside the old key, decrypt each record with its
recorded version, re-encrypt under the new version in a bounded audited job, verify all
rows, then retire the old key. Never overwrite the only working key first.
