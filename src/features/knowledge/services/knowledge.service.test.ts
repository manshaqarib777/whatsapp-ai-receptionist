// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';
import type { KnowledgeRepository } from '@/features/knowledge/repositories/knowledge.repository';
import { ConflictError, UnprocessableError } from '@/lib/errors';

/**
 * Knowledge service unit tests.
 *
 * The service is pure orchestration over the repository, so these fake the
 * repository methods and assert the lifecycle rules: approval requires a pending
 * version, archiving is explicit, FAQ needs entries.
 */

function fakeRepo(overrides: Partial<KnowledgeRepository> = {}): KnowledgeRepository {
  return {
    organizationId: 'org-a',
    ...overrides,
  } as unknown as KnowledgeRepository;
}

describe('KnowledgeService — FAQ source', () => {
  it('requires at least one FAQ entry', async () => {
    const service = new KnowledgeService(fakeRepo());
    await expect(
      service.createSource({ kind: 'faq', name: 'FAQ', faq: [] }),
    ).rejects.toThrow(UnprocessableError);
  });

  it('creates a source, document, version, and ingests synchronously', async () => {
    const repo = fakeRepo({
      resolveDefaultBranch: vi.fn(async () => 'branch-1'),
      createSource: vi.fn(async (input) => ({
        id: 'src-1',
        kind: input.kind,
        name: input.name,
        documentCount: 0,
        createdAt: new Date(),
      })),
      createDocument: vi.fn(async () => ({ id: 'doc-1', branchId: 'branch-1' })),
      createVersion: vi.fn(async () => ({ id: 'ver-1' })),
    });

    // ingestVersion is called by createFaqSource; stub the real method.
    vi.spyOn(KnowledgeService.prototype, 'ingestVersion').mockResolvedValue({
      chunkCount: 1,
    });

    const service = new KnowledgeService(repo);
    const result = await service.createSource({
      kind: 'faq',
      name: 'FAQ',
      faq: [{ question: 'Q?', answer: 'A.' }],
    });

    expect(result.source.id).toBe('src-1');
    expect(result.documentId).toBe('doc-1');
    expect(repo.createSource).toHaveBeenCalledWith({
      kind: 'faq',
      name: 'FAQ',
      branchId: 'branch-1',
    });

    vi.restoreAllMocks();
  });
});

describe('KnowledgeService — approval lifecycle', () => {
  it('approves only a pending version', async () => {
    const repo = fakeRepo({
      getVersion: vi.fn(async () => ({
        id: 'ver-1',
        documentId: 'doc-1',
        status: 'draft' as const,
      })),
    });
    const service = new KnowledgeService(repo);

    await expect(service.approveVersion('ver-1', 'user-1')).rejects.toThrow(
      ConflictError,
    );
  });

  it('approves a pending version and sets it current', async () => {
    const repo = fakeRepo({
      getVersion: vi.fn(async () => ({
        id: 'ver-1',
        documentId: 'doc-1',
        status: 'pending_approval' as const,
      })),
      transitionVersionStatus: vi.fn(async () => ({
        id: 'ver-1',
        documentId: 'doc-1',
        status: 'approved' as const,
      })),
      setCurrentVersion: vi.fn(async () => undefined),
    });
    const service = new KnowledgeService(repo);

    await service.approveVersion('ver-1', 'user-1');

    expect(repo.transitionVersionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        versionId: 'ver-1',
        from: 'pending_approval',
        to: 'approved',
        approvedById: 'user-1',
      }),
    );
    expect(repo.setCurrentVersion).toHaveBeenCalledWith('doc-1', 'ver-1');
  });

  it('archives only pending or approved versions', async () => {
    const repo = fakeRepo({
      getVersion: vi.fn(async () => ({
        id: 'ver-1',
        documentId: 'doc-1',
        status: 'draft' as const,
      })),
    });
    const service = new KnowledgeService(repo);

    await expect(service.archiveVersion('ver-1')).rejects.toThrow(ConflictError);
  });
});

describe('KnowledgeService — website source', () => {
  it('requires a URL', async () => {
    const service = new KnowledgeService(fakeRepo());
    await expect(service.createSource({ kind: 'website', name: 'Site' })).rejects.toThrow(
      UnprocessableError,
    );
  });
});
