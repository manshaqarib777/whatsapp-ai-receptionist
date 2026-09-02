-- Align hand-authored queue DDL with Prisma's client-generated UUID and @updatedAt semantics.
ALTER TABLE "ai_turn_jobs"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "ai_turn_jobs" DROP CONSTRAINT "ai_turn_jobs_organization_id_fkey";
ALTER TABLE "ai_turn_jobs" DROP CONSTRAINT "ai_turn_jobs_branch_id_fkey";
ALTER TABLE "ai_turn_jobs" DROP CONSTRAINT "ai_turn_jobs_conversation_id_fkey";
ALTER TABLE "ai_turn_jobs" DROP CONSTRAINT "ai_turn_jobs_input_message_id_fkey";
ALTER TABLE "ai_turn_jobs" DROP CONSTRAINT "ai_turn_jobs_run_id_fkey";

ALTER TABLE "ai_turn_jobs" ADD CONSTRAINT "ai_turn_jobs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_turn_jobs" ADD CONSTRAINT "ai_turn_jobs_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_turn_jobs" ADD CONSTRAINT "ai_turn_jobs_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_turn_jobs" ADD CONSTRAINT "ai_turn_jobs_input_message_id_fkey"
  FOREIGN KEY ("input_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_turn_jobs" ADD CONSTRAINT "ai_turn_jobs_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
