# Milestone 25 — Completed

Completed: 2026-08-24

## What Was Built

The repository now produces one Next.js standalone OCI artifact with a multi-stage
Node 22 Alpine build, an unprivileged UID 1001 runtime, a bounded readiness healthcheck,
and no runtime secrets in image configuration. Server-only `APP_URL` makes the canonical
origin, authentication callbacks, robots policy, and sitemap runtime-specific without
rebuilding the image.

API requests validate and continue W3C trace context with fresh server spans. Liveness
is separated from PostgreSQL/configured-Redis readiness, while Pino emits correlated,
redacted JSON. Provider-neutral CI builds and smokes the container; a manual release
workflow exports a non-published OCI artifact with provenance and an SBOM. Monitoring,
symptom alerts, incident response, deployment, graceful draining, and rollback are
documented without claiming an external deployment.

Final QA also exposed a cache-aside race: an old integration catalog load could finish
after deletion-based invalidation and repopulate stale data. Generation-versioned cache
keys now make such in-flight writes unreachable, with a deterministic Redis regression
test and repeated browser proof.

## Main Files

- `docker/app.Dockerfile` and `.dockerignore` — production artifact and build boundary.
- `.github/workflows/ci.yml` and `release.yml` — verification and non-publishing release.
- `src/lib/tracing.ts` and `src/server/api-handler.ts` — W3C request trace propagation.
- `src/app/api/health/live/route.ts` and `ready/route.ts` — orchestration probes.
- `src/app/robots.ts` and `src/app/sitemap.ts` — runtime-origin public metadata.
- `docs/operations/observability.md` and `deployment.md` — alerts, response, promotion,
  draining, and rollback contracts.
- `tests/e2e/production.spec.ts` — health, tracing, CSP, SEO, and responsive browser proof.

## Final QA Evidence

| Gate | Result |
|---|---|
| Full Vitest | 121 files, 1,028 tests passed with Redis enabled in 182.92 s |
| Full Playwright | 260 desktop/mobile journeys passed in 9.7 min |
| Production build | Next.js 16.2.12; compiled in 35.3 s; TypeScript in 38.7 s; 76 page entries |
| Asset budget | 93 assets; largest JS chunk 439,993 bytes, below 512,000 bytes |
| OCI artifact | `sha256:c4e3c7e60c1e...`; 221,108,081 bytes; configured user `nextjs` |
| Container smoke | Running/healthy, UID 1001, readiness 200, runtime robots/sitemap origin |
| Security/telemetry | Nonce CSP, correlation ID, traceparent, redacted trace-aware JSON logs |
| Database | Only documented HNSW/trgm drift; seed replay passed twice in 2.875/2.302 s |
| Static/supply chain | TypeScript, zero-warning ESLint, Prettier, diff check, audit (0) passed |

The Playwright matrix covers public and authenticated pages, APIs, workflows, roles and
tenant isolation, AI and specialist actions, sandbox integrations, negative/edge paths,
axe accessibility, keyboard/focus behavior, responsive widths, performance/security,
and SEO. API/service tests cover the remaining validation, persistence, and failure paths.

## Production-readiness Decision

All repository-controlled Final QA checks pass. The source and immutable artifact are
production-ready for an operator-controlled preview promotion using the documented
contract. This means the artifact is ready to deploy; it does **not** mean a live service
exists or that a real provider environment has been verified.

## Known Operational Boundaries

- No external preview, registry, cloud project, DNS, TLS endpoint, SMTP provider, payment
  account, WhatsApp tenant, or production datastore was configured or mutated.
- The release workflow deliberately cannot publish or deploy; an environment-protected
  operator must promote the exact digest and verify it externally.
- SIGTERM uses the platform's normal signal termination semantics; operators must provide
  the documented 10–30 second connection-draining window.
- Redis remains optional performance infrastructure. PostgreSQL/direct-read fallbacks
  preserve correctness, with readiness reflecting Redis only when it is configured.
