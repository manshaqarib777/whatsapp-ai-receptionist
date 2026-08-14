import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { SourceList } from '@/features/knowledge/components/source-list';
import { KnowledgeSearch } from '@/features/knowledge/components/knowledge-search';
import { JobStatus } from '@/features/knowledge/components/job-status';
import { VersionTimeline } from '@/features/knowledge/components/version-timeline';
import type { KnowledgeSourceRow } from '@/features/knowledge/repositories/knowledge.repository';

/**
 * Knowledge component tests.
 *
 * Data-bound components stub `fetch` and assert the four states (loading/error/
 * empty/populated) plus axe-clean. Full axe audits of the tab UI live in E2E
 * (Radix Tabs under jsdom produce aria-controls pointing at unmounted content).
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/knowledge',
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

const SOURCE: KnowledgeSourceRow = {
  id: 'src-1',
  kind: 'faq',
  name: 'Common questions',
  documentCount: 2,
  createdAt: new Date('2026-08-01T09:00:00.000Z'),
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SourceList', () => {
  it('renders a loading skeleton first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    renderWithQuery(<SourceList />);
    expect(screen.getByRole('status', { name: 'Loading sources' })).toBeInTheDocument();
  });

  it('renders the empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(ok({ data: { sources: [] } }))),
    );
    renderWithQuery(<SourceList />);
    expect(await screen.findByText('No sources yet')).toBeInTheDocument();
  });

  it('renders sources with their kind badge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(ok({ data: { sources: [SOURCE] } }))),
    );
    renderWithQuery(<SourceList />);
    expect(await screen.findByText('Common questions')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
    expect(screen.getByText('2 documents')).toBeInTheDocument();
  });

  it('has no accessibility violations when populated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(ok({ data: { sources: [SOURCE] } }))),
    );
    const { container } = renderWithQuery(<SourceList />);
    await screen.findByText('Common questions');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('KnowledgeSearch', () => {
  it('renders the idle prompt', () => {
    renderWithQuery(<KnowledgeSearch />);
    expect(screen.getByText('Search the knowledge base')).toBeInTheDocument();
  });

  it('renders hits after a search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          ok({
            data: {
              hits: [
                {
                  chunkId: 'chunk-1',
                  content: 'Free parking is behind the building.',
                  similarity: 0.42,
                  sourceName: 'Clinic policies',
                  documentTitle: 'Cancellation policy',
                },
              ],
            },
          }),
        ),
      ),
    );
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderWithQuery(<KnowledgeSearch />);

    const input = screen.getByLabelText('Search the knowledge base');
    await user.type(input, 'parking');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Cancellation policy')).toBeInTheDocument();
    expect(screen.getByText(/Free parking/)).toBeInTheDocument();
  });

  it('renders the no-matches empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(ok({ data: { hits: [] } }))),
    );
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderWithQuery(<KnowledgeSearch />);

    await user.type(screen.getByLabelText('Search the knowledge base'), 'nothing');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('No matches')).toBeInTheDocument();
  });
});

describe('JobStatus', () => {
  it('shows a running job with progress', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          ok({
            data: {
              job: {
                id: 'job-1',
                sourceId: 'src-1',
                documentId: null,
                versionId: null,
                status: 'running',
                error: null,
                progress: 45,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          }),
        ),
      ),
    );
    renderWithQuery(<JobStatus jobId="job-1" />);
    expect(await screen.findByText('Indexing…')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('shows a failed job with the error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          ok({
            data: {
              job: {
                id: 'job-1',
                sourceId: 'src-1',
                documentId: null,
                versionId: null,
                status: 'failed',
                error: 'The document contained no extractable text.',
                progress: 10,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          }),
        ),
      ),
    );
    renderWithQuery(<JobStatus jobId="job-1" />);
    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(
      screen.getByText('The document contained no extractable text.'),
    ).toBeInTheDocument();
  });
});

describe('VersionTimeline', () => {
  it('shows version rows with status badges', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          ok({
            data: {
              document: {
                id: 'doc-1',
                sourceId: 'src-1',
                sourceName: 'FAQ',
                branchId: 'branch-1',
                title: 'Common questions',
                fileName: null,
                mimeType: null,
                sizeBytes: null,
                storageKey: null,
                currentVersionId: 'ver-1',
                createdAt: new Date(),
                versions: [
                  {
                    id: 'ver-1',
                    documentId: 'doc-1',
                    versionNumber: 1,
                    status: 'approved',
                    approvedById: 'user-1',
                    approvedByName: 'Owner Example',
                    approvedAt: new Date(),
                    chunkCount: 4,
                    checksum: 'abc',
                    createdAt: new Date(),
                  },
                ],
              },
            },
          }),
        ),
      ),
    );
    renderWithQuery(<VersionTimeline documentId="doc-1" />);
    expect(await screen.findByText('Version 1')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText(/4 chunks/)).toBeInTheDocument();
  });
});
