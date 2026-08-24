import { auth } from '@/lib/auth';
import { inviteMemberSchema } from '@/features/auth/validators/auth.validators';
import * as auditLog from '@/features/auth/services/audit-log.service';
import { requirePermission } from '@/server/auth-context';
import { jsonSuccess, withApiHandler } from '@/server/api-handler';

/** POST /api/invitations — invite a member to the active organization. */
export const POST = withApiHandler(
  'POST /api/invitations',
  async (request, { correlationId }) => {
    const context = await requirePermission('member:invite');
    const input = inviteMemberSchema.parse(await request.json());
    const invitation = await auth.api.createInvitation({
      headers: request.headers,
      body: {
        email: input.email,
        role: input.role,
        organizationId: context.organizationId,
      },
    });

    await auditLog.record({
      action: 'member.invited',
      actorId: context.user.id,
      organizationId: context.organizationId,
      entityType: 'invitation',
      entityId: invitation.id,
      userAgent: request.headers.get('user-agent'),
    });

    return jsonSuccess(
      { id: invitation.id, role: invitation.role, status: invitation.status },
      { correlationId, status: 201 },
    );
  },
);
