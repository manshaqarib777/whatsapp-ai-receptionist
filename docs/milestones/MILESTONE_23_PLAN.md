# Milestone 23 — Security

## Objective

Harden the application with durable abuse controls, authenticated encryption for
integration credentials, operational backup/restore verification, traceable privacy
requests, stronger audit evidence, and repeatable OWASP-oriented penetration checks.

## Requirements

Security

Rate Limiting

Encryption

Backups

Audit

GDPR

OWASP

Pen Testing

STOP

## Architecture Decisions

- Replace the in-memory rate-limit store with a PostgreSQL-backed atomic bucket for
  security-sensitive flows. Keep the existing interface; Milestone 24 may swap the
  backend to Redis without changing callers. Never store raw IP/email identifiers.
- Add AES-256-GCM envelope records for integration credentials. The key is validated
  server configuration, ciphertext is write-only through APIs, and responses expose
  only a non-secret hint. Existing sandbox connections need no secret.
- Represent access/export and erasure work as organization-scoped privacy requests
  with explicit status, requester, subject contact, timestamps, version, and audit.
  Generated exports are bounded JSON and never persisted in logs.
- Provide local `pg_dump`/`pg_restore` scripts with explicit targets, checksums,
  retention guidance, and a disposable-database restore verifier. Do not automate or
  claim production backups in this milestone.
- Treat penetration testing as repeatable defensive tests: headers/CSP, authz, tenant
  escape, injection, unsafe redirects, oversized input, rate limiting, and sensitive
  response/log absence. No attacks against external systems.

## Dependencies

- Upstream: Milestones 1–22.
- Node standard-library crypto, PostgreSQL/Prisma, existing auth/audit/erasure layers,
  Docker PostgreSQL client tools. No new runtime package.

## Database Impact

- Add hashed atomic rate-limit buckets with expiry.
- Add encrypted credential fields to integration connections.
- Add organization-owned privacy requests with constrained type/status and optimistic
  concurrency.
- Add audit-log integrity evidence if it can be introduced additively without breaking
  the non-blocking audit-write contract.

## API and UI Impact

- Add owner/admin privacy-request APIs and a security-settings workflow for export and
  erasure requests. Erasure requires explicit confirmation and remains tenant-scoped.
- Extend integration configuration with an optional write-only credential; never echo
  it from server DTOs.
- Preserve all current routes and error contracts.

## Security Considerations

- Encryption key loss makes credentials unrecoverable; malformed or missing keys fail
  boot whenever encrypted credentials are enabled.
- PostgreSQL throttling must use one atomic statement to avoid concurrent allowance.
- Export/erasure must prove subject ownership, minimize data, and audit actions without
  embedding the exported PII.
- Backup files contain sensitive data: restrictive permissions, explicit paths, no
  repository storage, checksum verification, and documented encryption requirement.

## Testing Strategy

- Unit: encryption tamper/wrong-key behavior, identifier hashing, validators, CSP and
  security response policies.
- Integration: atomic durable limits, credential ciphertext/no plaintext, privacy
  tenant isolation, export completeness, erasure/audit preservation, concurrency.
- Component/E2E: privacy request states, confirmation, RBAC denial, operator/customer
  boundaries, accessibility and mobile layout.
- Security: deterministic OWASP regression script plus full repository gates, two seed
  replays, schema drift, dependency audit, production build, and disposable restore.

## Risks

1. **Encryption key exposure or rotation failure** — critical; strict env validation,
   versioned ciphertext envelope, no logging, documented rotation path.
2. **Cross-tenant privacy export** — critical; server-derived scope and isolation tests.
3. **Rate-limit race** — high; database atomic upsert/update and concurrency test.
4. **Backup mistaken for production coverage** — high; local tooling and explicit
   operational limitation only.
5. **Destructive erasure misuse** — high; owner/admin permission, exact contact,
   explicit confirmation, immutable audit evidence.
