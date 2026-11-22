-- Investigations platform: central catalogue, orders, workflow, results, reports, critical alerts.
-- DDL for the Prisma models plus hand-written integrity triggers and facility RLS.

-- CreateEnum
CREATE TYPE "InvestigationDomain" AS ENUM ('LABORATORY', 'DIAGNOSTIC');

-- CreateEnum
CREATE TYPE "InvestigationCatalogueSource" AS ENUM ('SYSTEM', 'FACILITY');

-- CreateEnum
CREATE TYPE "InvestigationReportFormat" AS ENUM ('LAB_PANEL', 'NARRATIVE', 'ULTRASOUND', 'MRI', 'CT', 'XRAY', 'MAMMOGRAPHY', 'ECHOCARDIOGRAPHY', 'ECG', 'EEG', 'ENDOSCOPY', 'GENERIC');

-- CreateEnum
CREATE TYPE "InvestigationPriority" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "InvestigationOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvestigationItemStatus" AS ENUM ('NEW_REQUEST', 'AWAITING_SAMPLE', 'SAMPLE_COLLECTED', 'SAMPLE_RECEIVED', 'SAMPLE_REJECTED', 'ASSIGNED_TO_SECTION', 'PROCESSING', 'ANALYSIS_COMPLETED', 'RESULT_ENTERED', 'AWAITING_APPOINTMENT', 'APPOINTMENT_SCHEDULED', 'PATIENT_PREPARATION', 'CHECKED_IN', 'EXAM_IN_PROGRESS', 'EXAM_COMPLETED', 'MEDIA_UPLOADED', 'AWAITING_INTERPRETATION', 'PRELIMINARY_REPORT', 'AWAITING_VERIFICATION', 'VERIFIED', 'SIGNED', 'RELEASED', 'DELIVERED', 'CANCELLED', 'REFERRAL_PENDING');

