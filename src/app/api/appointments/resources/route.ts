import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { AppointmentsService } from '@/features/appointments/services/appointments.service';
import { createResourceSchema } from '@/features/appointments/validators/appointments.validators';

/**
 * GET/POST /api/appointments/resources (AD-6).
 */

export const GET = withApiHandler(
  'GET /api/appointments/resources',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const service = AppointmentsService.forOrganization(organizationId);
    const resources = await service.listResources();
    return jsonSuccess({ resources }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/appointments/resources',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('appointment:write');
    const body: unknown = await request.json();
    const input = createResourceSchema.parse(body);

    const service = AppointmentsService.forOrganization(organizationId);
    const created = await service.createResource(input);

    return jsonSuccess({ resource: created }, { status: 201, correlationId });
  },
);
