import { invitationsRepository } from '@/lib/db/auth/invitations.repository';
import * as auditLog from '@/features/auth/services/audit-log.service';
import { auth } from '@/lib/auth';

type EventContext = {
  actorId: string | null;
  organizationId: string | null;
  invitation: { id: string; organizationId: string } | null;
};

export async function captureAuthEventContext(
  request: Request,
  path: string,
  body: Record<string, unknown> | null,
): Promise<EventContext> {
  const session = await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null);
  const invitationId =
    path === '/organization/accept-invitation' &&
    typeof body?.['invitationId'] === 'string'
      ? body['invitationId']
      : null;
  const invitation = invitationId
    ? await invitationsRepository.findScope(invitationId)
    : null;
  return {
    actorId: session?.user.id ?? null,
    organizationId: session?.session.activeOrganizationId ?? null,
    invitation,
  };
}

const EVENT_ACTIONS = {
  '/sign-out': 'auth.sign_out',
  '/change-password': 'auth.password_changed',
  '/reset-password': 'auth.password_reset_completed',
  '/two-factor/enable': 'auth.two_factor_enabled',
  '/two-factor/disable': 'auth.two_factor_disabled',
  '/revoke-session': 'auth.session_revoked',
  '/revoke-sessions': 'auth.all_sessions_revoked',
} as const;

export async function recordAuthEvent(
  request: Request,
  path: string,
  context: EventContext,
): Promise<void> {
  const action = EVENT_ACTIONS[path as keyof typeof EVENT_ACTIONS];
  if (action) {
    await auditLog.record({
      action,
      actorId: context.actorId,
      organizationId: context.organizationId,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: request.headers.get('user-agent'),
    });
  }

  if (path === '/organization/accept-invitation' && context.invitation) {
    await auditLog.record({
      action: 'member.joined',
      actorId: context.actorId,
      organizationId: context.invitation.organizationId,
      entityType: 'invitation',
      entityId: context.invitation.id,
      userAgent: request.headers.get('user-agent'),
    });
  }
}
