-- CreateEnum
CREATE TYPE "FacilityKind" AS ENUM ('LABORATORY', 'DIAGNOSTIC_CENTRE', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "SpecimenStatus" AS ENUM ('PENDING_COLLECTION', 'COLLECTED', 'RECEIVED', 'REJECTED', 'RECOLLECTION_REQUESTED', 'PROCESSED');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ACTIVE', 'DISCHARGED', 'TRANSFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DischargeDisposition" AS ENUM ('RECOVERED', 'IMPROVED', 'UNCHANGED', 'WORSE', 'DECEASED', 'REFERRED');

-- CreateEnum
CREATE TYPE "AdmissionNoteType" AS ENUM ('ADMISSION_EXAMINATION', 'PHYSICIAN_PROGRESS', 'NURSING_OBSERVATION', 'SPECIALIST_CONSULTATION', 'PROCEDURE_REPORT');

-- CreateEnum
CREATE TYPE "DiagnosticReportStatus" AS ENUM ('DRAFT', 'AWAITING_VERIFICATION', 'FINALIZED', 'SENT', 'AMENDED');

-- CreateEnum
CREATE TYPE "CriticalAlertStatus" AS ENUM ('SENT', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FacilityDocumentTemplateKind" ADD VALUE 'DISCHARGE_SUMMARY';
ALTER TYPE "FacilityDocumentTemplateKind" ADD VALUE 'EPICRISIS';
ALTER TYPE "FacilityDocumentTemplateKind" ADD VALUE 'ADMISSION_NOTE';
ALTER TYPE "FacilityDocumentTemplateKind" ADD VALUE 'PROGRESS_NOTE';
ALTER TYPE "FacilityDocumentTemplateKind" ADD VALUE 'TRANSFER_SUMMARY';
ALTER TYPE "FacilityDocumentTemplateKind" ADD VALUE 'DIAGNOSTIC_REPORT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LabOrderStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "LabOrderStatus" ADD VALUE 'SPECIMEN_PENDING';
ALTER TYPE "LabOrderStatus" ADD VALUE 'SPECIMEN_REJECTED';
ALTER TYPE "LabOrderStatus" ADD VALUE 'AWAITING_VERIFICATION';
ALTER TYPE "LabOrderStatus" ADD VALUE 'FINALIZED';
ALTER TYPE "LabOrderStatus" ADD VALUE 'SENT_TO_FACILITY';
ALTER TYPE "LabOrderStatus" ADD VALUE 'AMENDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CRITICAL_RESULT';
ALTER TYPE "NotificationType" ADD VALUE 'INVESTIGATION_UPDATE';

-- AlterTable
ALTER TABLE "lab_staff_profiles" ADD COLUMN     "kind" "FacilityKind";

-- AlterTable
ALTER TABLE "lab_orders" ADD COLUMN     "performing_facility_id" UUID,
ADD COLUMN     "requesting_facility_id" UUID;

-- AlterTable
ALTER TABLE "facility_bookings" ADD COLUMN     "requesting_facility_id" UUID;

-- CreateTable
CREATE TABLE "specimens" (
    "id" UUID NOT NULL,
    "lab_order_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "accession_number" TEXT NOT NULL,
    "specimenType" TEXT,
    "status" "SpecimenStatus" NOT NULL DEFAULT 'PENDING_COLLECTION',
    "collected_at" TIMESTAMP(3),
    "collected_by_id" UUID,
    "received_at" TIMESTAMP(3),
    "received_by_id" UUID,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "parent_specimen_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specimens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_accession_counters" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "facility_accession_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "case_id" UUID,
    "admitting_doctor_id" UUID,
    "ward" TEXT,
    "bed" TEXT,
    "admission_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "initial_assessment" TEXT,
    "working_diagnosis" TEXT,
    "diagnosis_code" TEXT,
    "diagnosis_name" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "discharge_date" TIMESTAMP(3),
    "disposition" "DischargeDisposition",
    "final_diagnosis_code" TEXT,
    "final_diagnosis_name" TEXT,
    "outcome" TEXT,
    "epicrisis" TEXT,
    "medication_instructions" TEXT,
    "follow_up_instructions" TEXT,
    "discharged_by_id" UUID,
    "discharged_at" TIMESTAMP(3),
    "transferred_to_facility_id" UUID,
    "transfer_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_notes" (
    "id" UUID NOT NULL,
    "admission_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "type" "AdmissionNoteType" NOT NULL,
    "content" TEXT NOT NULL,
    "vitals" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ward_transfers" (
    "id" UUID NOT NULL,
    "admission_id" UUID NOT NULL,
    "fromWard" TEXT,
    "toWard" TEXT NOT NULL,
    "reason" TEXT,
    "actor_id" UUID NOT NULL,
    "transferred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_reports" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "status" "DiagnosticReportStatus" NOT NULL DEFAULT 'DRAFT',
    "preliminary_findings" TEXT,
    "specialist_interpretation" TEXT,
    "recommendations" TEXT,
    "drafted_by_id" UUID,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "signed_by_id" UUID,
    "signed_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "sent_to_facility_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_report_versions" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_images" (
    "id" UUID NOT NULL,
    "report_id" UUID,
    "booking_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_result_amendments" (
    "id" UUID NOT NULL,
    "lab_result_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_snapshot" JSONB NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_result_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "critical_result_alerts" (
    "id" UUID NOT NULL,
    "lab_result_id" UUID NOT NULL,
    "lab_order_id" UUID,
    "patient_id" UUID NOT NULL,
    "ordering_facility_id" UUID,
    "notifiedUserId" TEXT,
    "status" "CriticalAlertStatus" NOT NULL DEFAULT 'SENT',
    "acknowledged_by_id" UUID,
    "acknowledgedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "critical_result_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "specimens_lab_order_id_idx" ON "specimens"("lab_order_id");

-- CreateIndex
CREATE INDEX "specimens_facility_id_status_idx" ON "specimens"("facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "specimens_facility_id_accession_number_key" ON "specimens"("facility_id", "accession_number");

-- CreateIndex
CREATE INDEX "admissions_facility_id_status_idx" ON "admissions"("facility_id", "status");

-- CreateIndex
CREATE INDEX "admissions_patient_id_admission_date_idx" ON "admissions"("patient_id", "admission_date" DESC);

-- CreateIndex
CREATE INDEX "admission_notes_admission_id_created_at_idx" ON "admission_notes"("admission_id", "created_at");

-- CreateIndex
CREATE INDEX "ward_transfers_admission_id_transferred_at_idx" ON "ward_transfers"("admission_id", "transferred_at");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_reports_booking_id_key" ON "diagnostic_reports"("booking_id");

-- CreateIndex
CREATE INDEX "diagnostic_reports_facility_id_status_idx" ON "diagnostic_reports"("facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_report_versions_report_id_version_key" ON "diagnostic_report_versions"("report_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_images_storage_key_key" ON "diagnostic_images"("storage_key");

-- CreateIndex
CREATE INDEX "diagnostic_images_booking_id_idx" ON "diagnostic_images"("booking_id");

-- CreateIndex
CREATE INDEX "lab_result_amendments_lab_result_id_created_at_idx" ON "lab_result_amendments"("lab_result_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "critical_result_alerts_lab_result_id_key" ON "critical_result_alerts"("lab_result_id");

-- CreateIndex
CREATE INDEX "critical_result_alerts_status_idx" ON "critical_result_alerts"("status");

-- CreateIndex
CREATE INDEX "critical_result_alerts_ordering_facility_id_status_idx" ON "critical_result_alerts"("ordering_facility_id", "status");

-- CreateIndex
CREATE INDEX "lab_orders_performing_facility_id_status_idx" ON "lab_orders"("performing_facility_id", "status");

-- CreateIndex
CREATE INDEX "lab_orders_requesting_facility_id_status_idx" ON "lab_orders"("requesting_facility_id", "status");

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_requesting_facility_id_fkey" FOREIGN KEY ("requesting_facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_performing_facility_id_fkey" FOREIGN KEY ("performing_facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_requesting_facility_id_fkey" FOREIGN KEY ("requesting_facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specimens" ADD CONSTRAINT "specimens_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "lab_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specimens" ADD CONSTRAINT "specimens_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specimens" ADD CONSTRAINT "specimens_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specimens" ADD CONSTRAINT "specimens_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specimens" ADD CONSTRAINT "specimens_parent_specimen_id_fkey" FOREIGN KEY ("parent_specimen_id") REFERENCES "specimens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_admitting_doctor_id_fkey" FOREIGN KEY ("admitting_doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_transferred_to_facility_id_fkey" FOREIGN KEY ("transferred_to_facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_notes" ADD CONSTRAINT "admission_notes_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_notes" ADD CONSTRAINT "admission_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_transfers" ADD CONSTRAINT "ward_transfers_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_transfers" ADD CONSTRAINT "ward_transfers_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "facility_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_drafted_by_id_fkey" FOREIGN KEY ("drafted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_sent_to_facility_id_fkey" FOREIGN KEY ("sent_to_facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_report_versions" ADD CONSTRAINT "diagnostic_report_versions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "diagnostic_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_report_versions" ADD CONSTRAINT "diagnostic_report_versions_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_images" ADD CONSTRAINT "diagnostic_images_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "diagnostic_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_images" ADD CONSTRAINT "diagnostic_images_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "facility_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_images" ADD CONSTRAINT "diagnostic_images_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_amendments" ADD CONSTRAINT "lab_result_amendments_lab_result_id_fkey" FOREIGN KEY ("lab_result_id") REFERENCES "lab_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_amendments" ADD CONSTRAINT "lab_result_amendments_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_result_alerts" ADD CONSTRAINT "critical_result_alerts_lab_result_id_fkey" FOREIGN KEY ("lab_result_id") REFERENCES "lab_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_result_alerts" ADD CONSTRAINT "critical_result_alerts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_result_alerts" ADD CONSTRAINT "critical_result_alerts_ordering_facility_id_fkey" FOREIGN KEY ("ordering_facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "critical_result_alerts" ADD CONSTRAINT "critical_result_alerts_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill the facility kind from the owner's account type so organization
-- scoping works without a join, and future profiles set it explicitly.
UPDATE "lab_staff_profiles" p
SET "kind" = u."account_type"::text::"FacilityKind"
FROM "users" u
WHERE u."id" = p."user_id"
  AND u."account_type" IN ('LABORATORY', 'DIAGNOSTIC_CENTRE', 'HOSPITAL');
