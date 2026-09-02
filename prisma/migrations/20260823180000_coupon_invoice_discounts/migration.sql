ALTER TABLE "invoices"
  ADD COLUMN "discount_amount" DECIMAL(15,4) NOT NULL DEFAULT 0;

ALTER TABLE "coupon_redemptions"
  ADD COLUMN "invoice_id" UUID,
  ADD COLUMN "discount_amount" DECIMAL(15,4) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "coupon_redemptions_invoice_id_key"
  ON "coupon_redemptions"("invoice_id");
CREATE INDEX "coupon_redemptions_invoice_id_idx"
  ON "coupon_redemptions"("invoice_id");

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_discount_nonnegative"
  CHECK ("discount_amount" >= 0);

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_discount_nonnegative"
  CHECK ("discount_amount" >= 0 AND "discount_amount" <= "subtotal_amount" + "tax_amount");
