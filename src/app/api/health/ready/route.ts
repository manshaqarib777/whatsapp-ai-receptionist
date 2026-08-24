import { getHealthReport } from '@/features/health/services/health.service';
import { UnhealthyError } from '@/lib/errors';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withApiHandler('GET /api/health/ready', async (_request, context) => {
  const report = await getHealthReport();
  if (report.status !== 'ok') {
    throw new UnhealthyError('The application is not ready.');
  }
  return jsonSuccess(
    { status: 'ready', timestamp: report.timestamp },
    { correlationId: context.correlationId },
  );
});
