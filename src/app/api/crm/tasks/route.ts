import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { CrmService } from '@/features/crm/services/crm.service';
import {
  createTaskSchema,
  taskStatusSchema,
} from '@/features/crm/validators/crm.validators';

/**
 * GET  /api/crm/tasks?status= — tasks (`crm:read`).
 * POST /api/crm/tasks — create a task (`crm:write`).
 */

export const GET = withApiHandler(
  'GET /api/crm/tasks',
  async (request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const service = CrmService.forOrganization(organizationId);
    const tasks = await service.listTasks(
      status && status !== 'all' ? { status: taskStatusSchema.parse(status) } : undefined,
    );

    return jsonSuccess({ tasks }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/crm/tasks',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('crm:write');
    const body: unknown = await request.json();
    const input = createTaskSchema.parse(body);

    const service = CrmService.forOrganization(organizationId);
    const task = await service.createTask(input);

    return jsonSuccess({ task }, { status: 201, correlationId });
  },
);
