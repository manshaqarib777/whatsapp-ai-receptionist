-- Milestone 16 — Reviews.
--
-- The three Tier-2 review tables designed in the M4 ER diagram (§10), migrated
-- at their owning milestone: review_platforms (Google/Facebook), review_requests
-- (asked of a contact, linked to the completed appointment), reviews (yielded
-- by a request). All branch-scoped, all with the cross-cutting columns.

-- CreateEnum
CREATE TYPE "review_platform_provider" AS ENUM ('google', 'facebook');

-- CreateEnum
CREATE TYPE "review_request_status" AS ENUM ('created', 'sent', 'responded', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "review_platforms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "review_platform_provider" NOT NULL,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "credentials_ref" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "review_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "platform_id" UUID NOT NULL,
    "status" "review_request_status" NOT NULL DEFAULT 'created',
    "sent_at" TIMESTAMPTZ(3),
    "responded_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "request_id" UUID,
    "platform_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "external_review_id" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_platforms_branch_id_provider_key" ON "review_platforms"("branch_id", "provider");

-- CreateIndex
CREATE INDEX "review_platforms_organization_id_idx" ON "review_platforms"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_requests_appointment_id_platform_id_key" ON "review_requests"("appointment_id", "platform_id");

-- CreateIndex
CREATE INDEX "review_requests_organization_id_status_idx" ON "review_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "review_requests_contact_id_idx" ON "review_requests"("contact_id");

-- CreateIndex
CREATE INDEX "review_requests_platform_id_idx" ON "review_requests"("platform_id");

-- CreateIndex
CREATE INDEX "review_requests_appointment_id_idx" ON "review_requests"("appointment_id");

-- CreateIndex
CREATE INDEX "reviews_organization_id_received_at_idx" ON "reviews"("organization_id", "received_at");

-- CreateIndex
CREATE INDEX "reviews_contact_id_idx" ON "reviews"("contact_id");

-- CreateIndex
CREATE INDEX "reviews_platform_id_idx" ON "reviews"("platform_id");

-- CreateIndex
CREATE INDEX "reviews_request_id_idx" ON "reviews"("request_id");

-- CreateIndex
CREATE INDEX "reviews_organization_id_external_review_id_idx" ON "reviews"("organization_id", "external_review_id");

-- AddForeignKey
ALTER TABLE "review_platforms" ADD CONSTRAINT "review_platforms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_platforms" ADD CONSTRAINT "review_platforms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "review_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "review_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "review_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints: rating must be 1–5 (DATABASE_RULES: every enum/range
-- constrained in the database, not trusted to the application).
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);
