import { getHealthReport } from '@/features/health/services/health.service';
import { UnhealthyError } from '@/lib/errors';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

/**
 * GET /api/health
 *
 * Liveness and dependency check. Documented in /docs/api/health.md.
 *
 * Auth: none. This must be reachable by an uptime probe, and it exists before any
 * auth system does (Milestone 2). It exposes no data, so there is nothing to
 * protect — but it is deliberately terse for the same reason.
 *
 * Rate limiting: none. Keep infrastructure probes simple and protect this route at
 * the ingress/load-balancer layer; application dependencies are still bounded by
 * short timeouts.
 */

// Never cached — a cached health check reports the past.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withApiHandler(
  'GET /api/health',
  async (_request, { correlationId }) => {
    const report = await getHealthReport();

    if (report.status !== 'ok') {
      throw new UnhealthyError('One or more dependencies are unavailable.', [
        { path: 'checks.database', message: `database is ${report.checks.database}` },
        { path: 'checks.email', message: `email is ${report.checks.email}` },
        { path: 'checks.redis', message: `redis is ${report.checks.redis}` },
      ]);
    }

    return jsonSuccess(report, { correlationId });
  },
);
