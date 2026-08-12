import { cookies } from 'next/headers';

import { dashboardRangeSchema } from '@/features/dashboard/validators/dashboard.validators';
import { requireOrg } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

/**
 * PATCH /api/dashboard/range — persist the global dashboard date range.
 *
 * COMPONENT_DESIGN.md §7: the date range is global and persisted, at the top,
 * applying to every widget. It lives in a cookie read server-side by the layout so
 * the first paint is already correct. The cookie is a benign UI preference:
 * `SameSite=Lax`, one year, never used for authorization. Auth is still enforced —
 * the route only exists for signed-in users.
 */

export const DASHBOARD_RANGE_COOKIE = 'dashboard:range';

export const PATCH = withApiHandler(
  'PATCH /api/dashboard/range',
  async (request, { correlationId }) => {
    await requireOrg();

    const body: unknown = await request.json();
    const { range } = dashboardRangeSchema.parse(body);

    const cookieStore = await cookies();
    cookieStore.set(DASHBOARD_RANGE_COOKIE, range, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
    });

    return jsonSuccess({ range }, { correlationId });
  },
);
