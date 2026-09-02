import { requireBranch, requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AppointmentsService } from '@/features/appointments/services/appointments.service';
import {
  bookSchema,
  calendarQuerySchema,
} from '@/features/appointments/validators/appointments.validators';

/**
 * GET  /api/appointments?from=&to= — calendar view (`appointment:read`).
 * POST /api/appointments — book (`appointment:write`).
 */

export const GET = withApiHandler(
  'GET /api/appointments',
  async (request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranch();
    const url = new URL(request.url);
    const input = calendarQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = AppointmentsService.forScope({ organizationId, branchId });
    const appointments = await service.listAppointments(input.from, input.to);

    return jsonSuccess({ appointments }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/appointments',
  async (request, { correlationId }) => {
    const { organizationId, branchId } =
      await requireBranchPermission('appointment:write');
    const body: unknown = await request.json();
    const input = bookSchema.parse(body);

    const service = AppointmentsService.forScope({ organizationId, branchId });
    const appointment = await service.book(input);

    return jsonSuccess({ appointment }, { status: 201, correlationId });
  },
);
