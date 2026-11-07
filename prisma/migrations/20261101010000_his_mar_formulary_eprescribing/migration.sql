-- MAR administration entries, facility formulary, interaction rules and the
-- outbound e-prescribing outbox. Additive only: four new tables.
CREATE TABLE "medication_administration" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "encounter_id" UUID,
    "status" VARCHAR(16) NOT NULL,
    "administered_dose" VARCHAR(100),
    "route" VARCHAR(40),
    "notes" VARCHAR(500),
    "administered_by_id" UUID NOT NULL,
    "administered_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_administration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medication_administration_facility_id_patient_id_administered_at_idx" ON "medication_administration"("facility_id", "patient_id", "administered_at" DESC);
CREATE INDEX "medication_administration_order_id_administered_at_idx" ON "medication_administration"("order_id", "administered_at");

CREATE TABLE "formulary_item" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "medication_name" VARCHAR(160) NOT NULL,
    "strength" VARCHAR(60),
    "form" VARCHAR(60),
    "default_route" VARCHAR(40),
    "high_alert" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formulary_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "formulary_item_facility_id_medication_name_strength_key" ON "formulary_item"("facility_id", "medication_name", "strength");
CREATE INDEX "formulary_item_facility_id_active_idx" ON "formulary_item"("facility_id", "active");

CREATE TABLE "medication_interaction_rule" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "medication_a" VARCHAR(160) NOT NULL,
    "medication_b" VARCHAR(160) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_interaction_rule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medication_interaction_rule_facility_id_medication_a_idx" ON "medication_interaction_rule"("facility_id", "medication_a");
CREATE INDEX "medication_interaction_rule_facility_id_medication_b_idx" ON "medication_interaction_rule"("facility_id", "medication_b");

CREATE TABLE "e_prescription_outbox" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "sent_at" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "e_prescription_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "e_prescription_outbox_facility_id_status_idx" ON "e_prescription_outbox"("facility_id", "status");
