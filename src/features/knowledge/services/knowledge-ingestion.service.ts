import { UnprocessableError } from '@/lib/errors';
import type { KnowledgeRepository } from '@/features/knowledge/repositories/knowledge.repository';
import { chunkText, checksum } from '@/features/knowledge/services/chunker';
import { fetchWebsiteText, parseUpload } from '@/features/knowledge/services/parsers';
import { insertChunks } from '@/features/knowledge/lib/retrieval';
import {
  knowledgeEmbeddingModel,
  knowledgeEmbeddingProvider,
} from '@/features/knowledge/lib/embeddings';

/** Parse/chunk/embed orchestration shared by synchronous FAQs and the worker. */
export class KnowledgeIngestionService {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly organizationId: string,
  ) {}

  async ingestVersion(input: {
    documentId: string;
    versionId: string;
    branchId: string;
    extractedText: string;
  }): Promise<{ chunkCount: number }> {
    const text = input.extractedText.trim();
    if (!text) throw new UnprocessableError('The document contained no text to index.');

    const chunks = chunkText(text);
    const model = knowledgeEmbeddingModel();
    const embeddings = await knowledgeEmbeddingProvider().embed(
      chunks.map(({ content }) => content),
    );

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

  async extractUploadText(input: {
    storageKey: string;
    mimeType: string;
    fileName: string;
  }) {
    const { getStorage } = await import('@/lib/storage');
    return parseUpload(
      await getStorage(input.storageKey),
      input.mimeType,
      input.fileName,
    );
  }

  fetchWebsite(url: string): Promise<string> {
    return fetchWebsiteText(url);
  }
}
