-- CreateEnum
CREATE TYPE "StaffAccessLevel" AS ENUM ('LIMITED', 'STANDARD', 'EXTENDED', 'FULL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StaffPatientAccessScope" AS ENUM ('CARE_TEAM', 'DEPARTMENT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "ControlledRegisterEventType" AS ENUM ('RECEIVED', 'DISPENSED', 'DESTROYED', 'RETURNED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LabEquipmentStatus" AS ENUM ('OPERATIONAL', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'CALIBRATION');

-- CreateEnum
CREATE TYPE "QualityControlResult" AS ENUM ('PASS', 'FAIL', 'WARNING');

-- CreateEnum
CREATE TYPE "NursingAssessmentType" AS ENUM ('FALL_RISK', 'PRESSURE_INJURY', 'WOUND_CARE', 'INTAKE_OUTPUT', 'GENERIC');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "unidentified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "facility_staff" ADD COLUMN     "access_level" "StaffAccessLevel" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "custom_category" VARCHAR(120),
ADD COLUMN     "department_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "permission_overrides" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "specimens" ADD COLUMN     "barcode" TEXT;

-- AlterTable
ALTER TABLE "admissions" ADD COLUMN     "current_bed_id" UUID,
ADD COLUMN     "current_ward_id" UUID;

-- AlterTable
ALTER TABLE "ward_transfers" ADD COLUMN     "from_bed_id" UUID,
ADD COLUMN     "to_bed_id" UUID;

-- AlterTable
ALTER TABLE "encounters" ADD COLUMN     "arrival_mode" VARCHAR(20),
ADD COLUMN     "initial_observations" JSONB,
ADD COLUMN     "is_emergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "known_allergies" TEXT,
ADD COLUMN     "reassessment_due_at" TIMESTAMP(3),
ADD COLUMN     "referral_source" VARCHAR(160),
ADD COLUMN     "temporary_label" VARCHAR(80);

-- AlterTable
ALTER TABLE "formulary_item" ADD COLUMN     "controlled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "staff_patient_access" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "scope" "StaffPatientAccessScope" NOT NULL DEFAULT 'CARE_TEAM',
    "justification" VARCHAR(500),
    "expiresAt" TIMESTAMP(3),
    "granted_by_id" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revoked_by_id" UUID,

    CONSTRAINT "staff_patient_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "break_glass_access" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "justification" VARCHAR(2000) NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedReason" VARCHAR(500),

    CONSTRAINT "break_glass_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(40),
    "department_id" UUID,
    "genderPolicy" VARCHAR(20),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "ward_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    "isolationReason" VARCHAR(200),
    "reserved_for_admission_id" UUID,
    "reserved_until" TIMESTAMP(3),
    "current_admission_id" UUID,
    "cleaned_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_suppliers" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_purchase_orders" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "supplier_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reference" VARCHAR(60),
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_purchase_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "medication_name" VARCHAR(160) NOT NULL,
    "strength" VARCHAR(60),
    "form" VARCHAR(60),
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "received_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_stock_batches" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "medication_name" VARCHAR(160) NOT NULL,
    "strength" VARCHAR(60),
    "form" VARCHAR(60),
    "batch_number" VARCHAR(80) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "supplier_id" UUID,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controlled_substance_events" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "medication_name" VARCHAR(160) NOT NULL,
    "eventType" "ControlledRegisterEventType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(30),
    "patient_id" UUID,
    "staff_id" UUID NOT NULL,
    "reference" VARCHAR(160),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "controlled_substance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_equipment" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" VARCHAR(80),
    "model" VARCHAR(120),
    "serial_number" TEXT,
    "location" VARCHAR(120),
    "status" "LabEquipmentStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "last_serviced_at" TIMESTAMP(3),
    "next_service_due_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_equipment_maintenance" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "downtime_hours" DECIMAL(6,1),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_equipment_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_reagents" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" VARCHAR(120),
    "lot_number" VARCHAR(80),
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "min_stock_level" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "storage_condition" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_reagents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_quality_control_runs" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "equipment_id" UUID,
    "test_name" VARCHAR(160),
    "control_name" TEXT NOT NULL,
    "expected" TEXT,
    "observed" TEXT NOT NULL,
    "result" "QualityControlResult" NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_quality_control_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursing_assessments" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "admission_id" UUID,
    "type" "NursingAssessmentType" NOT NULL,
    "data" JSONB NOT NULL,
    "score" INTEGER,
    "notes" TEXT,
    "assessed_by_id" UUID NOT NULL,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nursing_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursing_care_plans" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "admission_id" UUID,
    "goals" TEXT NOT NULL,
    "interventions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nursing_care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "facility_id" UUID,
    "patient_id" UUID,
    "feature" VARCHAR(60) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" TEXT,
    "status" VARCHAR(20) NOT NULL,
    "inputRefs" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_patient_access_facility_id_staff_id_idx" ON "staff_patient_access"("facility_id", "staff_id");

-- CreateIndex
CREATE INDEX "staff_patient_access_patient_id_idx" ON "staff_patient_access"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_patient_access_staff_id_patient_id_key" ON "staff_patient_access"("staff_id", "patient_id");

-- CreateIndex
CREATE INDEX "break_glass_access_facility_id_staff_id_idx" ON "break_glass_access"("facility_id", "staff_id");

-- CreateIndex
CREATE INDEX "break_glass_access_patient_id_idx" ON "break_glass_access"("patient_id");

-- CreateIndex
CREATE INDEX "break_glass_access_expiresAt_idx" ON "break_glass_access"("expiresAt");

-- CreateIndex
CREATE INDEX "wards_facility_id_idx" ON "wards"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "wards_facility_id_name_key" ON "wards"("facility_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "beds_reserved_for_admission_id_key" ON "beds"("reserved_for_admission_id");

-- CreateIndex
CREATE UNIQUE INDEX "beds_current_admission_id_key" ON "beds"("current_admission_id");

-- CreateIndex
CREATE INDEX "beds_facility_id_status_idx" ON "beds"("facility_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "beds_ward_id_label_key" ON "beds"("ward_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_suppliers_facility_id_name_key" ON "pharmacy_suppliers"("facility_id", "name");

-- CreateIndex
CREATE INDEX "pharmacy_purchase_orders_facility_id_status_idx" ON "pharmacy_purchase_orders"("facility_id", "status");

-- CreateIndex
CREATE INDEX "pharmacy_purchase_order_items_order_id_idx" ON "pharmacy_purchase_order_items"("order_id");

-- CreateIndex
CREATE INDEX "pharmacy_stock_batches_facility_id_expires_at_idx" ON "pharmacy_stock_batches"("facility_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_stock_batches_facility_id_medication_name_batch_nu_key" ON "pharmacy_stock_batches"("facility_id", "medication_name", "batch_number");

-- CreateIndex
CREATE INDEX "controlled_substance_events_facility_id_medication_name_cre_idx" ON "controlled_substance_events"("facility_id", "medication_name", "created_at");

-- CreateIndex
CREATE INDEX "lab_equipment_facility_id_status_idx" ON "lab_equipment"("facility_id", "status");

-- CreateIndex
CREATE INDEX "lab_equipment_maintenance_equipment_id_performed_at_idx" ON "lab_equipment_maintenance"("equipment_id", "performed_at");

-- CreateIndex
CREATE INDEX "lab_reagents_facility_id_expires_at_idx" ON "lab_reagents"("facility_id", "expires_at");

-- CreateIndex
CREATE INDEX "lab_quality_control_runs_facility_id_performed_at_idx" ON "lab_quality_control_runs"("facility_id", "performed_at");

-- CreateIndex
CREATE INDEX "nursing_assessments_facility_id_patient_id_assessed_at_idx" ON "nursing_assessments"("facility_id", "patient_id", "assessed_at");

-- CreateIndex
CREATE INDEX "nursing_care_plans_facility_id_patient_id_status_idx" ON "nursing_care_plans"("facility_id", "patient_id", "status");

-- CreateIndex
CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_facility_id_created_at_idx" ON "ai_usage_logs"("facility_id", "created_at");

-- AddForeignKey
ALTER TABLE "staff_patient_access" ADD CONSTRAINT "staff_patient_access_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "facility_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_patient_access" ADD CONSTRAINT "staff_patient_access_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_patient_access" ADD CONSTRAINT "staff_patient_access_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_patient_access" ADD CONSTRAINT "staff_patient_access_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_access" ADD CONSTRAINT "break_glass_access_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "facility_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_access" ADD CONSTRAINT "break_glass_access_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_transfers" ADD CONSTRAINT "ward_transfers_from_bed_id_fkey" FOREIGN KEY ("from_bed_id") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ward_transfers" ADD CONSTRAINT "ward_transfers_to_bed_id_fkey" FOREIGN KEY ("to_bed_id") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_current_admission_id_fkey" FOREIGN KEY ("current_admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_reserved_for_admission_id_fkey" FOREIGN KEY ("reserved_for_admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_suppliers" ADD CONSTRAINT "pharmacy_suppliers_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_purchase_orders" ADD CONSTRAINT "pharmacy_purchase_orders_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_purchase_orders" ADD CONSTRAINT "pharmacy_purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "pharmacy_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_purchase_orders" ADD CONSTRAINT "pharmacy_purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_purchase_order_items" ADD CONSTRAINT "pharmacy_purchase_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pharmacy_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_stock_batches" ADD CONSTRAINT "pharmacy_stock_batches_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_stock_batches" ADD CONSTRAINT "pharmacy_stock_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "pharmacy_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_substance_events" ADD CONSTRAINT "controlled_substance_events_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_substance_events" ADD CONSTRAINT "controlled_substance_events_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_substance_events" ADD CONSTRAINT "controlled_substance_events_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_equipment" ADD CONSTRAINT "lab_equipment_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_equipment_maintenance" ADD CONSTRAINT "lab_equipment_maintenance_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "lab_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_equipment_maintenance" ADD CONSTRAINT "lab_equipment_maintenance_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_reagents" ADD CONSTRAINT "lab_reagents_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_quality_control_runs" ADD CONSTRAINT "lab_quality_control_runs_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_quality_control_runs" ADD CONSTRAINT "lab_quality_control_runs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "lab_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_quality_control_runs" ADD CONSTRAINT "lab_quality_control_runs_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_assessments" ADD CONSTRAINT "nursing_assessments_assessed_by_id_fkey" FOREIGN KEY ("assessed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_care_plans" ADD CONSTRAINT "nursing_care_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursing_care_plans" ADD CONSTRAINT "nursing_care_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

