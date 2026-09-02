import { requireAdminRequest } from '@/features/admin/admin-auth';
import { adminService } from '@/features/admin/admin.service';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const GET = withApiHandler(
  'GET /api/admin/monitoring',
  async (_request, { correlationId }) => {
    await requireAdminRequest();
    return jsonSuccess(
      { monitoring: await adminService.monitoring() },
      { correlationId },
    );
  },
);
