CREATE TYPE "privacy_request_type" AS ENUM ('access', 'erasure');
CREATE TYPE "privacy_request_status" AS ENUM ('pending', 'completed', 'rejected', 'failed');

ALTER TABLE "integration_connections"
  ADD COLUMN "credential_ciphertext" TEXT,
  ADD COLUMN "credential_key_version" INTEGER;

CREATE TABLE "privacy_requests" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "requester_id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "type" "privacy_request_type" NOT NULL,
  "status" "privacy_request_status" NOT NULL DEFAULT 'pending',
  "completed_at" TIMESTAMPTZ(3),
  "failure_code" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rate_limit_buckets" (
  "key_hash" CHAR(64) NOT NULL,
  "count" INTEGER NOT NULL,
  "reset_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key_hash")
);

CREATE INDEX "privacy_requests_organization_id_status_created_at_idx"
  ON "privacy_requests"("organization_id", "status", "created_at");
CREATE INDEX "privacy_requests_organization_id_contact_id_type_status_idx"
  ON "privacy_requests"("organization_id", "contact_id", "type", "status");
CREATE INDEX "privacy_requests_requester_id_created_at_idx"
  ON "privacy_requests"("requester_id", "created_at");
CREATE INDEX "privacy_requests_deleted_at_idx" ON "privacy_requests"("deleted_at");
CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets"("reset_at");

ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_requester_id_fkey"
  FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
