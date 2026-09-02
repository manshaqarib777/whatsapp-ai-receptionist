# Vercel web + external workers

This is the recommended hosted topology. Vercel runs the Next.js web/API layer;
PostgreSQL remains the durable system of record; private Vercel Blob stores customer
uploads; Redis accelerates caching/rate limiting; a persistent container runs every
database-backed consumer.

## Topology

| Component | Recommended service | Required behavior |
|---|---|---|
| Web/API | Vercel Fluid Compute | Next.js preset, Node.js runtime |
| Database | Neon or Supabase Postgres | Pooled application URL, direct migration URL |
| Cache | Upstash Redis | TLS `rediss://` URL |
| Files | Private Vercel Blob | Same store token on web and worker |
| Workers | Railway persistent service | `docker/worker.Dockerfile`, one replica initially |

Choose the Vercel Function, PostgreSQL, Redis, Blob, and worker regions together. For
a Riyadh-focused deployment, `dxb1` is the closest Vercel compute region, but database
proximity takes precedence; do not select it until the database region is known.

## Vercel project

1. Import the GitHub repository and retain the detected Next.js preset. `vercel.json`
   enables Fluid Compute; it deliberately does not hard-code a region.
2. Provision a **private** Blob store and connect it to production and preview. Set
   `STORAGE_DRIVER=vercel-blob`; Vercel injects `BLOB_READ_WRITE_TOKEN`.
3. Provision/connect pooled Postgres and Redis. Apply migrations separately with a
   direct database URL before promoting the web deployment.
4. Set the required variables below for Preview and Production, using separate data
   resources unless preview is intentionally read-only.
5. Verify `/api/health/live`, `/api/health/ready`, authentication, one direct upload,
   and the resulting worker job before assigning a custom domain.

Large uploads never traverse a Vercel Function. The browser requests a short-lived,
tenant/user/resource-bound intent, uploads directly to private Blob, then finalizes the
database record through the authenticated domain route. Local development retains the
existing multipart/filesystem path.

## Runtime variables

Required on both web and worker: `DATABASE_URL`, `DATABASE_POOL_MAX`, `AUTH_SECRET`,
`STORAGE_DRIVER=vercel-blob`, `BLOB_READ_WRITE_TOKEN`, provider configuration used by
the workers, and `LOG_LEVEL`. Use the same `DATA_ENCRYPTION_KEY` anywhere encrypted
integration credentials are read.

Web-only values include `APP_URL`, `NEXT_PUBLIC_APP_URL`, SMTP/OAuth/Stripe webhook
configuration, `REDIS_URL`, `CACHE_PREFIX`, and `CACHE_TTL_SECONDS`. Set `APP_URL` to
the custom production HTTPS origin. Preview deployments fall back safely to Vercel's
deployment hostname when `APP_URL` is absent.

Production must use SMTP and live AI/speech/embedding providers intentionally. Never
enable `E2E_TEST_RUN` or `DESIGN_GALLERY` in a hosted environment.

## Railway worker service

Create one persistent service from the same GitHub commit and set
`RAILWAY_DOCKERFILE_PATH=/docker/worker.Dockerfile`. The image runs
`npm run workers:work`, which starts the AI turn, knowledge ingestion, transcription,
reminder, CRM automation, workflow delay, broadcast, review, and loyalty consumers.

Start with one replica because several consumers poll shared due work. Their database
claims are durable/idempotent, but a single replica avoids needless polling cost during
initial validation. Configure restart-on-failure and a 20-second SIGTERM drain. The
service has no public port and must not receive a domain.

## Promotion order

1. Back up the target database and run the restore drill.
2. Apply `npm run db:deploy` using the direct database URL.
3. Deploy the worker from the exact source commit; verify its startup logs.
4. Deploy Vercel Preview and run health, auth, upload, and job completion checks.
5. Promote the same commit to Production, attach the domain, and update `APP_URL` plus
   provider callback/webhook URLs.
6. Watch readiness, 5xx, latency, database connections, Blob failures, and job backlog.

Rollback the web through Vercel's immutable deployment history and the worker through
Railway's previous image/deployment. Follow `deployment.md`; never reverse a destructive
database migration automatically.
