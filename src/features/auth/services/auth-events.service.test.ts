import { beforeEach, describe, expect, it, vi } from 'vitest';

const record = vi.fn();
vi.mock('@/features/auth/services/audit-log.service', () => ({
  record: (...args: unknown[]) => record(...args),
}));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/db/auth/invitations.repository', () => ({
  invitationsRepository: { findScope: vi.fn() },
}));

import { recordAuthEvent } from '@/features/auth/services/auth-events.service';

beforeEach(() => vi.clearAllMocks());

describe('auth event auditing', () => {
  it.each([
    ['/sign-out', 'auth.sign_out'],
    ['/change-password', 'auth.password_changed'],
    ['/two-factor/enable', 'auth.two_factor_enabled'],
    ['/two-factor/disable', 'auth.two_factor_disabled'],
    ['/revoke-session', 'auth.session_revoked'],
    ['/revoke-sessions', 'auth.all_sessions_revoked'],
  ] as const)('maps %s to %s', async (path, action) => {
    await recordAuthEvent(new Request('http://localhost/api/auth' + path), path, {
      actorId: '00000000-0000-0000-0000-000000000001',
      organizationId: '00000000-0000-0000-0000-000000000002',
      invitation: null,
    });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action }));
  });

  it('records invitation acceptance in the invitation organization', async () => {
    await recordAuthEvent(
      new Request('http://localhost/api/auth/organization/accept-invitation'),
      '/organization/accept-invitation',
      {
        actorId: '00000000-0000-0000-0000-000000000001',
        organizationId: null,
        invitation: {
          id: '00000000-0000-0000-0000-000000000003',
          organizationId: '00000000-0000-0000-0000-000000000002',
        },
      },
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'member.joined', entityType: 'invitation' }),
    );
  });
});
