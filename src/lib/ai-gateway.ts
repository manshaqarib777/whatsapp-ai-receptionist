import { createHash } from 'node:crypto';

import { env } from '@/lib/env';

/**
 * AI Gateway — Milestone 7 (AD-2). The first real AI module.
 *
 * `AI_ENGINE_RULES.md` addresses models as `"provider/model"` strings and forbids
 * hardcoding a provider SDK. This module is the seam: M7 only needs embeddings;
 * M8 builds the full engine (LLM, prompts, tools, cost tracking) behind the same
 * interface.
 *
 * ## Embedding providers
 *
 * - `openai` — text-embedding-3-small via the OpenAI SDK (1536-dim, matching the
 *   schema's `vector(1536)`). Requires `OPENAI_API_KEY`.
 * - `local` — a deterministic hash embedder. No key, unit-testable, used by the
 *   test suite and seed so they never depend on an external service. The vectors
 *   are NOT semantically meaningful — the real provider is required for live
 *   ingestion. `embeddingModel` is recorded per chunk so a later switch to the
 *   real provider is a re-embedding job, not a redesign.
 */

export type Embedding = {
  vector: number[];
  /** The `"provider/model"` string recorded on the chunk. */
  model: string;
};

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<Embedding[]>;
}

// ---------------------------------------------------------------------------
// OpenAI provider
// ---------------------------------------------------------------------------

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<Embedding[]> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

    const response = await client.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: texts,
    });

    return response.data.map((item) => ({
      vector: item.embedding,
      model: `openai/${env.EMBEDDING_MODEL}`,
    }));
  }
}

// ---------------------------------------------------------------------------
// Local deterministic provider
// ---------------------------------------------------------------------------

const LOCAL_DIMENSIONS = 1536;

/**
 * Deterministic hash embedder — same input always yields the same vector.
 * Hash each token n-gram into a fixed-dimension feature vector with a
 * sign-projection, so similar text lands near similar vectors (bag-of-words
 * style). Semantically weak by design; the seed and tests only need
 * determinism + the right shape.
 */
class LocalEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<Embedding[]> {
    return texts.map((text) => ({ vector: embedLocal(text), model: 'local/hash' }));
  }
}

export function embedLocal(text: string): number[] {
  const vector = new Array<number>(LOCAL_DIMENSIONS).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as string;
    // 3-gram context so ordering contributes slightly.
    const gram = `${tokens[i - 1] ?? ''} ${token} ${tokens[i + 1] ?? ''}`;
    const digest = createHash('sha256').update(gram).digest();
    const bucket = digest.readUInt32BE(0) % LOCAL_DIMENSIONS;
    // Sign from a second byte so equal-frequency tokens don't cancel.
    const sign = (digest[4] ?? 0) % 2 === 0 ? 1 : -1;
    vector[bucket] = (vector[bucket] ?? 0) + sign;
  }

  return vector;
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export function embeddingProvider(): EmbeddingProvider {
  if (env.EMBEDDING_PROVIDER === 'openai') {
    return new OpenAIEmbeddingProvider();
  }
  return new LocalEmbeddingProvider();
}

/** The model string the current provider records on chunks. */
export function currentEmbeddingModel(): string {
  return env.EMBEDDING_PROVIDER === 'openai'
    ? `openai/${env.EMBEDDING_MODEL}`
    : 'local/hash';
}
