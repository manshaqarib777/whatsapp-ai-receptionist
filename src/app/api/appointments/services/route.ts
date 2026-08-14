import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AppointmentsService } from '@/features/appointments/services/appointments.service';
import { createServiceSchema } from '@/features/appointments/validators/appointments.validators';

/**
 * GET/POST /api/appointments/services (AD-6).
 */

export const GET = withApiHandler(
  'GET /api/appointments/services',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const service = AppointmentsService.forOrganization(organizationId);
    const services = await service.listServices();
    return jsonSuccess({ services }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/appointments/services',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('appointment:write');
    const body: unknown = await request.json();
    const input = createServiceSchema.parse(body);

    const service = AppointmentsService.forOrganization(organizationId);
    const created = await service.createService(input);

    return jsonSuccess({ service: created }, { status: 201, correlationId });
  },
);
