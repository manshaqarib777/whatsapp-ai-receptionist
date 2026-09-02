import { requireBranch } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AppointmentsService } from '@/features/appointments/services/appointments.service';
import { availabilityQuerySchema } from '@/features/appointments/validators/appointments.validators';

/**
 * GET /api/appointments/availability?serviceId=&resourceId=&date=&timezone=
 *
 * Open slots for a service on a date. `appointment:read`.
 */

export const GET = withApiHandler(
  'GET /api/appointments/availability',
  async (request, { correlationId }) => {
    const { organizationId, branchId } = await requireBranch();
    const url = new URL(request.url);
    const input = availabilityQuerySchema.parse(Object.fromEntries(url.searchParams));

    const service = AppointmentsService.forScope({ organizationId, branchId });
    const slots = await service.availability(input);

    return jsonSuccess({ slots }, { correlationId });
  },
);
