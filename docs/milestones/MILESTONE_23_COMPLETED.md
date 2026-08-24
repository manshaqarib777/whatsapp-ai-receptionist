# Milestone 23 — Completed

Completed: 2026-08-24

## What Was Built

Security-sensitive application actions now use atomic PostgreSQL throttling with
HMAC-hashed identifiers. Integration credentials have versioned AES-256-GCM envelopes
and write-only API semantics. Owner/admin privacy workflows provide transient customer
exports and confirmed transactional erasure with immutable PII-free audit evidence.
Every document uses a per-request nonce CSP, including the pre-paint theme script.

Backup/restore tooling, key rotation, OWASP coverage, and the safe local penetration
boundary are documented. A version-matched PostgreSQL 17 dump restored successfully
into an explicitly disposable database and exposed all 26 completed migrations before
the temporary database and dump were removed.

## Files Created

- `prisma/migrations/20260824140000_security_privacy/migration.sql` — security/privacy persistence.
- `src/lib/encryption.ts`, durable limiter repository, and focused cryptographic/concurrency tests.
- `src/features/privacy/**` and `src/app/api/privacy/**` — scoped workflow, UI, APIs, and tests.
- `scripts/backup-database.sh` and `scripts/verify-database-restore.sh` — guarded local operations.
- `docs/api/privacy.md`, `docs/architecture/security.md`, and `docs/operations/backups.md`.
- `tests/e2e/security.spec.ts` — CSP, privacy, RBAC, desktop/mobile, and axe evidence.

## Tests Completed

| Type | Count | Coverage | Command |
|---|---:|---|---|
| Focused unit/integration/component | 6 | Encryption/tamper, nonce CSP, atomic limiter, privacy isolation/export/audit, UI axe | `npx vitest run ...security/privacy...` |
| Full Vitest | 1,015 | 115 repository test files | `npm test` |
| Focused E2E | 4 | Owner workflow, member denial, nonce CSP, desktop/mobile, axe | `npx playwright test tests/e2e/security.spec.ts` |
| Full E2E | 252 | Desktop and mobile regression matrix | `npm run test:e2e` |

TypeScript, zero-warning ESLint, production build, schema drift, two post-browser seed
replays, restore drill, `git diff --check`, file-size policy, and high-severity
production dependency audit all passed.

## Performance Results

- Production compilation: 31.8 seconds; 74 request-rendered pages/routes generated.
- Full Vitest: 123.95 seconds, 1,015 tests.
- Full Playwright: 8.7 minutes, one worker, 252 journeys.
- Deterministic post-E2E seeds: 2.079 and 3.180 seconds.
- New production files range from 23 to 175 lines, all below 300.

## Known Limitations

- PostgreSQL is the durable limiter backend; Milestone 24 may replace it with Redis.
- Nonce CSP requires request-time rendering, trading static HTML caching for strict
  script execution. Milestone 24 owns performance mitigation.
- Inline styles remain permitted because current UI/chart libraries emit style
  attributes; script `unsafe-inline` and production `unsafe-eval` are removed.
- Backup scripts require PostgreSQL client/server major-version compatibility.
- This is automated local penetration coverage, not an independent certification.
- No external attack, service mutation, production backup, or deployment occurred.
