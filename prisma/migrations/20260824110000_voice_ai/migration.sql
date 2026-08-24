CREATE TYPE "transcription_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE "transcriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "attachment_id" UUID NOT NULL,
    "status" "transcription_status" NOT NULL DEFAULT 'pending',
    "language" TEXT NOT NULL DEFAULT 'auto',
    "provider" TEXT NOT NULL DEFAULT 'local',
    "model" TEXT NOT NULL DEFAULT 'demo-stt-v1',
    "text" TEXT,
    "confidence" DECIMAL(5,4),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "locked_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(500),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "redacted_at" TIMESTAMPTZ(3),
    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transcriptions_attachment_id_key" ON "transcriptions"("attachment_id");
CREATE INDEX "transcriptions_organization_id_status_created_at_idx" ON "transcriptions"("organization_id", "status", "created_at");
CREATE INDEX "transcriptions_branch_id_status_idx" ON "transcriptions"("branch_id", "status");
CREATE INDEX "transcriptions_message_id_created_at_idx" ON "transcriptions"("message_id", "created_at");
CREATE INDEX "transcriptions_deleted_at_idx" ON "transcriptions"("deleted_at");
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "message_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
