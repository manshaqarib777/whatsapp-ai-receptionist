-- Milestone 4 — constraints Prisma schema syntax cannot express.
--
-- Partial indexes, CHECK constraints, and EXCLUDE constraints have no Prisma
-- representation, so they are hand-written here. They ARE part of migration
-- history, so a shadow-database replay reproduces them and drift detection
-- stays quiet.
--
-- MAINTENANCE HAZARD: a future `prisma migrate dev` diffs schema.prisma against
-- the replayed shadow database. Objects below that schema.prisma cannot declare
-- will appear as things to DROP. Review generated SQL before applying and strip
-- any DROP that targets an object created here.
-- See docs/database/schema-change.md → Constraints.

-- Webhook idempotency (uq_messages_organization_id_whatsapp_message_id) is NOT
-- here: it is expressible in Prisma as @@unique, so it is declared in
-- schema.prisma and created by the preceding timestamptz migration. Only
-- constraints Prisma genuinely cannot express belong in this file.

-- ---------------------------------------------------------------------------
-- Partial unique indexes — soft delete must not permanently reserve a value.
--
-- DATABASE_RULES.md: "Unique constraints must account for it, or a restored row
-- collides." Without these, soft-deleting a contact would permanently block its
-- phone number from ever being used again.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "uq_branches_organization_id_slug"
  ON "branches" ("organization_id", "slug") WHERE "deleted_at" IS NULL;

-- Exactly one default branch per organization. This is what allows branch_id to
-- be NOT NULL everywhere: every org always has somewhere to put its rows.
CREATE UNIQUE INDEX "uq_branches_one_default_per_organization"
  ON "branches" ("organization_id") WHERE "is_default" AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_contacts_organization_id_phone_number"
  ON "contacts" ("organization_id", "phone_number") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_quotes_organization_id_number"
  ON "quotes" ("organization_id", "number") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_invoices_organization_id_number"
  ON "invoices" ("organization_id", "number") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_labels_branch_id_name"
  ON "labels" ("branch_id", "name") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_tags_branch_id_name"
  ON "tags" ("branch_id", "name") WHERE "deleted_at" IS NULL;

-- ---------------------------------------------------------------------------
-- Partial index — the delay-node scheduler
--
-- Milestone 13 polls for due steps across every run. Only pending steps are ever
-- due, and they are a small minority of the table, so the index is partial.
-- ---------------------------------------------------------------------------

CREATE INDEX "idx_workflow_run_steps_scheduled_for"
  ON "workflow_run_steps" ("scheduled_for") WHERE "status" = 'pending';

-- ---------------------------------------------------------------------------
-- Vector similarity — HNSW
--
-- HNSW over IVFFlat: better recall/latency at this scale and no training step,
-- which matters because the index has to work from the first row inserted.
-- Cosine distance to match normalised embeddings.
-- ---------------------------------------------------------------------------

CREATE INDEX "idx_knowledge_chunks_embedding_hnsw"
  ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Double-booking is a database invariant, not an application check
--
-- An application-level "is this slot free?" read followed by an insert races:
-- two concurrent bookings both read free and both insert. Only the database can
-- settle it. Requires btree_gist for the uuid equality half.
-- ---------------------------------------------------------------------------

ALTER TABLE "appointments"
  ADD CONSTRAINT "excl_appointments_resource_overlap"
  EXCLUDE USING gist (
    "resource_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  )
  WHERE ("status" IN ('booked', 'confirmed') AND "deleted_at" IS NULL);

-- ---------------------------------------------------------------------------
-- CHECK constraints — ranges and formats
-- ---------------------------------------------------------------------------

-- Time ranges must be ordered. A zero-length or inverted appointment is not a
-- booking, and an inverted range silently breaks the overlap constraint above.
ALTER TABLE "appointments"
  ADD CONSTRAINT "chk_appointments_time_order" CHECK ("ends_at" > "starts_at");

ALTER TABLE "availability_exceptions"
  ADD CONSTRAINT "chk_availability_exceptions_time_order" CHECK ("ends_at" > "starts_at");

ALTER TABLE "availability_rules"
  ADD CONSTRAINT "chk_availability_rules_time_order" CHECK ("end_time" > "start_time");

ALTER TABLE "availability_rules"
  ADD CONSTRAINT "chk_availability_rules_weekday" CHECK ("weekday" BETWEEN 0 AND 6);

-- Probabilities and confidences are 0..1, not percentages.
ALTER TABLE "pipeline_stages"
  ADD CONSTRAINT "chk_pipeline_stages_win_probability" CHECK ("win_probability" BETWEEN 0 AND 1);

ALTER TABLE "ai_runs"
  ADD CONSTRAINT "chk_ai_runs_confidence" CHECK ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1);

ALTER TABLE "ai_run_citations"
  ADD CONSTRAINT "chk_ai_run_citations_similarity" CHECK ("similarity" BETWEEN 0 AND 1);

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "chk_knowledge_chunks_dimensions" CHECK ("dimensions" > 0);

-- Currency is ISO 4217. Enforced as a format so a bare "$" or "usd" cannot get
-- in — the minor-unit exponent is derived from this code, and SAR has 2 decimal
-- places while KWD, BHD, and OMR have 3.
ALTER TABLE "services"
  ADD CONSTRAINT "chk_services_currency" CHECK ("price_currency" ~ '^[A-Z]{3}$');
ALTER TABLE "deals"
  ADD CONSTRAINT "chk_deals_currency" CHECK ("value_currency" ~ '^[A-Z]{3}$');
ALTER TABLE "ai_runs"
  ADD CONSTRAINT "chk_ai_runs_currency" CHECK ("cost_currency" ~ '^[A-Z]{3}$');
ALTER TABLE "quotes"
  ADD CONSTRAINT "chk_quotes_currency" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "invoices"
  ADD CONSTRAINT "chk_invoices_currency" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payments_currency" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "refunds"
  ADD CONSTRAINT "chk_refunds_currency" CHECK ("currency" ~ '^[A-Z]{3}$');

-- Money sign. Totals may be zero (a draft), settlements may not be negative —
-- a negative payment is a refund and has its own table.
ALTER TABLE "quotes"
  ADD CONSTRAINT "chk_quotes_amounts_non_negative"
  CHECK ("subtotal_amount" >= 0 AND "tax_amount" >= 0 AND "total_amount" >= 0);

ALTER TABLE "invoices"
  ADD CONSTRAINT "chk_invoices_amounts_non_negative"
  CHECK ("subtotal_amount" >= 0 AND "tax_amount" >= 0 AND "total_amount" >= 0 AND "amount_paid" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "chk_payments_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "refunds"
  ADD CONSTRAINT "chk_refunds_amount_positive" CHECK ("amount" > 0);

-- Tax rate is a fraction (0.15), never a percentage (15). Getting this wrong is
-- a 100x invoicing error, so the database refuses it.
ALTER TABLE "quote_line_items"
  ADD CONSTRAINT "chk_quote_line_items_tax_rate" CHECK ("tax_rate" BETWEEN 0 AND 1);
ALTER TABLE "invoice_line_items"
  ADD CONSTRAINT "chk_invoice_line_items_tax_rate" CHECK ("tax_rate" BETWEEN 0 AND 1);
