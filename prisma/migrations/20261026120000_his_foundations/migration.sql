-- HIS foundations: hospital settings, versioned clinical document templates,
-- clinical documents (signatures, amendments, events), encounters with care
-- priority/workflow status, payer coverage, and diagnostic media metadata.
-- Additive only: new enums/tables plus new enum values; existing rows untouched.

-- CreateEnum
CREATE TYPE "TemplateLifecycle" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ClinicalDocumentStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PENDING_SIGNATURE', 'FINAL', 'AMENDED', 'ENTERED_IN_ERROR');

-- CreateEnum
CREATE TYPE "DocumentSensitivity" AS ENUM ('STANDARD', 'RESTRICTED', 'SPECIALLY_PROTECTED');

-- CreateEnum
CREATE TYPE "SignatureRole" AS ENUM ('AUTHOR', 'CO_SIGNER', 'REVIEWER', 'VERIFIER', 'DEPARTMENT_HEAD', 'PATIENT', 'AUTHORIZED_REPRESENTATIVE', 'CLINICIAN_OBTAINING_CONSENT', 'WITNESS', 'INTERPRETER');

-- CreateEnum
CREATE TYPE "SignatureMethod" AS ENUM ('AUTHENTICATED_ELECTRONIC', 'HANDWRITTEN_ATTESTED');

-- CreateEnum
CREATE TYPE "CarePriority" AS ENUM ('EMERGENCY', 'URGENT', 'SEMI_URGENT', 'ROUTINE', 'ELECTIVE');

-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('EMERGENCY_DEPARTMENT', 'UNSCHEDULED_OUTPATIENT', 'SCHEDULED_OUTPATIENT', 'PLANNED_INPATIENT', 'EMERGENCY_INPATIENT', 'DAY_SURGERY', 'PLANNED_PROCEDURE', 'EMERGENCY_PROCEDURE', 'OBSERVATION', 'TRANSFER_IN', 'FOLLOW_UP', 'OTHER');

-- CreateEnum
CREATE TYPE "EncounterWorkflowStatus" AS ENUM ('REGISTERED', 'AWAITING_TRIAGE', 'TRIAGED', 'AWAITING_CLINICIAN', 'UNDER_ASSESSMENT', 'AWAITING_INVESTIGATIONS', 'AWAITING_SPECIALIST', 'AWAITING_TREATMENT', 'AWAITING_ADMISSION', 'ADMITTED', 'IN_PROCEDURE', 'RECOVERING', 'AWAITING_DISCHARGE', 'DISCHARGED', 'TRANSFERRED', 'CANCELLED', 'DID_NOT_ATTEND');

-- CreateEnum
CREATE TYPE "PayerCategory" AS ENUM ('PUBLIC_INSURANCE', 'PRIVATE_INSURANCE', 'EMPLOYER_SPONSORED', 'GOVERNMENT_SUBSIDIZED', 'INTERNATIONAL_INSURANCE', 'TRAVEL_INSURANCE', 'SELF_PAY', 'UNINSURED', 'CHARITY', 'OTHER');

