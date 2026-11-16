-- Letterhead print options, share expiry, staff phone number and document
-- soft delete. Additive only; every new column is nullable so existing rows
-- and running code keep working unchanged.
ALTER TABLE "letterhead_profiles" ADD COLUMN "qr_url" VARCHAR(2048);
ALTER TABLE "letterhead_profiles" ADD COLUMN "watermark_opacity" DOUBLE PRECISION;
ALTER TABLE "letterhead_profiles" ADD COLUMN "watermark_rotation" DOUBLE PRECISION;
ALTER TABLE "letterhead_profiles" ADD COLUMN "locale" VARCHAR(10);
ALTER TABLE "letterhead_profiles" ADD COLUMN "date_format" VARCHAR(40);
ALTER TABLE "document_shares" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "document_facility_shares" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "facility_staff" ADD COLUMN "phone_number" VARCHAR(40);
ALTER TABLE "clinical_documents" ADD COLUMN "deleted_at" TIMESTAMP(3);
