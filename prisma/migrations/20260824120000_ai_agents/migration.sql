CREATE TYPE "ai_agent_kind" AS ENUM (
  'reception', 'sales', 'support', 'marketing',
  'analytics', 'billing', 'manager', 'knowledge'
);

CREATE TABLE "ai_agents" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "kind" "ai_agent_kind" NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "prompt_template_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_runs" ADD COLUMN "agent_id" UUID;

CREATE UNIQUE INDEX "ai_agents_branch_id_kind_key" ON "ai_agents"("branch_id", "kind");
CREATE INDEX "ai_agents_organization_id_enabled_idx" ON "ai_agents"("organization_id", "enabled");
CREATE INDEX "ai_agents_branch_id_enabled_idx" ON "ai_agents"("branch_id", "enabled");
CREATE INDEX "ai_agents_prompt_template_id_idx" ON "ai_agents"("prompt_template_id");
CREATE INDEX "ai_runs_agent_id_idx" ON "ai_runs"("agent_id");

ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_prompt_template_id_fkey" FOREIGN KEY ("prompt_template_id") REFERENCES "prompt_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
