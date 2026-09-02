import { CrmService } from '@/features/crm/services/crm.service';
import { updateCompanySchema } from '@/features/crm/validators/crm.validators';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';
import { requireOrg, requirePermission } from '@/server/auth-context';

export const GET = withApiHandler<{ id: string }>(
  'GET /api/crm/companies/[id]',
  async (_request, { correlationId }, { params }) => {
    const { organizationId } = await requireOrg();
    const { id } = await params;
    const company = await CrmService.forOrganization(organizationId).getCompany(id);
    return jsonSuccess({ company }, { correlationId });
  },
);

export const PATCH = withApiHandler<{ id: string }>(
  'PATCH /api/crm/companies/[id]',
  async (request, { correlationId }, { params }) => {
    const { organizationId } = await requirePermission('crm:write');
    const { id } = await params;
    const input = updateCompanySchema.parse(await request.json());
    const company = await CrmService.forOrganization(organizationId).updateCompany(
      id,
      input,
    );
    return jsonSuccess({ company }, { correlationId });
  },
);
