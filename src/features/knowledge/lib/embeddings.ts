import {
  currentEmbeddingModel,
  embeddingProvider,
  type Embedding,
} from '@/lib/ai-gateway';

/**
 * Knowledge-base embedding seam (AD-2).
 *
 * Thin re-export over the AI Gateway so the feature depends on the gateway's
 * `EmbeddingProvider` interface and never on a provider SDK. `currentEmbeddingModel`
 * is the `"provider/model"` string recorded on every chunk, which makes a future
 * provider switch a re-embedding job rather than a redesign.
 */

export type { Embedding };

export const knowledgeEmbeddingProvider = embeddingProvider;
export const knowledgeEmbeddingModel = currentEmbeddingModel;
