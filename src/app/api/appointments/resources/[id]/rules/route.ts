import { requireBranchPermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { AppointmentsService } from '@/features/appointments/services/appointments.service';
import { addRuleSchema } from '@/features/appointments/validators/appointments.validators';

/**
 * POST /api/appointments/resources/[id]/rules — add an availability rule.
 * `appointment:write`.
 */

type Params = { id: string };

export const POST = withApiHandler(
  'POST /api/appointments/resources/[id]/rules',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId, branchId } =
      await requireBranchPermission('appointment:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = addRuleSchema.parse(body);

    const service = AppointmentsService.forScope({ organizationId, branchId });
    await service.addAvailabilityRule(id, input);

    return jsonSuccess({ ok: true }, { status: 201, correlationId });
  },
);
