import { ConflictError, UnprocessableError } from '@/lib/errors';
import { chunkText, checksum } from '@/features/knowledge/services/chunker';
import { fetchWebsiteText, parseUpload } from '@/features/knowledge/services/parsers';
import {
  KnowledgeRepository,
  type KnowledgeDocumentDetail,
  type KnowledgeJobRow,
  type KnowledgeSourceKind,
  type KnowledgeSourceRow,
} from '@/features/knowledge/repositories/knowledge.repository';
import {
  hybridSearch,
  insertChunks,
  type SearchHit,
} from '@/features/knowledge/lib/retrieval';
import {
  knowledgeEmbeddingModel,
  knowledgeEmbeddingProvider,
} from '@/features/knowledge/lib/embeddings';

/**
 * Knowledge base orchestration — Milestone 7.
 *
 * Pure orchestration: the repository returns raw rows, and this service composes
 * them into the shapes the UI renders and runs the ingestion pipeline steps. The
 * ingestion steps are exported as plain async functions so the integration test
 * drives the worker's exact code path without faking timers or a queue.
 *
 * No database access here beyond the repository.
 */

export class KnowledgeService {
  private readonly repo: KnowledgeRepository;
  private readonly organizationId: string;

  constructor(repo: KnowledgeRepository) {
    this.repo = repo;
    this.organizationId = repo.organizationId;
  }

  static forOrganization(organizationId: string): KnowledgeService {
    return new KnowledgeService(KnowledgeRepository.forOrganization(organizationId));
  }

  // -------------------------------------------------------------------------
  // Sources
  // -------------------------------------------------------------------------

  async listSources(): Promise<KnowledgeSourceRow[]> {
    return this.repo.listSources();
  }

  async getSource(
    id: string,
  ): Promise<Awaited<ReturnType<KnowledgeRepository['getSource']>>> {
    return this.repo.getSource(id);
  }

  /** Creates a source. FAQ ingests synchronously; website/upload enqueue a job. */
  async createSource(input: {
    kind: KnowledgeSourceKind;
    name: string;
    url?: string;
    faq?: { question: string; answer: string }[];
    branchId?: string;
  }): Promise<{
    source: KnowledgeSourceRow;
    documentId?: string;
    versionId?: string;
    jobId?: string;
  }> {
    if (input.kind === 'faq') {
      return this.createFaqSource(input);
    }
    if (input.kind === 'website') {
      return this.createWebsiteSource(input);
    }
    // upload/pdf/docx/csv: the source shell only — a document + job follow via
    // `enqueueUpload` once the file arrives.
    const branchId = input.branchId ?? (await this.repo.resolveDefaultBranch());
    const source = await this.repo.createSource({
      kind: input.kind,
      name: input.name,
      branchId,
    });
    return { source };
  }

  private async createFaqSource(input: {
    name: string;
    faq?: { question: string; answer: string }[];
    branchId?: string;
  }): Promise<{
    source: KnowledgeSourceRow;
    documentId: string;
    versionId: string;
    jobId: string;
  }> {
    const entries = input.faq;
    if (!entries || entries.length === 0) {
      throw new UnprocessableError('An FAQ source needs at least one entry.');
    }

    const branchId = input.branchId ?? (await this.repo.resolveDefaultBranch());
    const source = await this.repo.createSource({
      kind: 'faq',
      name: input.name,
      branchId,
    });

    // The FAQ entries ARE the document text.
    const text = entries
      .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)
      .join('\n\n');

    const document = await this.repo.createDocument({
      sourceId: source.id,
      branchId,
      title: input.name,
    });

