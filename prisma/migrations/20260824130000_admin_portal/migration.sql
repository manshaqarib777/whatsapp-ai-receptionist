CREATE TYPE "platform_role" AS ENUM ('user', 'operator');
CREATE TYPE "billing_interval" AS ENUM ('month', 'year');
CREATE TYPE "subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

ALTER TABLE "users" ADD COLUMN "platform_role" "platform_role" NOT NULL DEFAULT 'user';

CREATE TABLE "plans" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "amount" DECIMAL(15,4) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "interval" "billing_interval" NOT NULL,
  "features" JSONB NOT NULL DEFAULT '[]',
  "limits" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "status" "subscription_status" NOT NULL DEFAULT 'trialing',
  "amount" DECIMAL(15,4) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "interval" "billing_interval" NOT NULL,
  "period_starts_at" TIMESTAMPTZ(3) NOT NULL,
  "period_ends_at" TIMESTAMPTZ(3) NOT NULL,
  "trial_ends_at" TIMESTAMPTZ(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");
CREATE INDEX "plans_active_amount_idx" ON "plans"("active", "amount");
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");
CREATE INDEX "subscriptions_status_period_ends_at_idx" ON "subscriptions"("status", "period_ends_at");
CREATE INDEX "subscriptions_plan_id_status_idx" ON "subscriptions"("plan_id", "status");
CREATE INDEX "subscriptions_deleted_at_idx" ON "subscriptions"("deleted_at");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
