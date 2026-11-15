-- Official document letterheads: facility-wide, department-specific or a
-- doctor's personal professional letterhead. Additive only.
CREATE TABLE "letterhead_profiles" (
  "id" UUID NOT NULL,
  "facility_id" UUID,
  "user_id" UUID,
  "name" VARCHAR(120) NOT NULL,
  "department" VARCHAR(120),
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "display_name" VARCHAR(200) NOT NULL,
  "header_lines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "address_line" VARCHAR(300),
  "contact_phone" VARCHAR(40),
  "contact_email" VARCHAR(120),
  "website" VARCHAR(160),
  "registration_info" VARCHAR(300),
  "brand_color" VARCHAR(7) NOT NULL DEFAULT '#0F766E',
  "footer_text" VARCHAR(300),
  "logo_url" VARCHAR(500),
  "show_qr" BOOLEAN NOT NULL DEFAULT true,
  "watermark" VARCHAR(60),
  "signature_blocks" JSONB NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "letterhead_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "letterhead_profiles_facility_id_name_key" ON "letterhead_profiles"("facility_id", "name");
CREATE UNIQUE INDEX "letterhead_profiles_user_id_name_key" ON "letterhead_profiles"("user_id", "name");
CREATE INDEX "letterhead_profiles_facility_id_active_idx" ON "letterhead_profiles"("facility_id", "active");
ALTER TABLE "letterhead_profiles" ADD CONSTRAINT "letterhead_profiles_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "letterhead_profiles" ADD CONSTRAINT "letterhead_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
