-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('LAB_REPORT', 'DIAGNOSTIC_REPORT', 'IMAGING_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY', 'REFERRAL_LETTER', 'VACCINATION_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "DoseStatus" AS ENUM ('SCHEDULED', 'ACKNOWLEDGED', 'TAKEN', 'MISSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WelfareAlertStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'ESCALATED', 'CANCELLED', 'RESOLVED_NO_ACTION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MEDICATION_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'WELFARE_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_SHARE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_active_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "safety_review_notes" JSONB,
ADD COLUMN     "safety_reviewed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "prescription_items" DROP COLUMN "drug_name",
ADD COLUMN     "activeIngredient" TEXT,
ADD COLUMN     "antibioticClass" TEXT,
ADD COLUMN     "antimicrobial_spectrum" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "clinical_override_notes" TEXT,
ADD COLUMN     "coverageNotes" TEXT,
ADD COLUMN     "doseUnit" TEXT,
ADD COLUMN     "doseValue" DOUBLE PRECISION,
ADD COLUMN     "drugClass" TEXT,
ADD COLUMN     "drugName" TEXT NOT NULL,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "foodInstructions" TEXT,
ADD COLUMN     "formulation" TEXT,
ADD COLUMN     "frequencyText" TEXT,
ADD COLUMN     "indication" TEXT,
ADD COLUMN     "medication_ref_id" UUID,
ADD COLUMN     "missedDoseInstructions" TEXT,
ADD COLUMN     "monitoring" TEXT,
ADD COLUMN     "pharmacologicalClass" TEXT,
ADD COLUMN     "precautions" TEXT,
ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "refills" INTEGER DEFAULT 0,
ADD COLUMN     "route" TEXT,
ADD COLUMN     "schedule" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "strength" TEXT;

-- CreateTable
CREATE TABLE "facility_websites" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "template" VARCHAR(60) NOT NULL DEFAULT 'medical-centre',
    "draft_layout" JSONB NOT NULL DEFAULT '{}',
    "published_layout" JSONB,
    "add_ons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_at" TIMESTAMP(3),
    "draft_saved_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_website_revisions" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "layout" JSONB NOT NULL,
    "addOns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_website_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_references" (
    "id" UUID NOT NULL,
    "rx_cui" TEXT,
    "name" TEXT NOT NULL,
    "activeIngredient" TEXT,
    "drugClass" TEXT,
    "pharmacologicalClass" TEXT,
    "antibioticClass" TEXT,
    "antimicrobial_spectrum" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "common_routes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "formulations" TEXT[],
    "interaction_source" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_source" TEXT,
    "last_reviewed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_documents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "fileName" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "issuing_facility" VARCHAR(200),
    "issued_on" TIMESTAMP(3),
    "notes" TEXT,
    "uploaded_by_id" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_shares" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "shared_with_user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "document_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_reminders" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "prescription_item_id" UUID,
    "label" VARCHAR(200) NOT NULL,
    "times" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "start_date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "snooze_minutes" INTEGER NOT NULL DEFAULT 15,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dose_events" (
    "id" UUID NOT NULL,
    "reminder_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" "DoseStatus" NOT NULL DEFAULT 'SCHEDULED',
    "acknowledged_at" TIMESTAMP(3),
    "recorded_at" TIMESTAMP(3),
    "recorded_by_id" UUID,
    "recorded_via" VARCHAR(20),
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dose_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_contacts" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "relationship" VARCHAR(60) NOT NULL,
    "phone" VARCHAR(40),
    "email" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trusted_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inactivity_rules" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "threshold_hours" INTEGER NOT NULL DEFAULT 48,
    "escalation_hours" INTEGER,
    "grace_period_minutes" INTEGER NOT NULL DEFAULT 0,
    "quiet_hours_start" INTEGER,
    "quiet_hours_end" INTEGER,
    "contact_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT false,
    "consent_at" TIMESTAMP(3),
    "consent_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inactivity_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welfare_alerts" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "status" "WelfareAlertStatus" NOT NULL DEFAULT 'PENDING',
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledged_by_contact_id" UUID,
    "acknowledged_by_user_id" UUID,
    "resolvedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "welfare_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welfare_alert_deliveries" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "channel" VARCHAR(10) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "welfare_alert_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facility_websites_facility_id_key" ON "facility_websites"("facility_id");

-- CreateIndex
CREATE INDEX "facility_website_revisions_website_id_created_at_idx" ON "facility_website_revisions"("website_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "medication_references_rx_cui_key" ON "medication_references"("rx_cui");

-- CreateIndex
CREATE INDEX "medication_references_name_idx" ON "medication_references"("name");

-- CreateIndex
CREATE UNIQUE INDEX "patient_documents_storage_key_key" ON "patient_documents"("storage_key");

-- CreateIndex
CREATE INDEX "patient_documents_patient_id_created_at_idx" ON "patient_documents"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "document_shares_shared_with_user_id_idx" ON "document_shares"("shared_with_user_id");

-- CreateIndex
CREATE INDEX "document_shares_document_id_idx" ON "document_shares"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "medication_reminders_prescription_item_id_key" ON "medication_reminders"("prescription_item_id");

-- CreateIndex
CREATE INDEX "medication_reminders_patient_id_active_idx" ON "medication_reminders"("patient_id", "active");

-- CreateIndex
CREATE INDEX "dose_events_patient_id_scheduled_for_idx" ON "dose_events"("patient_id", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "dose_events_reminder_id_scheduled_for_key" ON "dose_events"("reminder_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "trusted_contacts_patient_id_idx" ON "trusted_contacts"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "inactivity_rules_patient_id_key" ON "inactivity_rules"("patient_id");

-- CreateIndex
CREATE INDEX "welfare_alerts_rule_id_status_idx" ON "welfare_alerts"("rule_id", "status");

-- CreateIndex
CREATE INDEX "welfare_alert_deliveries_alert_id_idx" ON "welfare_alert_deliveries"("alert_id");

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_medication_ref_id_fkey" FOREIGN KEY ("medication_ref_id") REFERENCES "medication_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_websites" ADD CONSTRAINT "facility_websites_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_website_revisions" ADD CONSTRAINT "facility_website_revisions_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "facility_websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "patient_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_shares" ADD CONSTRAINT "document_shares_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_reminders" ADD CONSTRAINT "medication_reminders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_reminders" ADD CONSTRAINT "medication_reminders_prescription_item_id_fkey" FOREIGN KEY ("prescription_item_id") REFERENCES "prescription_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dose_events" ADD CONSTRAINT "dose_events_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "medication_reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dose_events" ADD CONSTRAINT "dose_events_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_contacts" ADD CONSTRAINT "trusted_contacts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_contacts" ADD CONSTRAINT "trusted_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inactivity_rules" ADD CONSTRAINT "inactivity_rules_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_alerts" ADD CONSTRAINT "welfare_alerts_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "inactivity_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_alert_deliveries" ADD CONSTRAINT "welfare_alert_deliveries_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "welfare_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

