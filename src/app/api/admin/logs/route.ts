import { requireAdminRequest } from '@/features/admin/admin-auth';
import { adminService } from '@/features/admin/admin.service';
import { parseAdminPage } from '@/features/admin/admin.validators';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const GET = withApiHandler(
  'GET /api/admin/logs',
  async (request, { correlationId }) => {
    await requireAdminRequest();
    return jsonSuccess(
      { logs: await adminService.logs(parseAdminPage(request.url)) },
      { correlationId },
    );
  },
);
