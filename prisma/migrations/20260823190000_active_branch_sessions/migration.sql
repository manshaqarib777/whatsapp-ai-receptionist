-- Milestone 18: persist the trusted branch selection beside the active organization.
ALTER TABLE "sessions" ADD COLUMN "active_branch_id" UUID;

UPDATE "sessions" AS s
SET "active_branch_id" = b."id"
FROM "branches" AS b
WHERE b."organization_id" = s."active_organization_id"
  AND b."is_default" = TRUE
  AND b."deleted_at" IS NULL;

CREATE INDEX "sessions_active_branch_id_idx" ON "sessions"("active_branch_id");

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_active_branch_id_fkey"
  FOREIGN KEY ("active_branch_id") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
