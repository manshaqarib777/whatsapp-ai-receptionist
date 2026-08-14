import { requireOrg, requirePermission } from '@/server/auth-context';
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
    const { organizationId } = await requireOrg();
    const url = new URL(request.url);
    const input = calendarQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = AppointmentsService.forOrganization(organizationId);
    const appointments = await service.listAppointments(input.from, input.to);

    return jsonSuccess({ appointments }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/appointments',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('appointment:write');
    const body: unknown = await request.json();
    const input = bookSchema.parse(body);

    const service = AppointmentsService.forOrganization(organizationId);
    const appointment = await service.book(input);

    return jsonSuccess({ appointment }, { status: 201, correlationId });
  },
);
