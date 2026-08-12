-- Milestone 7 — Knowledge Base.
--
-- Source-kind enum values (pdf/docx/csv), upload file metadata on documents,
-- version chunkCount/checksum, and job progress + produced-document links.
--
-- HAND-EDITED, and worth reading before the next person runs `migrate diff`:
--
--  1. Prisma generated `DROP INDEX idx_knowledge_chunks_embedding_hnsw` and
--     `DROP INDEX idx_messages_body_trgm` (the maintenance hazards documented in
--     20260802034500_constraints and 20260812092315_inbox: schema.prisma cannot
--     express HNSW or GIN/trigram indexes, so every diff proposes dropping them).
--     Both DROPs removed. The HNSW index is recreated below. Do not let them back
--     in.
--
--  2. The new GIN trigram index on knowledge_chunks.content (keyword search,
--     AD-6) is hand-written — Prisma cannot express it. If a future `migrate dev`
--     diff proposes DROPping it, strip that DROP and recreate.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "knowledge_source_kind" ADD VALUE 'pdf';
ALTER TYPE "knowledge_source_kind" ADD VALUE 'docx';
ALTER TYPE "knowledge_source_kind" ADD VALUE 'csv';

-- AlterTable
ALTER TABLE "ingestion_jobs" ADD COLUMN     "document_id" UUID,
ADD COLUMN     "progress" INTEGER DEFAULT 0,
ADD COLUMN     "version_id" UUID;

-- AlterTable
ALTER TABLE "knowledge_document_versions" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "chunk_count" INTEGER;

-- AlterTable
ALTER TABLE "knowledge_documents" ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "size_bytes" BIGINT,
ADD COLUMN     "storage_key" TEXT;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "knowledge_document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: keyword search over knowledge chunks (Prisma cannot express).
--
-- Milestone 7 retrieval (AD-6) hybrid-searches knowledge_chunks.content with an
-- ILIKE pattern; the trigram GIN index keeps that sub-linear at real volume.
-- ---------------------------------------------------------------------------
CREATE INDEX "idx_knowledge_chunks_content_trgm"
  ON "knowledge_chunks" USING gin ("content" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Hand-written: recreate the HNSW index Prisma's diff tried to drop.
--
-- schema.prisma cannot express an HNSW index, so every `migrate dev` diff
-- proposes DROPping idx_knowledge_chunks_embedding_hnsw. The generated DROP was
-- removed above; the index must exist for Milestone 7 retrieval. See the header
-- of 20260802034500_constraints and scripts/check-schema-drift.ts.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_embedding_hnsw"
  ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);
