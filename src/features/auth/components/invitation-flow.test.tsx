import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AcceptInvitation } from '@/features/auth/components/accept-invitation';
import { InviteMemberForm } from '@/features/auth/components/invite-member-form';

const push = vi.fn();
const refresh = vi.fn();
const inviteMember = vi.fn();
const acceptInvitation = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/features/auth/services/members.client', () => ({
  inviteMember: (...args: unknown[]) => inviteMember(...args),
}));
vi.mock('@/features/auth/services/account.client', () => ({
  acceptOrganizationInvitation: (...args: unknown[]) => acceptInvitation(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  inviteMember.mockResolvedValue(undefined);
  acceptInvitation.mockResolvedValue(undefined);
});

describe('invitation flow', () => {
  it('submits a normalized member invitation and reports success', async () => {
    const user = userEvent.setup();
    render(<InviteMemberForm />);
    await user.type(screen.getByLabelText(/email address/i), 'colleague@example.com');
    await user.selectOptions(screen.getByLabelText(/^role$/i), 'viewer');
    await user.click(screen.getByRole('button', { name: /send invite/i }));
    expect(inviteMember).toHaveBeenCalledWith('colleague@example.com', 'viewer');
    expect(await screen.findByRole('status')).toHaveTextContent('Invitation sent');
  });

  it('accepts an invitation then returns to the dashboard', async () => {
    const user = userEvent.setup();
    render(<AcceptInvitation invitationId="00000000-0000-0000-0000-000000000001" />);
    await user.click(screen.getByRole('button', { name: /accept invitation/i }));
    expect(acceptInvitation).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001');
    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(refresh).toHaveBeenCalled();
  });
});
