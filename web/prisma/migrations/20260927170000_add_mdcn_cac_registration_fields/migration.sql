-- AlterTable: Add pending status support and accountType to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" TEXT;

-- AlterTable: Add MDCN registration fields to doctor_profiles
ALTER TABLE "doctor_profiles" ADD COLUMN IF NOT EXISTS "mdcn_registration_number" TEXT;
ALTER TABLE "doctor_profiles" ADD COLUMN IF NOT EXISTS "year_of_registration" INTEGER;

-- AlterTable: Add CAC registration fields to lab_staff_profiles
ALTER TABLE "lab_staff_profiles" ADD COLUMN IF NOT EXISTS "cac_registration_number" TEXT;
ALTER TABLE "lab_staff_profiles" ADD COLUMN IF NOT EXISTS "facility_license_number" TEXT;

-- AlterTable: Add address, emergency contact to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergency_contact" JSONB;
