-- CreateEnum
CREATE TYPE "DoctorServiceKind" AS ENUM ('NEW_PATIENT', 'FOLLOW_UP', 'SECOND_OPINION', 'POST_OP_REVIEW', 'REPORT_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "PortfolioItemType" AS ENUM ('EDUCATION', 'WORK_HISTORY', 'FELLOWSHIP', 'PUBLICATION', 'PRESENTATION', 'CASE_STUDY', 'MEDIA_APPEARANCE', 'AWARD', 'OUTREACH');

-- CreateEnum
CREATE TYPE "PortfolioVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED');

-- CreateEnum
CREATE TYPE "ReviewModeration" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "doctor_profiles" ADD COLUMN     "awards" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "clinical_interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "conditions_treated" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "consultation_approach" TEXT,
ADD COLUMN     "consultation_modes" "AppointmentMode"[] DEFAULT ARRAY[]::"AppointmentMode"[],
ADD COLUMN     "cv_file_id" UUID,
ADD COLUMN     "hospital_affiliations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "identity_verification" "VerificationStatus",
ADD COLUMN     "identity_verified_at" TIMESTAMP(3),
ADD COLUMN     "license_expiry" TIMESTAMP(3),
ADD COLUMN     "license_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "license_verification" "VerificationStatus",
ADD COLUMN     "license_verified_at" TIMESTAMP(3),
ADD COLUMN     "licensing_authority" TEXT,
ADD COLUMN     "linkedin_consent_at" TIMESTAMP(3),
ADD COLUMN     "linkedin_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedin_url" TEXT,
ADD COLUMN     "patient_care_philosophy" TEXT,
ADD COLUMN     "procedures_performed" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "professional_memberships" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "professional_title" TEXT,
ADD COLUMN     "qualification_verification" "VerificationStatus",
ADD COLUMN     "qualification_verified_at" TIMESTAMP(3),
ADD COLUMN     "qualifications" TEXT,
ADD COLUMN     "when_to_book_guidance" TEXT;

-- AlterTable
ALTER TABLE "doctor_reviews" ADD COLUMN     "communication_rating" INTEGER,
ADD COLUMN     "doctor_responded_at" TIMESTAMP(3),
ADD COLUMN     "doctor_response" TEXT,
ADD COLUMN     "explanation_rating" INTEGER,
ADD COLUMN     "moderated_at" TIMESTAMP(3),
ADD COLUMN     "moderation_status" "ReviewModeration" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "professionalism_rating" INTEGER,
ADD COLUMN     "punctuality_rating" INTEGER;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "service_id" UUID,
ADD COLUMN     "service_name" TEXT;

-- CreateTable
CREATE TABLE "doctor_services" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "doctor_id" UUID NOT NULL,
    "kind" "DoctorServiceKind" NOT NULL DEFAULT 'NEW_PATIENT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modes" "AppointmentMode"[] DEFAULT ARRAY[]::"AppointmentMode"[],
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "price" DECIMAL(14,2) NOT NULL,
    "follow_up_price" DECIMAL(14,2),
    "follow_up_window_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "icd10_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cancellation_terms" TEXT,
    "refund_terms" TEXT,
    "includes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "add_ons" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "doctor_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_portfolio_items" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "doctor_id" UUID NOT NULL,
    "type" "PortfolioItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "external_url" TEXT,
    "published_at" TIMESTAMP(3),
    "attachment_file_id" UUID,
    "visibility" "PortfolioVisibility" NOT NULL DEFAULT 'PRIVATE',
    "consent_status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "consent_at" TIMESTAMP(3),

    CONSTRAINT "doctor_portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_files" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doctor_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_bytes" INTEGER NOT NULL,

    CONSTRAINT "doctor_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doctor_services_doctor_id_idx" ON "doctor_services"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_portfolio_items_doctor_id_type_idx" ON "doctor_portfolio_items"("doctor_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_files_storage_key_key" ON "doctor_files"("storage_key");

-- CreateIndex
CREATE INDEX "doctor_files_doctor_id_idx" ON "doctor_files"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_profiles_cv_file_id_key" ON "doctor_profiles"("cv_file_id");

-- AddForeignKey
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_cv_file_id_fkey" FOREIGN KEY ("cv_file_id") REFERENCES "doctor_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_services" ADD CONSTRAINT "doctor_services_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_portfolio_items" ADD CONSTRAINT "doctor_portfolio_items_attachment_file_id_fkey" FOREIGN KEY ("attachment_file_id") REFERENCES "doctor_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_portfolio_items" ADD CONSTRAINT "doctor_portfolio_items_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_files" ADD CONSTRAINT "doctor_files_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "doctor_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
