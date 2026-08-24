# Milestone 25 — Production Readiness and Final QA

## Objective

Produce a locally verifiable, immutable production artifact and an auditable delivery
contract covering CI/CD, health/readiness, structured logging, trace propagation,
monitoring, alerts, deployment, and rollback. Complete the final regression matrix
without deploying to or mutating an external production environment.

## Requirements

Production

Docker

CI/CD

Monitoring

Logging

Tracing

Alerts

Deployment

Rollback

Health Checks

STOP

## Architecture Decisions

- Build one multi-stage, non-root Next.js standalone image from the already-certified
  source. Promote the same immutable image digest between environments; never rebuild
  per stage.
- Keep deployment provider-neutral and declarative. CI verifies the image and produces
  artifacts/SBOM; an operator-controlled environment owns credentials and promotion.
  This milestone does not perform an external deployment.
- Split liveness (process responds) from readiness (PostgreSQL and configured Redis
  respond). The existing safe aggregate health response remains compatible.
- Preserve Pino JSON/redaction and correlation IDs. Add validated W3C trace context and
  structured duration/error events without sending customer content to telemetry.
- Define alerts from user-impacting symptoms (readiness, error ratio, latency, worker
  backlog) with runbook links. Monitoring configuration contains no credentials.
- Use expand/migrate/contract deployment ordering and previous immutable image digest
  for rollback. Database rollback is forward-fix/restore only after explicit approval.

## Delivery and Data Impact

- No business-schema changes are planned.
- Add a production web Dockerfile, ignore policy, local production compose profile,
  CI Redis/budget/container smoke gates, and a non-publishing image workflow.
- Add safe liveness/readiness routes and trace response headers. No tenant data or
  infrastructure address is exposed.

## Security Considerations

- Runtime secrets are injected, never copied into image layers, CI artifacts, or logs.
- Containers run as an unprivileged user with a read-only root filesystem where
  practical, dropped capabilities, bounded resources, and loopback/private dependencies.
- Trace headers are strictly validated; untrusted baggage is not accepted or reflected.
- Deployment and rollback scripts require explicit image identifiers and fail closed on
  missing health confirmation.

## Testing Strategy

- Unit/integration: trace parsing/generation, liveness/readiness behavior, logger
  redaction, alert syntax, and existing full suite.
- Container: build image, inspect non-root metadata, boot against local PostgreSQL/Redis,
  verify readiness and graceful stop.
- CI/static: workflow syntax, dependency audit, migration/drift, format/lint/type,
  production build, asset budget, browser suite, and image smoke.
- Final QA: full Vitest and desktop/mobile Playwright matrix covering pages, APIs,
  workflows, permissions, AI, integrations, accessibility, performance, security,
  responsive behavior, SEO metadata, and documentation.

## Risks

1. **Secrets enter image/history** — critical; runtime injection and secret scan.
2. **False-ready instance receives traffic** — critical; dependency readiness probe.
3. **Rollback corrupts schema** — critical; immutable app rollback plus forward-only DB policy.
4. **Telemetry leaks PII** — critical; allowlisted fields and existing central redaction.
5. **CI differs from production** — high; CI smoke-tests the same standalone image.
6. **External deployment is unverified** — explicit; provider credentials/project are not
   authorized in this task, so local artifact readiness is certified separately.
