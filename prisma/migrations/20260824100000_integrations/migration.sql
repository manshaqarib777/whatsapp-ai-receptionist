CREATE TYPE "integration_provider" AS ENUM ('meta', 'google', 'outlook', 'slack', 'hubspot', 'stripe', 'zapier', 'make', 'n8n', 'salla', 'shopify');
CREATE TYPE "integration_status" AS ENUM ('disconnected', 'connected', 'error');

CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" "integration_provider" NOT NULL,
    "status" "integration_status" NOT NULL DEFAULT 'disconnected',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "config" JSONB NOT NULL DEFAULT '{}',
    "credential_hint" TEXT,
    "last_tested_at" TIMESTAMPTZ(3),
    "last_healthy_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_connections_organization_id_provider_key" ON "integration_connections"("organization_id", "provider");
CREATE INDEX "integration_connections_organization_id_status_idx" ON "integration_connections"("organization_id", "status");
CREATE INDEX "integration_connections_organization_id_updated_at_idx" ON "integration_connections"("organization_id", "updated_at");
CREATE INDEX "integration_connections_deleted_at_idx" ON "integration_connections"("deleted_at");
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
