-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('PRIVATE', 'PUBLIC', 'FAITH_BASED', 'GROUP_PRACTICE');

-- CreateEnum
CREATE TYPE "FacilityStaffRole" AS ENUM ('OWNER', 'FACILITY_MANAGER', 'DOCTOR', 'LAB_SCIENTIST', 'LAB_TECHNICIAN', 'LAB_ASSISTANT', 'PHLEBOTOMIST', 'NURSE', 'RADIOGRAPHER', 'RECEPTIONIST', 'ACCOUNTANT', 'COMPLIANCE_OFFICER');

-- CreateEnum
CREATE TYPE "FacilityStaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'ON_LEAVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'LOCUM', 'CONTRACT', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "StaffCredentialType" AS ENUM ('MEDICAL_LICENCE', 'NURSING_LICENCE', 'LAB_SCIENTIST_REGISTRATION', 'RADIOGRAPHER_LICENCE', 'PROFESSIONAL_CERTIFICATION', 'TRAINING_CERTIFICATE');

-- CreateEnum
CREATE TYPE "CredentialVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CredentialRenewalStatus" AS ENUM ('CURRENT', 'RENEWAL_DUE', 'RENEWAL_IN_PROGRESS', 'LAPSED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "FacilityBookingWorkflowStage" AS ENUM ('BOOKED', 'CHECKED_IN', 'SAMPLE_COLLECTED', 'SAMPLE_RECEIVED', 'PROCESSING', 'RESULT_ENTERED', 'VERIFIED', 'APPROVED', 'PROCEDURE_COMPLETED', 'IMAGES_UPLOADED', 'REPORT_DRAFTED', 'REVIEWED', 'RELEASED', 'AMENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SettlementMode" AS ENUM ('PLATFORM_HELD', 'SPLIT_SUBACCOUNT');

-- AlterTable
ALTER TABLE "lab_staff_profiles" ADD COLUMN     "bed_count" INTEGER,
ADD COLUMN     "commission_bps" INTEGER,
ADD COLUMN     "email" VARCHAR(120),
ADD COLUMN     "emergency_contact" VARCHAR(200),
ADD COLUMN     "established_year" INTEGER,
ADD COLUMN     "gallery_image_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "imaging_room_count" INTEGER,
ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "laboratory_count" INTEGER,
ADD COLUMN     "languages_spoken" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "logo_url" VARCHAR(500),
ADD COLUMN     "mission" VARCHAR(500),
ADD COLUMN     "ownershipType" "OwnershipType",
ADD COLUMN     "payment_methods" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "phone" VARCHAR(40),
ADD COLUMN     "settlement_account_number" VARCHAR(40),
ADD COLUMN     "settlement_bank" VARCHAR(100),
ADD COLUMN     "slug" VARCHAR(80),
ADD COLUMN     "subaccount_code" VARCHAR(60),
ADD COLUMN     "tagline" VARCHAR(200),
ADD COLUMN     "theatre_count" INTEGER,
ADD COLUMN     "vision" VARCHAR(500);

-- AlterTable
ALTER TABLE "facility_services" RENAME COLUMN "branch" TO "branch_label";

ALTER TABLE "facility_services" ADD COLUMN     "branch_id" UUID,
ADD COLUMN     "department_id" UUID,
ADD COLUMN     "home_collection_available" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preparation_instructions" TEXT,
ADD COLUMN     "referral_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "urgent_available" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "facility_bookings" ADD COLUMN     "assigned_staff_id" UUID,
ADD COLUMN     "referral_document_key" TEXT,
ADD COLUMN     "released_at" TIMESTAMP(3),
ADD COLUMN     "report_document_key" TEXT,
ADD COLUMN     "workflow_stage" "FacilityBookingWorkflowStage" NOT NULL DEFAULT 'BOOKED',
ADD COLUMN     "workflow_updated_at" TIMESTAMP(3);

-- AlterTable
-- commission_amount and subaccount_code are already added by the payments_platform
-- migration; only the facility-specific snapshot columns are added here.
ALTER TABLE "payments" ADD COLUMN     "commission_bps" INTEGER,
ADD COLUMN     "net_amount" DECIMAL(12,2),
ADD COLUMN     "settlementMode" "SettlementMode";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "facility_id" UUID,
ADD COLUMN     "outcome" VARCHAR(16),
ADD COLUMN     "patient_id" UUID;

-- CreateTable
CREATE TABLE "facility_branches" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address_line" TEXT,
    "city" TEXT,
    "state" TEXT,
    "phone" VARCHAR(40),
    "email" VARCHAR(120),
    "opening_hours" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_departments" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "opening_hours" TEXT,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lead_staff_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_staff" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "user_id" UUID,
    "email" VARCHAR(120) NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "facilityRole" "FacilityStaffRole" NOT NULL,
    "department_id" UUID,
    "branch_id" UUID,
    "employmentType" "EmploymentType",
    "status" "FacilityStaffStatus" NOT NULL DEFAULT 'INVITED',
    "invite_token" VARCHAR(64),
    "invite_expires_at" TIMESTAMP(3),
    "invited_by_id" UUID,
    "accepted_at" TIMESTAMP(3),
    "public_profile_visible" BOOLEAN NOT NULL DEFAULT false,
    "profile_consent" BOOLEAN NOT NULL DEFAULT false,
    "profile_consent_at" TIMESTAMP(3),
    "booking_eligible" BOOLEAN NOT NULL DEFAULT false,
    "professional_title" VARCHAR(120),
    "photo_url" VARCHAR(500),
    "qualifications" TEXT,
    "specialty" TEXT,
    "years_experience" INTEGER,
    "bio" TEXT,
    "linkedin_url" VARCHAR(300),
    "linkedin_public" BOOLEAN NOT NULL DEFAULT false,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_credentials" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "type" "StaffCredentialType" NOT NULL,
    "number" VARCHAR(80) NOT NULL,
    "authority" VARCHAR(160) NOT NULL,
    "issue_date" DATE,
    "expiry_date" DATE,
    "verification_status" "CredentialVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "document_key" TEXT,
    "restrictions" TEXT,
    "renewal_status" "CredentialRenewalStatus" NOT NULL DEFAULT 'CURRENT',
    "last_reminder_stage" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_referrals" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "from_doctor_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "case_id" UUID,
    "service_id" UUID,
    "note" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_accreditations" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "document_key" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_accreditations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facility_branches_facility_id_idx" ON "facility_branches"("facility_id");

-- CreateIndex
CREATE INDEX "facility_departments_facility_id_idx" ON "facility_departments"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_departments_facility_id_slug_key" ON "facility_departments"("facility_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "facility_staff_user_id_key" ON "facility_staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_staff_invite_token_key" ON "facility_staff"("invite_token");

-- CreateIndex
CREATE INDEX "facility_staff_facility_id_status_idx" ON "facility_staff"("facility_id", "status");

-- CreateIndex
CREATE INDEX "facility_staff_user_id_idx" ON "facility_staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_staff_facility_id_email_key" ON "facility_staff"("facility_id", "email");

-- CreateIndex
CREATE INDEX "staff_credentials_staff_id_idx" ON "staff_credentials"("staff_id");

-- CreateIndex
CREATE INDEX "staff_credentials_expiry_date_idx" ON "staff_credentials"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_credentials_staff_id_type_number_key" ON "staff_credentials"("staff_id", "type", "number");

-- CreateIndex
CREATE INDEX "facility_referrals_facility_id_status_idx" ON "facility_referrals"("facility_id", "status");

-- CreateIndex
CREATE INDEX "facility_referrals_from_doctor_id_idx" ON "facility_referrals"("from_doctor_id");

-- CreateIndex
CREATE INDEX "facility_referrals_patient_id_idx" ON "facility_referrals"("patient_id");

-- CreateIndex
CREATE INDEX "facility_accreditations_facility_id_idx" ON "facility_accreditations"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_staff_profiles_slug_key" ON "lab_staff_profiles"("slug");

-- CreateIndex
CREATE INDEX "lab_staff_profiles_is_published_idx" ON "lab_staff_profiles"("is_published");

-- CreateIndex
CREATE INDEX "facility_bookings_workflow_stage_idx" ON "facility_bookings"("workflow_stage");

-- CreateIndex
CREATE INDEX "audit_logs_facility_id_created_at_idx" ON "audit_logs"("facility_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_patient_id_idx" ON "audit_logs"("patient_id");

-- AddForeignKey
ALTER TABLE "facility_branches" ADD CONSTRAINT "facility_branches_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_departments" ADD CONSTRAINT "facility_departments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_departments" ADD CONSTRAINT "facility_departments_lead_staff_id_fkey" FOREIGN KEY ("lead_staff_id") REFERENCES "facility_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_staff" ADD CONSTRAINT "facility_staff_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_staff" ADD CONSTRAINT "facility_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_staff" ADD CONSTRAINT "facility_staff_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "facility_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_staff" ADD CONSTRAINT "facility_staff_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "facility_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "facility_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "facility_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_from_doctor_id_fkey" FOREIGN KEY ("from_doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "facility_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_accreditations" ADD CONSTRAINT "facility_accreditations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_services" ADD CONSTRAINT "facility_services_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "facility_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_services" ADD CONSTRAINT "facility_services_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "facility_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "facility_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: every existing facility owner becomes an OWNER staff member of their facility.
-- No publication consent, credential verification or accreditation verification is invented here:
-- publicProfileVisible/profileConsent default to false and stay false until set explicitly.
INSERT INTO facility_staff (id, facility_id, user_id, email, full_name, "facilityRole", status, accepted_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  p.id,
  p.user_id,
  u.email,
  COALESCE(NULLIF(p."laboratory_name", ''), u.name),
  'OWNER',
  'ACTIVE',
  p.created_at,
  NOW(),
  NOW()
FROM lab_staff_profiles p
JOIN users u ON u.id = p.user_id
ON CONFLICT DO NOTHING;

-- Audit log immutability: block UPDATE and DELETE at the database level.
CREATE OR REPLACE FUNCTION medic1905_audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (attempted %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION medic1905_audit_logs_append_only();
