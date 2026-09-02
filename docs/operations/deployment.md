# Deployment and rollback

No external deployment was performed during Milestone 25. This is the provider-neutral
operator contract for promoting the locally certified OCI artifact.

## Deployment

1. Require green CI for the exact commit: audit, migrations/drift, type, lint, format,
   1,000+ Vitest assertions, production build/budget, browser suite, and container smoke.
2. Build once and record the OCI digest, source commit, migration set, SBOM, and operator.
3. Back up PostgreSQL and verify the restore procedure before schema changes.
4. Apply expand-compatible migrations with `prisma migrate deploy`; never run `migrate dev`.
5. Deploy the same digest to a preview environment with runtime secrets from its secret
   manager. Confirm liveness, readiness, CSP, trace headers, login, and a read-only journey.
6. Promote that digest gradually. Watch readiness, 5xx ratio, latency, and worker backlog
   through the full observation window before completing the rollout.

Required runtime configuration includes `DATABASE_URL`, a 32+ character `AUTH_SECRET`,
SMTP delivery, server-only `APP_URL` with the public HTTPS origin, storage, and provider
keys selected for live use.
Use private TLS Redis (`rediss://`) when configured. Multi-instance Server Functions also
require one build-time `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`; set a deployment identifier
for rolling-version skew protection.

## Rollback

1. Stop the rollout and identify the last known-good immutable image digest.
2. If migrations are backward compatible, redeploy that digest and wait for every instance
   to pass readiness before restoring traffic.
3. Do **not** reverse destructive migrations automatically. Forward-fix first; restore a
   verified backup only with explicit incident-lead approval and a documented data-loss window.
4. Drain old instances for 10–30 seconds so in-flight requests finish, then verify health,
   authentication, one tenant-isolation check, and worker processing.
5. Record the rollback digest, reason, timestamps, health evidence, and follow-up owner.

## Container contract

Build with `docker build -f docker/app.Dockerfile -t war-app:<version> .`. The runtime
image runs as `nextjs` (UID 1001), contains standalone output only, stores uploads in the
explicit `/app/storage` volume, and probes `/api/health/ready`. Put a streaming-capable
reverse proxy in front; never expose Node, PostgreSQL, or Redis directly to the internet.
