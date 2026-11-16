-- Optional handwritten signature image (private object-storage key) on a
-- letterhead. Additive only.
ALTER TABLE "letterhead_profiles" ADD COLUMN "signature_url" VARCHAR(500);
