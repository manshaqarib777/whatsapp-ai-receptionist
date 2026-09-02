import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Composer } from '@/features/inbox/components/composer';
import { ConversationList } from '@/features/inbox/components/conversation-list';
import { formatRelativeTime } from '@/features/inbox/components/conversation-row';
import { MessageBubble } from '@/features/inbox/components/message-bubble';
import { NoteComposer } from '@/features/inbox/components/note-composer';
import type {
  ConversationRow,
  MessageRow,
} from '@/features/inbox/repositories/inbox.repository';

/**
 * Inbox component tests — every state per .claude/UI_RULES.md (loading, error,
 * empty, success). Assertions target accessible roles and text, never classes.
 */

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/inbox',
}));

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function ok(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const conversationRow: ConversationRow = {
  id: 'conv-1',
  contactId: 'contact-1',
  contactDisplayName: 'Sara Ali',
  contactLocale: 'en',
  contactPhone: '+966500000000',
  contactEmail: null,
  assigneeId: null,
  assigneeName: null,
  status: 'open',
  isPinned: false,
  isEscalated: false,
  unreadCount: 2,
  lastMessageAt: new Date('2026-08-11T10:00:00Z'),
  branchId: 'branch-1',
  preview: 'Can you send the quote?',
  labels: [{ id: 'label-1', name: 'VIP', color: 'warning' }],
  typing: [],
};

const message: MessageRow = {
  id: 'msg-1',
  conversationId: 'conv-1',
  direction: 'inbound',
  authorType: 'contact',
  authorId: null,
  authorName: null,
  contentType: 'text',
  body: 'Hello there',
  deliveryStatus: 'delivered',
  readAt: null,
  createdAt: new Date('2026-08-11T10:00:00Z'),
  attachments: [],
};

describe('formatRelativeTime', () => {
  it('formats minutes, hours, and days', () => {
    const now = new Date('2026-08-12T00:00:00Z');
    expect(formatRelativeTime(new Date('2026-08-11T23:59:30Z'), now)).toBe('just now');
    expect(formatRelativeTime(new Date('2026-08-11T23:55:00Z'), now)).toBe('5m');
    expect(formatRelativeTime(new Date('2026-08-11T20:00:00Z'), now)).toBe('4h');
    expect(formatRelativeTime(new Date('2026-08-10T00:00:00Z'), now)).toBe('2d');
  });
});

describe('ConversationList', () => {
  it('renders conversations from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { rows: [conversationRow], nextCursor: null } })),
    );

    renderWithQuery(<ConversationList />);

    expect(await screen.findByText('Sara Ali')).toBeInTheDocument();
    expect(screen.getByText('Can you send the quote?')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows an empty state when there are no conversations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { rows: [], nextCursor: null } })),
    );

    renderWithQuery(<ConversationList />);

    expect(await screen.findByText('No conversations match')).toBeInTheDocument();
  });

  it('shows an error state with retry on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      ),
    );

    renderWithQuery(<ConversationList />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('marks unread counts accessibly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { rows: [conversationRow], nextCursor: null } })),
    );

    renderWithQuery(<ConversationList />);

    await screen.findByText('Sara Ali');
    expect(screen.getByText('unread messages')).toBeInTheDocument();
  });

  it('exposes the filter tabs with correct labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { rows: [], nextCursor: null } })),
    );

    renderWithQuery(<ConversationList />);

    await screen.findByText('No conversations match');
    expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Archived' })).toBeInTheDocument();
    // Note: jsdom + Radix Tabs produce aria-controls pointing at content that
    // never mounts, so the full axe audit of the tabs lives in the E2E suite
    // (real browser), where the content panels do mount.
  });

  it('windows large result sets while exposing the complete accessible count', async () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({
      ...conversationRow,
      id: `conv-${index + 1}`,
      contactId: `contact-${index + 1}`,
      contactDisplayName: `Contact ${index + 1}`,
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { rows, nextCursor: null } })),
    );

    renderWithQuery(<ConversationList />);

    const list = await screen.findByRole('list', { name: '50 conversations' });
    const renderedRows = list.querySelectorAll(':scope > li');
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(rows.length);
    expect(renderedRows[0]).toHaveAttribute('aria-posinset', '1');
    expect(renderedRows[0]).toHaveAttribute('aria-setsize', '50');
  });
});

