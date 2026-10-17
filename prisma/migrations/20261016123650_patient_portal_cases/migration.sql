-- Additive changes only: unified care-episode cases (CareCase) and patient
-- profile header fields. The workspace_* tables are managed by raw SQL in
-- 20261015220000_workspace_extensions and are intentionally untouched here.

-- CreateEnum
CREATE TYPE "CareCaseType" AS ENUM ('CONSULTATION', 'LABORATORY', 'DIAGNOSTIC', 'REPORT', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "CareCaseStatus" AS ENUM ('OPEN', 'AWAITING_CONSULTATION', 'AWAITING_INVESTIGATION', 'AWAITING_RESULT', 'RESULT_AVAILABLE', 'UNDER_REVIEW', 'TREATMENT_ONGOING', 'FOLLOW_UP_REQUIRED', 'CLOSED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "case_id" UUID;

-- AlterTable
ALTER TABLE "facility_bookings" ADD COLUMN     "case_id" UUID;

-- AlterTable
ALTER TABLE "lab_orders" ADD COLUMN     "case_id" UUID;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "organ_donor_status" BOOLEAN,
ADD COLUMN     "preferred_name" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "case_id" UUID;

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "case_id" UUID;

-- CreateTable
CREATE TABLE "care_cases" (
    "id" UUID NOT NULL,
    "case_number" TEXT NOT NULL,
    "type" "CareCaseType" NOT NULL,
    "status" "CareCaseStatus" NOT NULL DEFAULT 'OPEN',
    "patient_id" UUID NOT NULL,
    "primary_doctor_id" UUID,
    "specialty" TEXT,
    "presenting_complaint" TEXT,
    "diagnosis_summary" TEXT,
    "follow_up_date" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_case_events" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "status" "CareCaseStatus" NOT NULL,
    "note" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_case_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_case_counters" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "care_case_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "care_cases_case_number_key" ON "care_cases"("case_number");

-- CreateIndex
CREATE INDEX "care_cases_patient_id_created_at_idx" ON "care_cases"("patient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "care_cases_status_idx" ON "care_cases"("status");

-- CreateIndex
CREATE INDEX "care_case_events_case_id_created_at_idx" ON "care_case_events"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "facility_bookings_case_id_idx" ON "facility_bookings"("case_id");

-- CreateIndex
CREATE INDEX "lab_orders_case_id_idx" ON "lab_orders"("case_id");

-- CreateIndex
CREATE INDEX "prescriptions_case_id_idx" ON "prescriptions"("case_id");

-- AddForeignKey
ALTER TABLE "care_cases" ADD CONSTRAINT "care_cases_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_cases" ADD CONSTRAINT "care_cases_primary_doctor_id_fkey" FOREIGN KEY ("primary_doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_case_events" ADD CONSTRAINT "care_case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
