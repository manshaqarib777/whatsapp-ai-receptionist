import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BranchesSettings } from './branches-settings';

const refresh = vi.fn();
const createBranch = vi.fn();
const makeDefault = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/features/organizations/services/branches.client', () => ({
  createBranch: (...args: unknown[]) => createBranch(...args),
  makeDefault: (...args: unknown[]) => makeDefault(...args),
  updateBranch: vi.fn(),
}));

const branches = [
  {
    id: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    name: 'Main',
    slug: 'main',
    timezone: 'Asia/Riyadh',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    name: 'Jeddah',
    slug: 'jeddah',
    timezone: 'Asia/Riyadh',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  createBranch.mockResolvedValue({});
  makeDefault.mockResolvedValue({});
});

describe('BranchesSettings', () => {
  it('creates a branch and exposes default management', async () => {
    const user = userEvent.setup();
    render(<BranchesSettings branches={branches} canManage />);
    await user.type(screen.getByLabelText('Branch name'), 'Dammam');
    await user.click(screen.getByRole('button', { name: 'Add branch' }));
    expect(createBranch).toHaveBeenCalledWith({
      name: 'Dammam',
      timezone: 'Asia/Riyadh',
    });
    await user.click(screen.getByRole('button', { name: 'Make default' }));
    expect(makeDefault).toHaveBeenCalledWith(branches[1]?.id);
  });

  it('hides mutations from read-only members', () => {
    render(<BranchesSettings branches={branches} canManage={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Main (Default)')).toBeInTheDocument();
  });
});
