-- Milestone 6 — Inbox.
--
-- Per-user read receipts, typing indicators, message readAt, conversation
-- summaries, and the new inbox activity kinds.
--
-- HAND-EDITED, and worth reading before the next person runs `migrate diff`:
--
--  1. Prisma generated `DROP INDEX idx_knowledge_chunks_embedding_hnsw` (the
--     maintenance hazard documented in 20260802034500_constraints: schema.prisma
--     cannot express an HNSW index, so every future diff proposes dropping it).
--     Removed. Recreated below. Do not let it back in.
--
--  2. The `pg_trgm` extension + GIN trigram index on messages.body are
--     hand-written (Prisma cannot express them), so they live here. If a future
--     `migrate dev` diff proposes DROPping them, strip that DROP and recreate.
--
-- The ALTER TYPE statements below run outside a transaction in older Postgres;
-- Prisma handles this automatically for enum additions.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "activity_kind" ADD VALUE 'assigned';
ALTER TYPE "activity_kind" ADD VALUE 'unassigned';
ALTER TYPE "activity_kind" ADD VALUE 'label_changed';
ALTER TYPE "activity_kind" ADD VALUE 'archived';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "read_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "conversation_reads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_typing" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversation_typing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_summaries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'heuristic',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'current',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_reads_user_id_last_read_at_idx" ON "conversation_reads"("user_id", "last_read_at");

-- CreateIndex
CREATE INDEX "conversation_reads_organization_id_idx" ON "conversation_reads"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_reads_conversation_id_user_id_key" ON "conversation_reads"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "conversation_typing_expires_at_idx" ON "conversation_typing"("expires_at");

-- CreateIndex
CREATE INDEX "conversation_typing_organization_id_idx" ON "conversation_typing"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_typing_conversation_id_user_id_key" ON "conversation_typing"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "conversation_summaries_organization_id_idx" ON "conversation_summaries"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_summaries_conversation_id_version_key" ON "conversation_summaries"("conversation_id", "version");

-- AddForeignKey
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_typing" ADD CONSTRAINT "conversation_typing_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_typing" ADD CONSTRAINT "conversation_typing_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_typing" ADD CONSTRAINT "conversation_typing_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: pg_trgm search index on message bodies (Prisma cannot express).
--
-- Milestone 6 search queries messages.body with an ILIKE pattern. The trigram
-- GIN index keeps that sub-linear at real volume. See AD-5 of MILESTONE_06_PLAN.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX "idx_messages_body_trgm"
  ON "messages" USING gin ("body" gin_trgm_ops);

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
