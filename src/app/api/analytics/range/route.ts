import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { setRangeSchema } from '@/features/analytics/validators/analytics.validators';
import { cookies } from 'next/headers';

/**
 * PATCH /api/analytics/range — persist the analytics date range in a cookie.
 * Mirrors the dashboard range route.
 */

export const PATCH = withApiHandler(
  'PATCH /api/analytics/range',
  async (request, { correlationId }) => {
    await requireOrg();
    const body: unknown = await request.json();
    const { range } = setRangeSchema.parse(body);

    const cookieStore = await cookies();
    cookieStore.set('analytics:range', range, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });

    return jsonSuccess({ range }, { correlationId });
  },
);
