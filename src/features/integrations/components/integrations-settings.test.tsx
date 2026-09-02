import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { IntegrationsSettings } from './integrations-settings';

const refresh = vi.fn();
const configure = vi.fn().mockResolvedValue({});
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('../services/integrations.client', () => ({
  configureIntegration: (...args: unknown[]) => configure(...args),
  testIntegration: vi.fn(),
  disconnectIntegration: vi.fn(),
}));

const items = [
  {
    provider: 'google',
    name: 'Google',
    description: 'Calendar availability and events.',
    capabilities: ['calendar'],
    fields: [{ key: 'calendarId', label: 'Calendar ID', placeholder: 'demo@test.local' }],
    connection: null,
  },
];

describe('IntegrationsSettings', () => {
  it('configures a sandbox provider with labelled controls', async () => {
    const user = userEvent.setup();
    render(<IntegrationsSettings items={items} canManage />);
    await user.type(screen.getByLabelText('Calendar ID'), 'appointments@demo.test');
    await user.click(screen.getByRole('button', { name: 'Configure sandbox' }));
    expect(configure).toHaveBeenCalledWith('google', {
      enabled: true,
      mode: 'sandbox',
      config: { calendarId: 'appointments@demo.test' },
    });
  });
  it('is read-only and accessible for non-admin members', async () => {
    const { container } = render(
      <IntegrationsSettings items={items} canManage={false} />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