-- CreateEnum
CREATE TYPE "CoverageEligibility" AS ENUM ('NOT_VERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('XRAY', 'CT', 'MRI', 'ULTRASOUND', 'ECHOCARDIOGRAPHY', 'ECG_HOLTER', 'EEG', 'ENDOSCOPY', 'GASTROSCOPY', 'COLONOSCOPY', 'ANGIOGRAPHY', 'MAMMOGRAPHY', 'DOPPLER', 'FLUOROSCOPY', 'NUCLEAR_MEDICINE', 'PULMONARY_FUNCTION', 'LABORATORY_REPORT', 'PATHOLOGY_HISTOLOGY', 'MICROBIOLOGY', 'AUDIOLOGY', 'OPHTHALMIC', 'PRESSURE_THERAPY', 'REHABILITATION', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaReportStatus" AS ENUM ('UNREPORTED', 'PRELIMINARY', 'VERIFIED', 'AMENDED');

-- CreateEnum
CREATE TYPE "MediaScanStatus" AS ENUM ('NOT_SCANNED', 'CLEAN', 'INFECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FacilityStaffRole" ADD VALUE 'RADIOLOGIST';
ALTER TYPE "FacilityStaffRole" ADD VALUE 'DIAGNOSTIC_SPECIALIST';
ALTER TYPE "FacilityStaffRole" ADD VALUE 'PHARMACIST';
ALTER TYPE "FacilityStaffRole" ADD VALUE 'SURGEON';
ALTER TYPE "FacilityStaffRole" ADD VALUE 'DEPARTMENT_HEAD';
ALTER TYPE "FacilityStaffRole" ADD VALUE 'MEDICAL_RECORDS_OFFICER';
ALTER TYPE "FacilityStaffRole" ADD VALUE 'BILLING_OFFICER';
ALTER TYPE "FacilityStaffRole" ADD VALUE 'INSURANCE_OFFICER';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CLINICAL_DOCUMENT';

-- CreateTable
CREATE TABLE "hospital_settings" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "display_name" VARCHAR(200),
    "letterhead_lines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logo_url" VARCHAR(500),
    "address_line" VARCHAR(300),
    "contact_phone" VARCHAR(40),
    "contact_email" VARCHAR(120),
    "default_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "date_format" VARCHAR(20) NOT NULL DEFAULT 'dd/MM/yyyy',
    "time_zone" VARCHAR(60) NOT NULL DEFAULT 'Africa/Lagos',
    "document_number_prefix" VARCHAR(12) NOT NULL DEFAULT 'DOC',
    "page_size" VARCHAR(10) NOT NULL DEFAULT 'A4',
    "footer_text" VARCHAR(300),
    "enabled_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "terminology" JSONB NOT NULL DEFAULT '{}',
    "triage_protocol" VARCHAR(120),
    "triage_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overdue_minutes" INTEGER NOT NULL DEFAULT 60,
    "independent_template_approval" BOOLEAN NOT NULL DEFAULT true,
    "default_retention_category" VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_settings_revisions" (
    "id" UUID NOT NULL,
    "settings_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_settings_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_document_templates" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "group_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "source_code" VARCHAR(120),
    "departments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialty" VARCHAR(80),
    "published_version" INTEGER,
    "retired_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_document_template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TemplateLifecycle" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL,
    "change_note" VARCHAR(500),
    "edited_by_id" UUID NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "published_by_id" UUID,
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_document_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_documents" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "admission_id" UUID,
    "template_version_id" UUID NOT NULL,
    "document_number" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "group_code" VARCHAR(10) NOT NULL,
    "department" VARCHAR(120),
    "status" "ClinicalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "sensitivity" "DocumentSensitivity" NOT NULL DEFAULT 'STANDARD',
    "content" JSONB NOT NULL DEFAULT '{}',
    "content_hash" VARCHAR(64),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersedes_id" UUID,
    "amendment_reason" TEXT,
    "author_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "released_to_patient_at" TIMESTAMP(3),
    "released_by_id" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_signatures" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "role" "SignatureRole" NOT NULL,
    "method" "SignatureMethod" NOT NULL,
    "signer_user_id" UUID,
    "attested_by_id" UUID,
    "signer_name" VARCHAR(160) NOT NULL,
    "signer_title" VARCHAR(160),
    "registration_id" VARCHAR(80),
    "relationship" VARCHAR(80),
    "content_hash" VARCHAR(64) NOT NULL,
    "template_version" INTEGER NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,

    CONSTRAINT "document_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_document_events" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_document_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_sequences" (
    "facility_id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "facility_sequences_pkey" PRIMARY KEY ("facility_id","name","year")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_number" VARCHAR(40) NOT NULL,
    "type" "EncounterType" NOT NULL,
    "priority" "CarePriority" NOT NULL DEFAULT 'ROUTINE',
    "status" "EncounterWorkflowStatus" NOT NULL DEFAULT 'REGISTERED',
    "department" VARCHAR(120),
    "clinician_name" VARCHAR(160),
    "chief_complaint" TEXT,
    "triage_category" VARCHAR(60),
    "triage_protocol" VARCHAR(120),
    "triaged_by_id" UUID,
    "triaged_at" TIMESTAMP(3),
    "admission_id" UUID,
    "coverage_id" UUID,
    "payer_category" "PayerCategory",
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_status_events" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "from_status" "EncounterWorkflowStatus",
    "to_status" "EncounterWorkflowStatus" NOT NULL,
    "priority" "CarePriority",
    "note" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payer_coverages" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "category" "PayerCategory" NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "provider_name" VARCHAR(160),
    "plan_name" VARCHAR(160),
    "member_number" VARCHAR(80),
    "coverage_start" DATE,
    "coverage_end" DATE,
    "eligibility" "CoverageEligibility" NOT NULL DEFAULT 'NOT_VERIFIED',
    "benefit_notes" TEXT,
    "referral_required" BOOLEAN NOT NULL DEFAULT false,
    "preauth_required" BOOLEAN NOT NULL DEFAULT false,
    "authorization_number" VARCHAR(80),
    "authorization_expires" DATE,
    "claim_status" "ClaimStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "billing_responsibility" VARCHAR(160),
    "copay_kobo" INTEGER,
    "out_of_pocket_kobo" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ended_at" TIMESTAMP(3),
    "ended_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payer_coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_verifications" (
    "id" UUID NOT NULL,
    "coverage_id" UUID NOT NULL,
    "eligibility" "CoverageEligibility" NOT NULL,
    "claim_status" "ClaimStatus",
    "note" TEXT,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coverage_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_media" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "category" "MediaCategory" NOT NULL,
    "is_therapy_record" BOOLEAN NOT NULL DEFAULT false,
    "examination_type" VARCHAR(160) NOT NULL,
    "examination_at" TIMESTAMP(3),
    "department" VARCHAR(120),
    "ordering_clinician" VARCHAR(160),
    "performing_facility" VARCHAR(200),
    "reporting_clinician" VARCHAR(160),
    "report_status" "MediaReportStatus" NOT NULL DEFAULT 'UNREPORTED',
    "modality" VARCHAR(40),
    "device" VARCHAR(160),
    "body_site" VARCHAR(120),
    "contrast_details" VARCHAR(300),
    "accession_number" VARCHAR(80),
    "study_instance_uid" VARCHAR(128),
    "external_reference" VARCHAR(160),
    "related_order_ref" VARCHAR(80),
    "file_name" VARCHAR(200) NOT NULL,
    "format_key" VARCHAR(30) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "scan_status" "MediaScanStatus" NOT NULL DEFAULT 'NOT_SCANNED',
    "sensitivity" "DocumentSensitivity" NOT NULL DEFAULT 'STANDARD',
    "retention_category" VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
    "released_to_patient_at" TIMESTAMP(3),
    "uploaded_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hospital_settings_facility_id_key" ON "hospital_settings"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_settings_revisions_settings_id_version_key" ON "hospital_settings_revisions"("settings_id", "version");

-- CreateIndex
CREATE INDEX "clinical_document_templates_facility_id_group_code_idx" ON "clinical_document_templates"("facility_id", "group_code");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_document_templates_facility_id_code_key" ON "clinical_document_templates"("facility_id", "code");

-- CreateIndex
CREATE INDEX "clinical_document_template_versions_status_idx" ON "clinical_document_template_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_document_template_versions_template_id_version_key" ON "clinical_document_template_versions"("template_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_documents_supersedes_id_key" ON "clinical_documents"("supersedes_id");

-- CreateIndex
CREATE INDEX "clinical_documents_facility_id_status_idx" ON "clinical_documents"("facility_id", "status");

-- CreateIndex
CREATE INDEX "clinical_documents_patient_id_created_at_idx" ON "clinical_documents"("patient_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "clinical_documents_facility_id_document_number_key" ON "clinical_documents"("facility_id", "document_number");

-- CreateIndex
CREATE INDEX "document_signatures_document_id_idx" ON "document_signatures"("document_id");

-- CreateIndex
CREATE INDEX "clinical_document_events_document_id_created_at_idx" ON "clinical_document_events"("document_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_admission_id_key" ON "encounters"("admission_id");

-- CreateIndex
CREATE INDEX "encounters_facility_id_status_idx" ON "encounters"("facility_id", "status");

-- CreateIndex
CREATE INDEX "encounters_facility_id_priority_idx" ON "encounters"("facility_id", "priority");

-- CreateIndex
CREATE INDEX "encounters_patient_id_registered_at_idx" ON "encounters"("patient_id", "registered_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "encounters_facility_id_encounter_number_key" ON "encounters"("facility_id", "encounter_number");

-- CreateIndex
CREATE INDEX "encounter_status_events_encounter_id_created_at_idx" ON "encounter_status_events"("encounter_id", "created_at");

-- CreateIndex
CREATE INDEX "payer_coverages_facility_id_active_category_idx" ON "payer_coverages"("facility_id", "active", "category");

-- CreateIndex
CREATE INDEX "payer_coverages_patient_id_idx" ON "payer_coverages"("patient_id");

-- CreateIndex
CREATE INDEX "coverage_verifications_coverage_id_created_at_idx" ON "coverage_verifications"("coverage_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "medical_media_storage_key_key" ON "medical_media"("storage_key");

-- CreateIndex
CREATE INDEX "medical_media_facility_id_category_idx" ON "medical_media"("facility_id", "category");

-- CreateIndex
CREATE INDEX "medical_media_patient_id_created_at_idx" ON "medical_media"("patient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "medical_media_patient_id_sha256_idx" ON "medical_media"("patient_id", "sha256");

-- AddForeignKey
ALTER TABLE "hospital_settings" ADD CONSTRAINT "hospital_settings_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_settings_revisions" ADD CONSTRAINT "hospital_settings_revisions_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "hospital_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_document_templates" ADD CONSTRAINT "clinical_document_templates_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_document_template_versions" ADD CONSTRAINT "clinical_document_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "clinical_document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "clinical_document_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "clinical_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "clinical_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_document_events" ADD CONSTRAINT "clinical_document_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "clinical_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_coverage_id_fkey" FOREIGN KEY ("coverage_id") REFERENCES "payer_coverages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_status_events" ADD CONSTRAINT "encounter_status_events_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payer_coverages" ADD CONSTRAINT "payer_coverages_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payer_coverages" ADD CONSTRAINT "payer_coverages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_verifications" ADD CONSTRAINT "coverage_verifications_coverage_id_fkey" FOREIGN KEY ("coverage_id") REFERENCES "payer_coverages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_media" ADD CONSTRAINT "medical_media_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_media" ADD CONSTRAINT "medical_media_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_media" ADD CONSTRAINT "medical_media_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
