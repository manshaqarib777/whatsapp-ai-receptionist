import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PrivacyRequests } from './privacy-requests';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe('PrivacyRequests', () => {
  it('renders completed and pending workflows accessibly', async () => {
    const { container } = render(
      <PrivacyRequests
        targets={[
          { id: 'contact-1', displayName: 'Synthetic Customer', redactedAt: null },
        ]}
        requests={[
          {
            id: 'request-1',
            type: 'erasure',
            status: 'pending',
            contactId: 'contact-1',
            version: 1,
            createdAt: '2026-08-24T00:00:00Z',
            contact: { displayName: 'Synthetic Customer', redactedAt: null },
          },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Erase contact' })).toBeInTheDocument();
    expect(screen.getByLabelText('Erasure confirmation')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
