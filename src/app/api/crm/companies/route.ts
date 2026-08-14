import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { CrmService } from '@/features/crm/services/crm.service';
import {
  createCompanySchema,
  updateCompanySchema,
} from '@/features/crm/validators/crm.validators';

/**
 * GET  /api/crm/companies — companies (`crm:read`).
 * POST /api/crm/companies — create a company (`crm:write`).
 */

export const GET = withApiHandler(
  'GET /api/crm/companies',
  async (_request, { correlationId }) => {
    const { organizationId } = await requireOrg();
    const service = CrmService.forOrganization(organizationId);
    const companies = await service.listCompanies();
    return jsonSuccess({ companies }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/crm/companies',
  async (request, { correlationId }) => {
    const { organizationId } = await requirePermission('crm:write');
    const body: unknown = await request.json();
    const input = createCompanySchema.parse(body);

    const service = CrmService.forOrganization(organizationId);
    const company = await service.createCompany(input);

    return jsonSuccess({ company }, { status: 201, correlationId });
  },
);

type Params = { id: string };

export const PATCH = withApiHandler(
  'PATCH /api/crm/companies/[id]',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requirePermission('crm:write');
    const { id } = await routeParams.params;
    const body: unknown = await request.json();
    const input = updateCompanySchema.parse(body);

    const service = CrmService.forOrganization(organizationId);
    const company = await service.updateCompany(id, input);

    return jsonSuccess({ company }, { correlationId });
  },
);
