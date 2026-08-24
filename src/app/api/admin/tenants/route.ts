import { requireAdminRequest } from '@/features/admin/admin-auth';
import { adminService } from '@/features/admin/admin.service';
import { parseAdminPage } from '@/features/admin/admin.validators';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const GET = withApiHandler(
  'GET /api/admin/tenants',
  async (request, { correlationId }) => {
    await requireAdminRequest();
    return jsonSuccess(
      { tenants: await adminService.tenants(parseAdminPage(request.url)) },
      { correlationId },
    );
  },
);
