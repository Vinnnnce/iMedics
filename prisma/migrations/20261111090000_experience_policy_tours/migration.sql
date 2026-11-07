-- Additive only. No existing accounts, records, roles or policy fields are rewritten.
ALTER TABLE "users" ADD COLUMN "country" TEXT;
ALTER TABLE "lab_staff_profiles" ADD COLUMN "country" TEXT;
CREATE TABLE "policy_snapshots" (
  "version" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL CHECK ("status" IN ('DRAFT', 'PUBLISHED')),
  "effective_date" TEXT,
  "content" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "policy_receipts" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "version" TEXT NOT NULL REFERENCES "policy_snapshots"("version"),
  "account_type" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('ACCEPTANCE', 'DRAFT_ACKNOWLEDGEMENT')),
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("user_id", "version", "kind")
);
CREATE INDEX "policy_receipts_user_id_recorded_at_idx" ON "policy_receipts" ("user_id", "recorded_at");
CREATE TABLE "product_tours" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "tour_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK ("status" IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','SKIPPED')),
  "step" INTEGER NOT NULL DEFAULT 0 CHECK ("step" >= 0 AND "step" <= 100),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("user_id", "tour_key")
);
-- Prevent later code from silently changing or removing a user's legal evidence.
CREATE FUNCTION medic1905_preserve_policy_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Policy evidence is append-only; create a new version'; END;
$$;
CREATE TRIGGER policy_snapshot_immutable BEFORE UPDATE OR DELETE ON "policy_snapshots"
FOR EACH ROW EXECUTE FUNCTION medic1905_preserve_policy_evidence();
CREATE TRIGGER policy_receipt_immutable BEFORE UPDATE OR DELETE ON "policy_receipts"
FOR EACH ROW EXECUTE FUNCTION medic1905_preserve_policy_evidence();
