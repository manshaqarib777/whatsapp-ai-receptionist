import { requireAdminRequest } from '@/features/admin/admin-auth';
import { adminService } from '@/features/admin/admin.service';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const GET = withApiHandler(
  'GET /api/admin/ai-usage',
  async (_request, { correlationId }) => {
    await requireAdminRequest();
    return jsonSuccess({ usage: await adminService.aiUsage() }, { correlationId });
  },
);
