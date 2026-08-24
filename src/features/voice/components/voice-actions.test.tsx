import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { VoiceTranscript } from './voice-actions';

describe('VoiceTranscript', () => {
  it('loads and renders a completed transcript accessibly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            transcriptions: [
              { status: 'completed', text: 'Appointment confirmed.', lastError: null },
            ],
          },
        }),
      }),
    );
    const { container } = render(
      <VoiceTranscript
        messageId={crypto.randomUUID()}
        attachmentId={crypto.randomUUID()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Transcribe voice note' }));
    expect(await screen.findByText(/Appointment confirmed/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    vi.unstubAllGlobals();
  });
});