-- CreateEnum
CREATE TYPE "InvestigationResultStatus" AS ENUM ('DRAFT', 'PRELIMINARY', 'AWAITING_VERIFICATION', 'VERIFIED', 'SIGNED', 'RELEASED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "InvestigationReferralStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'SCHEDULED', 'COMPLETED', 'REPORT_RETURNED');

-- CreateTable
CREATE TABLE "investigation_categories" (
    "id" UUID NOT NULL,
    "domain" "InvestigationDomain" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "investigation_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_catalogue_items" (
    "id" UUID NOT NULL,
    "domain" "InvestigationDomain" NOT NULL,
    "category_id" UUID NOT NULL,
    "subcategory" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "common_name" TEXT,
    "abbreviation" TEXT,
    "synonyms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "loinc_code" TEXT,
    "snomed_code" TEXT,
    "dicom_modality" TEXT,
    "standard_codes_verified" BOOLEAN NOT NULL DEFAULT false,
    "clinical_discipline" TEXT,
    "specimen_type" TEXT,
    "modality" TEXT,
    "body_site" TEXT,
    "report_format" "InvestigationReportFormat" NOT NULL DEFAULT 'GENERIC',
    "preparation" TEXT,
    "turnaround_minutes" INTEGER,
    "indication_guidance" TEXT,
    "is_panel" BOOLEAN NOT NULL DEFAULT false,
    "panel_member_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "facility_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" "InvestigationCatalogueSource" NOT NULL DEFAULT 'SYSTEM',
    "created_by_facility_id" UUID,
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investigation_catalogue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_analytes" (
    "id" UUID NOT NULL,
    "catalogue_item_id" UUID NOT NULL,
    "facility_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loinc_code" TEXT,
    "ucum_unit" TEXT,
    "valueType" TEXT NOT NULL DEFAULT 'NUMERIC',
    "ref_low" DOUBLE PRECISION,
    "ref_high" DOUBLE PRECISION,
    "critical_low" DOUBLE PRECISION,
    "critical_high" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "investigation_analytes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_investigations" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "catalogue_item_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "department_key" TEXT,
    "price_minor" INTEGER,
    "turnaround_minutes" INTEGER,
    "preparation" TEXT,
    "specimen_requirements" TEXT,
    "report_template" TEXT,
    "responsible_staff_id" UUID,
    "local_code" TEXT,
    "local_aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "facility_investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "domain" "InvestigationDomain" NOT NULL,
    "patient_id" UUID NOT NULL,
    "case_id" UUID,
    "encounter_id" UUID,
    "requested_by_id" UUID NOT NULL,
    "requesting_facility_id" UUID,
    "referring_department" TEXT,
    "status" "InvestigationOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "InvestigationPriority" NOT NULL DEFAULT 'ROUTINE',
    "clinical_indication" TEXT,
    "diagnosis" TEXT,
    "clinical_notes" TEXT,
    "clinical_snapshot" JSONB,
    "authorised_at" TIMESTAMP(3),
    "authorisation_statement" TEXT,
    "submitted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investigation_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "domain" "InvestigationDomain" NOT NULL,
    "catalogue_item_id" UUID,
    "category_id" UUID,
    "department_key" TEXT NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "code_snapshot" TEXT,
    "loinc_snapshot" TEXT,
    "snomed_snapshot" TEXT,
    "dicom_snapshot" TEXT,
    "report_format" "InvestigationReportFormat" NOT NULL DEFAULT 'GENERIC',
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "custom_details" JSONB,
    "specimen_type" TEXT,
    "body_site" TEXT,
    "instructions" TEXT,
    "priority" "InvestigationPriority" NOT NULL DEFAULT 'ROUTINE',
    "preferred_facility_id" UUID,
    "performing_facility_id" UUID,
    "status" "InvestigationItemStatus" NOT NULL DEFAULT 'NEW_REQUEST',
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "scheduling_notes" TEXT,
    "duplicate_override_reason" TEXT,
    "cancel_reason" TEXT,
    "assigned_to_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investigation_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_status_history" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "from_status" "InvestigationItemStatus",
    "to_status" "InvestigationItemStatus" NOT NULL,
    "actor_user_id" UUID,
    "actor_label" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investigation_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_specimens" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "accession_number" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "specimen_type" TEXT,
    "status" "SpecimenStatus" NOT NULL DEFAULT 'PENDING_COLLECTION',
    "collected_at" TIMESTAMP(3),
    "collected_by_id" UUID,
    "received_at" TIMESTAMP(3),
    "received_by_id" UUID,
    "rejection_reason" TEXT,
    "parent_specimen_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investigation_specimens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_results" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "status" "InvestigationResultStatus" NOT NULL DEFAULT 'DRAFT',
    "clinical_indication" TEXT,
    "technique" TEXT,
    "findings" TEXT,
    "impression" TEXT,
    "conclusion" TEXT,
    "recommendations" TEXT,
    "report_data" JSONB,
    "reporter_name" TEXT,
    "reporter_credentials" TEXT,
    "entered_by_id" UUID,
    "entered_at" TIMESTAMP(3),
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "signed_by_id" UUID,
    "signed_at" TIMESTAMP(3),
    "signature_statement" TEXT,
    "released_by_id" UUID,
    "released_at" TIMESTAMP(3),
    "patient_visible" BOOLEAN NOT NULL DEFAULT true,
    "amendment_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investigation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_observations" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "analyte_code" TEXT,
    "name" TEXT NOT NULL,
    "loinc_code" TEXT,
    "value_numeric" DOUBLE PRECISION,
    "value_text" TEXT,
    "unit" TEXT,
    "ref_low" DOUBLE PRECISION,
    "ref_high" DOUBLE PRECISION,
    "ref_text" TEXT,
    "flag" "ResultFlag",
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "investigation_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_media" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "result_id" UUID,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "description" TEXT,
    "dicom_modality" TEXT,
    "study_instance_uid" TEXT,
    "series_instance_uid" TEXT,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investigation_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_critical_alerts" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "notified_user_id" UUID NOT NULL,
    "facility_id" UUID,
    "status" "CriticalAlertStatus" NOT NULL DEFAULT 'SENT',
    "summary" TEXT,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "last_escalated_at" TIMESTAMP(3),
    "acknowledged_by_id" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledgement_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investigation_critical_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_alert_events" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "actor_user_id" UUID,
    "recipient_user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investigation_alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_interpretations" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "doctor_user_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "follow_up_title" TEXT,
    "follow_up_due_at" TIMESTAMP(3),
    "follow_up_done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "investigation_interpretations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_order_sets" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "InvestigationDomain" NOT NULL,
    "catalogue_item_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investigation_order_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_referrals" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "from_facility_id" UUID,
    "to_facility_id" UUID NOT NULL,
    "reason" TEXT,
    "status" "InvestigationReferralStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_by_id" UUID NOT NULL,
    "responded_by_id" UUID,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investigation_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_counters" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "investigation_counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "investigation_categories_domain_key_key" ON "investigation_categories"("domain", "key");

-- CreateIndex
CREATE INDEX "investigation_catalogue_items_domain_category_id_is_active_idx" ON "investigation_catalogue_items"("domain", "category_id", "is_active");

-- CreateIndex
CREATE INDEX "investigation_catalogue_items_created_by_facility_id_idx" ON "investigation_catalogue_items"("created_by_facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_catalogue_items_code_key" ON "investigation_catalogue_items"("code");

-- CreateIndex
CREATE INDEX "investigation_analytes_catalogue_item_id_idx" ON "investigation_analytes"("catalogue_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_investigations_facility_id_catalogue_item_id_key" ON "facility_investigations"("facility_id", "catalogue_item_id");

-- CreateIndex
CREATE INDEX "facility_investigations_catalogue_item_id_is_active_idx" ON "facility_investigations"("catalogue_item_id", "is_active");

-- CreateIndex
CREATE INDEX "investigation_orders_patient_id_created_at_idx" ON "investigation_orders"("patient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "investigation_orders_requested_by_id_status_created_at_idx" ON "investigation_orders"("requested_by_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "investigation_orders_requesting_facility_id_idx" ON "investigation_orders"("requesting_facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_orders_order_number_key" ON "investigation_orders"("order_number");

-- CreateIndex
CREATE INDEX "investigation_order_items_order_id_idx" ON "investigation_order_items"("order_id");

-- CreateIndex
CREATE INDEX "inv_items_worklist_idx" ON "investigation_order_items"("performing_facility_id", "domain", "department_key", "status");

-- CreateIndex
CREATE INDEX "investigation_order_items_catalogue_item_id_idx" ON "investigation_order_items"("catalogue_item_id");

-- CreateIndex
CREATE INDEX "investigation_order_items_status_due_at_idx" ON "investigation_order_items"("status", "due_at");

-- CreateIndex
CREATE INDEX "investigation_status_history_item_id_created_at_idx" ON "investigation_status_history"("item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_specimens_facility_id_accession_number_key" ON "investigation_specimens"("facility_id", "accession_number");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_specimens_facility_id_barcode_key" ON "investigation_specimens"("facility_id", "barcode");

-- CreateIndex
CREATE INDEX "investigation_specimens_item_id_idx" ON "investigation_specimens"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_results_item_id_version_key" ON "investigation_results"("item_id", "version");

-- CreateIndex
CREATE INDEX "investigation_results_status_released_at_idx" ON "investigation_results"("status", "released_at");

-- CreateIndex
CREATE INDEX "investigation_observations_result_id_idx" ON "investigation_observations"("result_id");

-- CreateIndex
CREATE INDEX "investigation_observations_analyte_code_idx" ON "investigation_observations"("analyte_code");

-- CreateIndex
CREATE INDEX "investigation_media_item_id_idx" ON "investigation_media"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_media_storage_key_key" ON "investigation_media"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_critical_alerts_result_id_key" ON "investigation_critical_alerts"("result_id");

-- CreateIndex
CREATE INDEX "investigation_critical_alerts_notified_user_id_status_idx" ON "investigation_critical_alerts"("notified_user_id", "status");

-- CreateIndex
CREATE INDEX "investigation_critical_alerts_status_created_at_idx" ON "investigation_critical_alerts"("status", "created_at");

-- CreateIndex
CREATE INDEX "investigation_alert_events_alert_id_created_at_idx" ON "investigation_alert_events"("alert_id", "created_at");

-- CreateIndex
CREATE INDEX "investigation_interpretations_result_id_idx" ON "investigation_interpretations"("result_id");

-- CreateIndex
CREATE INDEX "inv_interp_doctor_followup_idx" ON "investigation_interpretations"("doctor_user_id", "follow_up_done_at");

-- CreateIndex
CREATE INDEX "investigation_order_sets_owner_user_id_domain_idx" ON "investigation_order_sets"("owner_user_id", "domain");

-- CreateIndex
CREATE INDEX "investigation_referrals_item_id_idx" ON "investigation_referrals"("item_id");

-- CreateIndex
CREATE INDEX "investigation_referrals_to_facility_id_status_idx" ON "investigation_referrals"("to_facility_id", "status");

-- AddForeignKey
ALTER TABLE "investigation_catalogue_items" ADD CONSTRAINT "investigation_catalogue_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "investigation_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_analytes" ADD CONSTRAINT "investigation_analytes_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "investigation_catalogue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_investigations" ADD CONSTRAINT "facility_investigations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_investigations" ADD CONSTRAINT "facility_investigations_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "investigation_catalogue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_orders" ADD CONSTRAINT "investigation_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_orders" ADD CONSTRAINT "investigation_orders_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_orders" ADD CONSTRAINT "investigation_orders_requesting_facility_id_fkey" FOREIGN KEY ("requesting_facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_order_items" ADD CONSTRAINT "investigation_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "investigation_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_order_items" ADD CONSTRAINT "investigation_order_items_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "investigation_catalogue_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_order_items" ADD CONSTRAINT "investigation_order_items_performing_facility_id_fkey" FOREIGN KEY ("performing_facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_status_history" ADD CONSTRAINT "investigation_status_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "investigation_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_specimens" ADD CONSTRAINT "investigation_specimens_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "investigation_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_specimens" ADD CONSTRAINT "investigation_specimens_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_specimens" ADD CONSTRAINT "investigation_specimens_parent_specimen_id_fkey" FOREIGN KEY ("parent_specimen_id") REFERENCES "investigation_specimens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_results" ADD CONSTRAINT "investigation_results_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "investigation_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_observations" ADD CONSTRAINT "investigation_observations_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "investigation_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_media" ADD CONSTRAINT "investigation_media_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "investigation_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_media" ADD CONSTRAINT "investigation_media_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "investigation_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_critical_alerts" ADD CONSTRAINT "investigation_critical_alerts_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "investigation_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_alert_events" ADD CONSTRAINT "investigation_alert_events_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "investigation_critical_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_interpretations" ADD CONSTRAINT "investigation_interpretations_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "investigation_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_order_sets" ADD CONSTRAINT "investigation_order_sets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_referrals" ADD CONSTRAINT "investigation_referrals_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "investigation_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity: signed / released reports are immutable. Corrections append a new
-- version (the old one is flagged SUPERSEDED), so a signed report is never
-- silently replaced.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION investigation_preserve_signed_result() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status::text IN ('SIGNED','RELEASED','SUPERSEDED') THEN
      RAISE EXCEPTION 'Signed investigation reports cannot be deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status::text IN ('SIGNED','RELEASED','SUPERSEDED') THEN
    IF NEW.status::text NOT IN ('SIGNED','RELEASED','SUPERSEDED')
       OR NEW.item_id IS DISTINCT FROM OLD.item_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.clinical_indication IS DISTINCT FROM OLD.clinical_indication
       OR NEW.technique IS DISTINCT FROM OLD.technique
       OR NEW.findings IS DISTINCT FROM OLD.findings
       OR NEW.impression IS DISTINCT FROM OLD.impression
       OR NEW.conclusion IS DISTINCT FROM OLD.conclusion
       OR NEW.recommendations IS DISTINCT FROM OLD.recommendations
       OR NEW.report_data IS DISTINCT FROM OLD.report_data
       OR NEW.reporter_name IS DISTINCT FROM OLD.reporter_name
       OR NEW.reporter_credentials IS DISTINCT FROM OLD.reporter_credentials
       OR NEW.entered_by_id IS DISTINCT FROM OLD.entered_by_id
       OR NEW.entered_at IS DISTINCT FROM OLD.entered_at
       OR NEW.verified_by_id IS DISTINCT FROM OLD.verified_by_id
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       OR NEW.signed_by_id IS DISTINCT FROM OLD.signed_by_id
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.signature_statement IS DISTINCT FROM OLD.signature_statement
       OR NEW.amendment_reason IS DISTINCT FROM OLD.amendment_reason
       OR (OLD.status::text IN ('RELEASED','SUPERSEDED') AND NEW.status::text = 'SIGNED')
       OR (OLD.status::text = 'SUPERSEDED' AND NEW.status::text <> 'SUPERSEDED')
       OR (OLD.released_at IS NOT NULL AND NEW.released_at IS DISTINCT FROM OLD.released_at)
       OR (OLD.released_by_id IS NOT NULL AND NEW.released_by_id IS DISTINCT FROM OLD.released_by_id) THEN
      RAISE EXCEPTION 'Signed investigation reports are immutable; create an amendment' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER investigation_result_immutable BEFORE UPDATE OR DELETE ON investigation_results
FOR EACH ROW EXECUTE FUNCTION investigation_preserve_signed_result();

CREATE OR REPLACE FUNCTION investigation_preserve_signed_observations() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent_status text;
  parent_id uuid;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.result_id ELSE NEW.result_id END;
  SELECT status::text INTO parent_status FROM investigation_results WHERE id = parent_id;
  IF parent_status IN ('SIGNED','RELEASED','SUPERSEDED') THEN
    RAISE EXCEPTION 'Observations of a signed report are immutable; create an amendment' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER investigation_observation_immutable BEFORE INSERT OR UPDATE OR DELETE ON investigation_observations
FOR EACH ROW EXECUTE FUNCTION investigation_preserve_signed_observations();

-- Status history and critical-alert events are append-only.
CREATE OR REPLACE FUNCTION investigation_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Investigation history is append-only' USING ERRCODE = '23514';
END $$;

CREATE TRIGGER investigation_status_history_append_only BEFORE UPDATE ON investigation_status_history
FOR EACH ROW EXECUTE FUNCTION investigation_append_only();
CREATE TRIGGER investigation_alert_events_append_only BEFORE UPDATE ON investigation_alert_events
FOR EACH ROW EXECUTE FUNCTION investigation_append_only();

-- A released / signed result cannot be un-released by flipping the item back.
-- Only one current version per item.
CREATE UNIQUE INDEX "investigation_results_one_current_idx" ON investigation_results (item_id) WHERE is_current;

-- ---------------------------------------------------------------------------
-- Facility row-level security (inert until app.facility_id is set, like the
-- other facility tables): a performing facility sees its items, and the
-- requesting facility sees the items it ordered.
-- ---------------------------------------------------------------------------
ALTER TABLE "investigation_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "investigation_order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "investigation_order_items"
  USING (
    app_facility_visible(performing_facility_id)
    OR EXISTS (SELECT 1 FROM "investigation_orders" o WHERE o.id = order_id AND app_facility_visible(o.requesting_facility_id))
  )
  WITH CHECK (
    app_facility_visible(performing_facility_id)
    OR performing_facility_id IS NULL
    OR EXISTS (SELECT 1 FROM "investigation_orders" o WHERE o.id = order_id AND app_facility_visible(o.requesting_facility_id))
  );

ALTER TABLE "investigation_specimens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "investigation_specimens" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "investigation_specimens" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));