    const version = await this.repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: text,
    });

    // FAQ content is small and embedded synchronously — no job, no worker.
    await this.ingestVersion({
      documentId: document.id,
      versionId: version.id,
      branchId,
      extractedText: text,
    });

    return { source, documentId: document.id, versionId: version.id, jobId: '' };
  }

  private async createWebsiteSource(input: {
    name: string;
    url?: string;
    branchId?: string;
  }): Promise<{
    source: KnowledgeSourceRow;
    documentId: string;
    versionId: string;
    jobId: string;
  }> {
    if (!input.url) {
      throw new UnprocessableError('A website source needs a URL.');
    }

    const branchId = input.branchId ?? (await this.repo.resolveDefaultBranch());
    const source = await this.repo.createSource({
      kind: 'website',
      name: input.name,
      branchId,
    });

    // The schema has no URL column on a source; the URL is recorded as the
    // document title and the worker fetches it from there (a real column lands
    // with website source management in a later milestone).
    const document = await this.repo.createDocument({
      sourceId: source.id,
      branchId,
      title: input.url,
    });

    const version = await this.repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: '',
    });

    const job = await this.repo.createJob({
      sourceId: source.id,
      documentId: document.id,
      versionId: version.id,
    });

    return { source, documentId: document.id, versionId: version.id, jobId: job.id };
  }

  /** Enqueues a PDF/DOCX/CSV upload against an existing source. */
  async enqueueUpload(input: {
    sourceId: string;
    title: string;
    fileName: string;
    mimeType: string;
    storageKey: string;
    sizeBytes: bigint;
  }): Promise<{ documentId: string; versionId: string; jobId: string }> {
    await this.repo.assertSourceExists(input.sourceId);
    const branchId = await this.repo.resolveDefaultBranch();

    const document = await this.repo.createDocument({
      sourceId: input.sourceId,
      branchId,
      title: input.title,
      fileName: input.fileName,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      sizeBytes: input.sizeBytes,
    });

    // The route creates the version row (draft) before enqueueing — the worker
    // fills chunks and marks it processed.
    const version = await this.repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: '',
    });

    const job = await this.repo.createJob({
      sourceId: input.sourceId,
      documentId: document.id,
      versionId: version.id,
    });

    return { documentId: document.id, versionId: version.id, jobId: job.id };
  }

  // -------------------------------------------------------------------------
  // Documents + versions + approval
  // -------------------------------------------------------------------------

  async getDocument(id: string): Promise<KnowledgeDocumentDetail> {
    return this.repo.getDocument(id);
  }

  async submitVersion(versionId: string): Promise<void> {
    await this.repo.transitionVersionStatus({
      versionId,
      from: 'draft',
      to: 'pending_approval',
    });
  }

  async approveVersion(versionId: string, approverId: string): Promise<void> {
    const version = await this.repo.getVersion({ versionId });

    if (version.status !== 'pending_approval') {
      throw new ConflictError('Only a version awaiting approval can be approved.');
    }

    await this.repo.transitionVersionStatus({
      versionId,
      from: 'pending_approval',
      to: 'approved',
      approvedById: approverId,
      approvedAt: new Date(),
    });

    // Point the document's current version at this one — the retrieval gate.
    await this.repo.setCurrentVersion(version.documentId, versionId);
  }

  async archiveVersion(versionId: string): Promise<void> {
    const version = await this.repo.getVersion({ versionId });
    if (version.status !== 'pending_approval' && version.status !== 'approved') {
      throw new ConflictError('Only a pending or approved version can be archived.');
    }
    await this.repo.transitionVersionStatus({
      versionId,
      from: version.status,
      to: 'archived',
    });
  }

  // -------------------------------------------------------------------------
  // Ingestion pipeline
  // -------------------------------------------------------------------------

  /**
   * Runs the parse → chunk → embed → persist pipeline for a version.
   *
   * Shared by the FAQ path (synchronous) and the worker (for uploads/websites).
   */
  async ingestVersion(input: {
    documentId: string;
    versionId: string;
    branchId: string;
    extractedText: string;
  }): Promise<{ chunkCount: number }> {
    const text = input.extractedText.trim();
    if (text.length === 0) {
      throw new UnprocessableError('The document contained no text to index.');
    }

    const chunks = chunkText(text);
    const model = knowledgeEmbeddingModel();
    const provider = knowledgeEmbeddingProvider();

    const embeddings = await provider.embed(chunks.map((c) => c.content));

    await insertChunks(
      { organizationId: this.organizationId, branchId: input.branchId },
      {
        versionId: input.versionId,
        branchId: input.branchId,
        chunks: chunks.map((chunk, index) => ({
          ordinal: chunk.ordinal,
          content: chunk.content,
          vector: embeddings[index]?.vector ?? [],
          model,
        })),
      },
    );

    await this.repo.updateVersionChunks({
      versionId: input.versionId,
      chunkCount: chunks.length,
      checksum: checksum(text),
    });

    return { chunkCount: chunks.length };
  }

  /** Extracts text for an upload (parse → OCR fallback). */
  async extractUploadText(input: {
    storageKey: string;
    mimeType: string;
    fileName: string;
  }): Promise<{ text: string | null; needsOcr: boolean }> {
    const { getStorage } = await import('@/lib/storage');
    const buffer = await getStorage(input.storageKey);
    return parseUpload(buffer, input.mimeType, input.fileName);
  }

  /** Fetches a website's text (worker path). */
  async fetchWebsite(url: string): Promise<string> {
    return fetchWebsiteText(url);
  }

  // -------------------------------------------------------------------------
  // Jobs + search
  // -------------------------------------------------------------------------

  async listJobs(limit = 20): Promise<KnowledgeJobRow[]> {
    return this.repo.listJobs(limit);
  }

  async getJob(id: string): Promise<KnowledgeJobRow> {
    return this.repo.getJob(id);
  }

  async search(q: string, limit = 10): Promise<SearchHit[]> {
    const provider = knowledgeEmbeddingProvider();
    const [embedding] = await provider.embed([q]);
    return hybridSearch(
      { organizationId: this.organizationId, branchId: null },
      q,
      embedding?.vector ?? null,
      limit,
    );
  }
}
