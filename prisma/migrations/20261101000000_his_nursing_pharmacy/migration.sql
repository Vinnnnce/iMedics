-- Nursing observations, care tasks, handovers and medication orders.
-- Additive only: four new tables, no changes to existing clinical tables.
CREATE TABLE "nursing_observation" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "admission_id" UUID,
    "observation_type" VARCHAR(40) NOT NULL,
    "value" VARCHAR(60) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "notes" VARCHAR(500),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursing_observation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nursing_observation_facility_id_patient_id_recorded_at_idx" ON "nursing_observation"("facility_id", "patient_id", "recorded_at" DESC);
CREATE INDEX "nursing_observation_patient_id_observation_type_idx" ON "nursing_observation"("patient_id", "observation_type");

CREATE TABLE "nursing_task" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "admission_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "instructions" VARCHAR(1000),
    "due_at" TIMESTAMP(3),
    "status" VARCHAR(16) NOT NULL DEFAULT 'DUE',
    "assigned_to_id" UUID,
    "created_by_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nursing_task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nursing_task_facility_id_status_idx" ON "nursing_task"("facility_id", "status");
CREATE INDEX "nursing_task_facility_id_patient_id_status_idx" ON "nursing_task"("facility_id", "patient_id", "status");
CREATE INDEX "nursing_task_assigned_to_id_status_idx" ON "nursing_task"("assigned_to_id", "status");

CREATE TABLE "nursing_handover" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID,
    "summary" VARCHAR(2000) NOT NULL,
    "open_task_ids" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursing_handover_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nursing_handover_facility_id_patient_id_created_at_idx" ON "nursing_handover"("facility_id", "patient_id", "created_at" DESC);

CREATE TABLE "medication_order" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "medication_name" VARCHAR(160) NOT NULL,
    "strength" VARCHAR(60),
    "dose" VARCHAR(100),
    "route" VARCHAR(40),
    "frequency" VARCHAR(60),
    "duration" VARCHAR(60),
    "notes" VARCHAR(500),
    "prescriber_id" UUID NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    "reviewed_by_id" UUID,
    "dispensed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_order_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medication_order_facility_id_status_idx" ON "medication_order"("facility_id", "status");
CREATE INDEX "medication_order_facility_id_patient_id_created_at_idx" ON "medication_order"("facility_id", "patient_id", "created_at" DESC);
