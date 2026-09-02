import { requireOrg, requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler, type RouteParams } from '@/server/api-handler';
import { InboxService } from '@/features/inbox/services/inbox.service';
import { createNoteSchema } from '@/features/inbox/validators/inbox.validators';

/**
 * GET  /api/inbox/conversations/[id]/notes — internal notes on a conversation
 * POST /api/inbox/conversations/[id]/notes — add one (never sent to the contact)
 */

type Params = { id: string };

export const GET = withApiHandler(
  'GET /api/inbox/conversations/[id]/notes',
  async (_request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { organizationId } = await requireOrg();
    const { id } = await routeParams.params;

    const service = InboxService.forOrganization(organizationId);
    const notes = await service.listNotes(id);

    return jsonSuccess({ notes }, { correlationId });
  },
);

export const POST = withApiHandler(
  'POST /api/inbox/conversations/[id]/notes',
  async (request, { correlationId }, routeParams: RouteParams<Params>) => {
    const { user, organizationId } = await requirePermission('conversation:write');
    const { id } = await routeParams.params;

    const body: unknown = await request.json();
    const input = createNoteSchema.parse(body);

    const service = InboxService.forOrganization(organizationId);
    const note = await service.createNote(id, user.id, input.body);

    return jsonSuccess(note, { status: 201, correlationId });
  },
);
