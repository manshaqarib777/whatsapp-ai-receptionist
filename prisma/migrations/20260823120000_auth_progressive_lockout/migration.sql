ALTER TABLE "users"
ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMPTZ(3);

CREATE INDEX "users_locked_until_idx" ON "users"("locked_until");
