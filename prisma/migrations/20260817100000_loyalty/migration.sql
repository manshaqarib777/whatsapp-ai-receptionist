-- Milestone 17 — Loyalty.
--
-- The six Tier-2 loyalty tables designed in the M4 ER diagram (§10), migrated
-- at their owning milestone: loyalty_programs, loyalty_accounts,
-- loyalty_transactions (points ledger referencing invoices), coupons,
-- coupon_redemptions, referrals. All branch-scoped, all with the cross-cutting
-- columns. The unique business keys make the earn worker and redemption paths
-- idempotent.

-- CreateEnum
CREATE TYPE "loyalty_tier" AS ENUM ('bronze', 'silver', 'gold');

-- CreateEnum
CREATE TYPE "loyalty_transaction_kind" AS ENUM ('earn', 'spend', 'referral_bonus');

-- CreateEnum
CREATE TYPE "coupon_type" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "referral_status" AS ENUM ('pending', 'rewarded');

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "points_per_currency" DECIMAL(6,4) NOT NULL DEFAULT 1,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "total_earned" INTEGER NOT NULL DEFAULT 0,
    "tier" "loyalty_tier" NOT NULL DEFAULT 'bronze',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "invoice_id" UUID,
    "kind" "loyalty_transaction_kind" NOT NULL,
    "points_delta" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "coupon_type" NOT NULL,
    "value" DECIMAL(15,4) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "max_redemptions" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "redeemed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "referrer_id" UUID NOT NULL,
    "referred_contact_id" UUID NOT NULL,
    "bonus_points" INTEGER NOT NULL DEFAULT 0,
    "status" "referral_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_contact_id_program_id_key" ON "loyalty_accounts"("contact_id", "program_id");

-- CreateIndex
CREATE INDEX "loyalty_accounts_organization_id_tier_idx" ON "loyalty_accounts"("organization_id", "tier");

-- CreateIndex
CREATE INDEX "loyalty_accounts_program_id_idx" ON "loyalty_accounts"("program_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_transactions_invoice_id_kind_key" ON "loyalty_transactions"("invoice_id", "kind");

-- CreateIndex
CREATE INDEX "loyalty_transactions_organization_id_created_at_idx" ON "loyalty_transactions"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_transactions_account_id_idx" ON "loyalty_transactions"("account_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_invoice_id_idx" ON "loyalty_transactions"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_branch_id_code_key" ON "coupons"("branch_id", "code");

-- CreateIndex
CREATE INDEX "coupons_organization_id_idx" ON "coupons"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_coupon_id_contact_id_key" ON "coupon_redemptions"("coupon_id", "contact_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_organization_id_idx" ON "coupon_redemptions"("organization_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_contact_id_idx" ON "coupon_redemptions"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrer_id_referred_contact_id_key" ON "referrals"("referrer_id", "referred_contact_id");

-- CreateIndex
CREATE INDEX "referrals_organization_id_idx" ON "referrals"("organization_id");

-- CreateIndex
CREATE INDEX "referrals_referred_contact_id_idx" ON "referrals"("referred_contact_id");

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_contact_id_fkey" FOREIGN KEY ("referred_contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints: ledger integrity and coupon bounds (DATABASE_RULES: ranges
-- constrained in the database, not trusted to the application).
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_balance_check" CHECK ("balance" >= 0);
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_total_earned_check" CHECK ("total_earned" >= 0);
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_points_per_currency_check" CHECK ("points_per_currency" >= 0);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_max_redemptions_check" CHECK ("max_redemptions" >= 1);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_value_check" CHECK ("value" >= 0);
