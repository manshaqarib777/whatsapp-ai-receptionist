-- Milestone 4 — fix a column that escaped the snake_case rule.
--
-- `contacts.lifecycleStage` was missing @map, so Prisma created it camelCase,
-- against DATABASE_RULES.md §Naming ("columns snake_case"). It was the only one;
-- verified by querying information_schema for column_name ~ '[A-Z]'.
--
-- HAND-EDITED, and worth reading before the next person runs `migrate diff`:
--
--  1. Prisma generated DROP COLUMN + ADD COLUMN, which silently discards data.
--     Rewritten as RENAME. Harmless today because the table is empty, but the
--     generated form is the wrong habit to commit.
--
--  2. Prisma also generated `DROP INDEX idx_knowledge_chunks_embedding_hnsw`.
--     That is exactly the maintenance hazard documented in
--     20260802034500_constraints: schema.prisma cannot express an HNSW index, so
--     every future diff will propose dropping it. Removed. Do not let it back in.

ALTER TABLE "contacts" RENAME COLUMN "lifecycleStage" TO "lifecycle_stage";

ALTER INDEX "contacts_organization_id_lifecycleStage_idx"
  RENAME TO "contacts_organization_id_lifecycle_stage_idx";
