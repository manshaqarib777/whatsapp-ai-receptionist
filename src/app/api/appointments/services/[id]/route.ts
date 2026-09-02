import { AppointmentsService } from '@/features/appointments/services/appointments.service';
import { updateServiceSchema } from '@/features/appointments/validators/appointments.validators';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { requireBranchPermission } from '@/server/auth-context';

export const PATCH = withApiHandler<{ id: string }>(
  'PATCH /api/appointments/services/[id]',
  async (request, { correlationId }, { params }) => {
    const { organizationId, branchId } =
      await requireBranchPermission('appointment:write');
    const { id } = await params;
    const input = updateServiceSchema.parse(await request.json());
    const service = await AppointmentsService.forScope({
      organizationId,
      branchId,
    }).updateService(id, input);
    return jsonSuccess({ service }, { correlationId });
  },
);
