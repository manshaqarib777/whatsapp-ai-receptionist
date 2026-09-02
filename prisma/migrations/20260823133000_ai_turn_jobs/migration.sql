-- Milestone 8 repair: durable AI turn execution keyed by a persisted inbound message.
CREATE TYPE "ai_turn_job_status" AS ENUM ('queued', 'running', 'succeeded', 'failed');

CREATE TABLE "ai_turn_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "input_message_id" UUID NOT NULL,
  "run_id" UUID,
  "status" "ai_turn_job_status" NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "locked_at" TIMESTAMPTZ(3),
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_turn_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_turn_jobs_input_message_id_key" UNIQUE ("input_message_id"),
  CONSTRAINT "ai_turn_jobs_run_id_key" UNIQUE ("run_id"),
  CONSTRAINT "ai_turn_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "ai_turn_jobs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
  CONSTRAINT "ai_turn_jobs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_turn_jobs_input_message_id_fkey" FOREIGN KEY ("input_message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_turn_jobs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_runs"("id") ON DELETE SET NULL
);

CREATE INDEX "ai_turn_jobs_organization_id_status_created_at_idx" ON "ai_turn_jobs"("organization_id", "status", "created_at");
CREATE INDEX "ai_turn_jobs_branch_id_idx" ON "ai_turn_jobs"("branch_id");
CREATE INDEX "ai_turn_jobs_conversation_id_idx" ON "ai_turn_jobs"("conversation_id");
