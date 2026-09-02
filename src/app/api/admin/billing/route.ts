import { requireAdminRequest } from '@/features/admin/admin-auth';
import { adminService } from '@/features/admin/admin.service';
import { parseAdminPage } from '@/features/admin/admin.validators';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

export const GET = withApiHandler(
  'GET /api/admin/billing',
  async (request, { correlationId }) => {
    await requireAdminRequest();
    return jsonSuccess(
      { billing: await adminService.billing(parseAdminPage(request.url)) },
      { correlationId },
    );
  },
);
