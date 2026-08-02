-- Milestone 4 — Postgres extensions.
--
-- Separate from the schema migration because both of the following depend on
-- these types already existing:
--   * knowledge_chunks.embedding is vector(1536)
--   * the appointment overlap EXCLUDE constraint mixes uuid equality with
--     tstzrange overlap, which needs btree_gist for the scalar column
--
-- Requires the pgvector/pgvector:pg17 image. Stock postgres:17-alpine does not
-- ship `vector` — see docs/database/schema-change.md.

CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
