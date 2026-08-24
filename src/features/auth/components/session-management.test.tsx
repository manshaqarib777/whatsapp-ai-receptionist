import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionManagement } from '@/features/auth/components/session-management';

const listSessions = vi.fn();
const revokeSession = vi.fn();

vi.mock('@/features/auth/services/account.client', () => ({
  listAccountSessions: (...args: unknown[]) => listSessions(...args),
  revokeAccountSession: (...args: unknown[]) => revokeSession(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  listSessions.mockResolvedValue([
    {
      id: 'current',
      token: 'current-token',
      createdAt: new Date(),
      expiresAt: new Date(),
      userAgent: 'Current browser',
    },
    {
      id: 'other',
      token: 'other-token',
      createdAt: new Date(),
      expiresAt: new Date(),
      userAgent: 'Other browser',
    },
  ]);
  revokeSession.mockResolvedValue(undefined);
});

describe('SessionManagement', () => {
  it('labels the current device and revokes another session', async () => {
    const user = userEvent.setup();
    render(<SessionManagement currentSessionId="current" />);
    expect(await screen.findByText('Current browser')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(revokeSession).toHaveBeenCalledWith('other-token');
    expect(screen.queryByText('Other browser')).not.toBeInTheDocument();
  });

  it('renders a recoverable loading error', async () => {
    listSessions.mockRejectedValue(new Error('Could not load your sessions.'));
    render(<SessionManagement currentSessionId="current" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your sessions.',
    );
  });
});
