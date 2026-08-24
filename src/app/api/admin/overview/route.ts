import { requireAdminRequest } from '@/features/admin/admin-auth';
import { adminService } from '@/features/admin/admin.service';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const GET = withApiHandler(
  'GET /api/admin/overview',
  async (_request, { correlationId }) => {
    await requireAdminRequest();
    return jsonSuccess({ overview: await adminService.overview() }, { correlationId });
  },
);
