import { requireBranch, requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { AppointmentsService } from '@/features/appointments/services/appointments.service';
import { rescheduleSchema } from '@/features/appointments/validators/appointments.validators';
import { UnprocessableError } from '@/lib/errors';
import { z } from 'zod';

/**
 * GET   /api/appointments/[id] — appointment detail (`appointment:read`).
 * PATCH /api/appointments/[id] — reschedule or cancel (`appointment:write`).
 *
 * Body: `{ startsAt: ISO }` to reschedule, `{ cancel: true }` to cancel.
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/appointments/[id]',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId, branchId } = await requireBranch();
    const { id } = await routeParams.params;
    const service = AppointmentsService.forScope({ organizationId, branchId });
    const appointment = await service.getAppointment(id);
    return jsonSuccess({ appointment }, { correlationId });
  },
);

export const PATCH = withApiHandler(
  'PATCH /api/appointments/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId, branchId } =
      await requireBranchPermission('appointment:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = rescheduleSchema
      .partial()
      .extend({ cancel: z.boolean().optional() })
      .parse(body);

    const service = AppointmentsService.forScope({ organizationId, branchId });
    if (input.cancel) {
      await service.cancel(id);
      return jsonSuccess({ ok: true }, { correlationId });
    }
    if (!input.startsAt) {
      throw new UnprocessableError(
        'Provide startsAt to reschedule or cancel: true to cancel.',
      );
    }
    const appointment = await service.reschedule(id, input.startsAt);
    return jsonSuccess({ appointment }, { correlationId });
  },
);
