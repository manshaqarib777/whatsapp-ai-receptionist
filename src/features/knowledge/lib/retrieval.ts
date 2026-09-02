import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { Scope } from '@/lib/db/scope';

/**
 * Knowledge retrieval and chunk writes (AD-6).
 *
 * The only hand-written SQL in the knowledge feature. `KnowledgeChunk.embedding`
 * is `Unsupported("vector(1536)")`, so it cannot be read or written through the
 * Prisma client — similarity search and chunk insert both go through `$queryRaw`
 * with tagged-template parameters.
 *
 * The raw queries SELF-SCOPE: `organization_id` and `branch_id` are injected
 * explicitly from the `Scope` into the WHERE clause, and chunks are joined to the
 * document version that is CURRENT and APPROVED. That join is the structural gate
 * that stops an unapproved document from ever being cited. A test asserts org A
 * never retrieves org B (the mandated isolation test for this seam — the scoped
 * extension cannot inject into raw SQL).
 *
 * This module is a sanctioned unscoped caller: the raw SQL is the documented
 * exception to `forScope` (scoped-prisma.ts:39), and every statement below carries
 * its own tenant predicate.
 */

export type SearchHit = {
  chunkId: string;
  content: string;
  similarity: number;
  sourceName: string;
  documentTitle: string;
};

/** Keyword search fallback — ILIKE over chunk content (pg_trgm indexed). */
export async function keywordSearch(
  scope: Scope,
  q: string,
  limit = 10,
): Promise<SearchHit[]> {
  const hits = await prisma.$queryRaw<SearchHit[]>(Prisma.sql`
    SELECT
      c.id AS "chunkId",
      c.content AS "content",
      0 AS "similarity",
      s.name AS "sourceName",
      d.title AS "documentTitle"
    FROM knowledge_chunks c
    JOIN knowledge_document_versions v
      ON v.id = c.document_version_id
    JOIN knowledge_documents d
      ON d.id = v.document_id
    JOIN knowledge_sources s
      ON s.id = d.source_id
    WHERE c.organization_id = ${scope.organizationId}
      ${scope.branchId ? Prisma.sql`AND c.branch_id = ${scope.branchId}` : Prisma.empty}
      -- Retrieval only ever sees the CURRENT, APPROVED version of a document.
      AND v.id = d.current_version_id
      AND v.status = 'approved'
      AND c.content ILIKE ${`%${q}%`}
    ORDER BY c.ordinal ASC
    LIMIT ${limit};
  `);

  return hits;
}

/**
 * Cosine similarity search over the HNSW index.
 *
 * `embedding <=> vector` is cosine distance; similarity is `1 - distance`. The
 * HNSW index (`idx_knowledge_chunks_embedding_hnsw`) serves the `<=>` operator.
 */
export async function similaritySearch(
  scope: Scope,
  embedding: number[],
  limit = 10,
): Promise<SearchHit[]> {
  const hits = await prisma.$queryRaw<SearchHit[]>(Prisma.sql`
    SELECT
      c.id AS "chunkId",
      c.content AS "content",
      1 - (c.embedding <=> ${toVectorLiteral(embedding)}::vector) AS "similarity",
      s.name AS "sourceName",
      d.title AS "documentTitle"
    FROM knowledge_chunks c
    JOIN knowledge_document_versions v
      ON v.id = c.document_version_id
    JOIN knowledge_documents d
      ON d.id = v.document_id
    JOIN knowledge_sources s
      ON s.id = d.source_id
    WHERE c.organization_id = ${scope.organizationId}
      ${scope.branchId ? Prisma.sql`AND c.branch_id = ${scope.branchId}` : Prisma.empty}
      AND v.id = d.current_version_id
      AND v.status = 'approved'
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${toVectorLiteral(embedding)}::vector
    LIMIT ${limit};
  `);

  return hits;
}

/**
 * Hybrid search: similarity first, then keyword ILIKE for anything similarity
 * missed (AD-6).
 *
 * The local hash embedder is semantically weak by design, so a short query can
 * rank a chunk poorly even when it contains the exact terms. Running both and
 * merging (similarity-ranked first, deduped) makes retrieval reliable with the
 * local provider AND with real embeddings.
 */
export async function hybridSearch(
  scope: Scope,
  q: string,
  embedding: number[] | null,
  limit = 10,
): Promise<SearchHit[]> {
  const [similar, keyword] = await Promise.all([
    embedding ? similaritySearch(scope, embedding, limit) : Promise.resolve([]),
    keywordSearch(scope, q, limit),
  ]);

  const seen = new Set<string>();
  const merged: SearchHit[] = [];

  for (const hit of [...similar, ...keyword]) {
    if (seen.has(hit.chunkId)) continue;
    seen.add(hit.chunkId);
    merged.push(hit);
    if (merged.length >= limit) break;
  }

  return merged;
}

export type ChunkInsert = {
  ordinal: number;
  content: string;
  vector: number[];
  model: string;
};

/**
 * Inserts chunks for a version in one statement.
 *
 * Prisma cannot write the vector column, so this is raw SQL. The tenant columns
 * are taken from the scope and the branch the document lives in, never from the
 * chunk payload.
 */
export async function insertChunks(
  scope: Scope,
  input: { versionId: string; branchId: string; chunks: ChunkInsert[] },
): Promise<void> {
  if (input.chunks.length === 0) return;

  const values = input.chunks
    .map(
      (chunk) => Prisma.sql`(
        gen_random_uuid(),
        ${scope.organizationId},
        ${input.branchId},
        ${input.versionId},
        ${chunk.ordinal},
        ${chunk.content},
        ${toVectorLiteral(chunk.vector)}::vector,
        ${chunk.model},
        1536,
        now(),
        now()
      )`,
    )
    .reduce((acc, value, index) => {
      if (index === 0) return value;
      return Prisma.sql`${acc}, ${value}`;
    });

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO knowledge_chunks
        (id, organization_id, branch_id, document_version_id, ordinal, content, embedding, embedding_model, dimensions, created_at, updated_at)
      VALUES ${values}
    `,
  );
}

/** pgvector literal: `[1,0,-1]` — square brackets, unquoted numbers. */
function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/** Deletes a version's chunks (re-ingestion). Tenant-scoped. */
export async function deleteChunksForVersion(
  scope: Scope,
  versionId: string,
  branchId: string,
): Promise<void> {
  await prisma.$executeRaw(
    Prisma.sql`
      DELETE FROM knowledge_chunks
      WHERE document_version_id = ${versionId}
        AND organization_id = ${scope.organizationId}
        AND branch_id = ${branchId}
    `,
  );
}

/**
 * Atomically claims the next queued job.
 *
 * `FOR UPDATE SKIP LOCKED` ensures two workers never claim the same job. The
 * tenant predicate means worker A can never claim tenant B's job.
 */
export async function claimNextJob(scope: Scope): Promise<{
  id: string;
  sourceId: string;
  documentId: string | null;
  versionId: string | null;
} | null> {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      sourceId: string;
      documentId: string | null;
      versionId: string | null;
    }[]
  >(Prisma.sql`
    UPDATE ingestion_jobs
    SET status = 'running', started_at = now(), updated_at = now()
    WHERE id = (
      SELECT id FROM ingestion_jobs
      WHERE status = 'queued' AND organization_id = ${scope.organizationId}
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, source_id AS "sourceId", document_id AS "documentId", version_id AS "versionId";
  `);

  return rows[0] ?? null;
}
