-- Milestone 16 — Reviews (follow-up).
--
-- One review per request: the `Review.request_id` one-to-one needs a unique
-- index in the database to match the schema's `@unique`.

-- CreateIndex
CREATE UNIQUE INDEX "reviews_request_id_key" ON "reviews"("request_id");