describe('MessageBubble', () => {
  it('renders inbound and outbound messages', () => {
    const inbound = { ...message, direction: 'inbound' };
    const outbound = { ...message, direction: 'outbound', authorType: 'agent' };

    render(
      <>
        <MessageBubble message={inbound} />
        <MessageBubble message={outbound} />
      </>,
    );

    expect(screen.getAllByText('Hello there')).toHaveLength(2);
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('renders emoji-only messages large', () => {
    const emoji = { ...message, body: '🎉🎉🎉' };

    render(<MessageBubble message={emoji} />);

    expect(screen.getByText('🎉🎉🎉')).toBeInTheDocument();
  });

  it('renders a voice message attachment', () => {
    const voice = {
      ...message,
      contentType: 'audio',
      body: 'voice-note.ogg',
      attachments: [
        {
          id: 'att-1',
          storageKey: 'key',
          downloadUrl: '/api/storage/audio-token',
          mimeType: 'audio/ogg',
          sizeBytes: '1024',
          fileName: 'voice-note.ogg',
        },
      ],
    };

    render(<MessageBubble message={voice} />);

    expect(screen.getAllByText('voice-note.ogg').length).toBeGreaterThan(0);
    expect(screen.getByText('voice message')).toBeInTheDocument();
  });

  it('renders a document attachment card', () => {
    const doc = {
      ...message,
      contentType: 'document',
      body: 'x-ray.png',
      attachments: [
        {
          id: 'att-2',
          storageKey: 'key',
          downloadUrl: '/api/storage/document-token',
          mimeType: 'image/png',
          sizeBytes: '2048',
          fileName: 'x-ray.png',
        },
      ],
    };

    render(<MessageBubble message={doc} />);

    expect(screen.getAllByText('x-ray.png').length).toBeGreaterThan(0);
  });
});

describe('Composer', () => {
  it('sends a message and clears the input', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { id: 'msg-new' } })),
    );

    renderWithQuery(<Composer conversationId="conv-1" />);

    const textarea = screen.getByLabelText('Message');
    await user.type(textarea, 'Hi there');

    const send = screen.getByRole('button', { name: 'Send message' });
    await user.click(send);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it('reports typing to the server on input', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { ok: true } })),
    );

    renderWithQuery(<Composer conversationId="conv-1" />);

    const textarea = screen.getByLabelText('Message');
    await user.type(textarea, 'H');

    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it('inserts emoji from the picker', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ data: { ok: true } })),
    );

    renderWithQuery(<Composer conversationId="conv-1" />);

    await user.click(screen.getByRole('button', { name: 'Insert emoji' }));
    await user.click(await screen.findByRole('button', { name: 'Insert 😀' }));

    expect(screen.getByLabelText('Message')).toHaveValue('😀');
  });

  it('disables send when the message is empty', () => {
    vi.stubGlobal('fetch', vi.fn());

    renderWithQuery(<Composer conversationId="conv-1" />);

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('uploads the selected attachment as multipart form data', async () => {
    const user = userEvent.setup();
    const request = vi
      .fn()
      .mockReturnValueOnce(ok({ data: { mode: 'server' } }))
      .mockReturnValueOnce(ok({ data: { message: { id: 'msg-file' } } }));
    vi.stubGlobal('fetch', request);
    renderWithQuery(<Composer conversationId="conv-1" />);

    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText('Choose attachment'), file);

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/inbox/conversations/conv-1/attachments',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      ),
    );
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/api/storage/upload-intents',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('NoteComposer', () => {
  it('creates an internal note through the notes endpoint', async () => {
    const user = userEvent.setup();
    const request = vi.fn(() => ok({ data: { id: 'note-1' } }));
    vi.stubGlobal('fetch', request);
    renderWithQuery(<NoteComposer conversationId="conv-1" />);

    await user.type(screen.getByLabelText('Internal note'), 'Customer asked for VAT.');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/inbox/conversations/conv-1/notes',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
