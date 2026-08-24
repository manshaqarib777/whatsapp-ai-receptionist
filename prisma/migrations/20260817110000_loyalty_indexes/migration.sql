-- Milestone 17 — Loyalty (follow-up).
--
-- Program indexes declared in the schema (organization + branch scoping) that
-- were omitted from the initial migration.

-- CreateIndex
CREATE INDEX "loyalty_programs_organization_id_idx" ON "loyalty_programs"("organization_id");

-- CreateIndex
CREATE INDEX "loyalty_programs_branch_id_idx" ON "loyalty_programs"("branch_id");
