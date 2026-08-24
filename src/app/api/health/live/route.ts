import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withApiHandler('GET /api/health/live', async (_request, context) =>
  jsonSuccess({ status: 'ok' }, { correlationId: context.correlationId }),
);
