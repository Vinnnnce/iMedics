-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "gender" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "occupation" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT DEFAULT 'RU',
    "ec_name" TEXT,
    "ec_relationship" TEXT,
    "ec_phone" TEXT,
    "ec_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "chief_complaint" TEXT,
    "symptoms" JSONB NOT NULL DEFAULT '[]',
    "medications" JSONB NOT NULL DEFAULT '[]',
    "has_wound" BOOLEAN NOT NULL DEFAULT false,
    "wound_location" TEXT,
    "wound_type" TEXT,
    "wound_time_since_injury" TEXT,
    "wound_cause" TEXT,
    "has_diabetes" BOOLEAN NOT NULL DEFAULT false,
    "diabetes_duration" TEXT,
    "diabetes_type" TEXT,
    "diabetes_control" TEXT,
    "has_stroke" BOOLEAN NOT NULL DEFAULT false,
    "stroke_date" TEXT,
    "stroke_residual" TEXT,
    "has_heart_attack" BOOLEAN NOT NULL DEFAULT false,
    "heart_attack_date" TEXT,
    "heart_attack_interventions" TEXT,
    "family_history" JSONB NOT NULL DEFAULT '[]',
    "past_history" JSONB NOT NULL DEFAULT '[]',
    "allergies" JSONB NOT NULL DEFAULT '[]',
    "smoking_status" TEXT,
    "smoking_quantity" TEXT,
    "alcohol_use" TEXT,
    "physical_activity" TEXT,
    "sleep_pattern" TEXT,
    "pregnancies" INTEGER,
    "deliveries" INTEGER,
    "reproductive_complications" TEXT,
    "mental_health" JSONB NOT NULL DEFAULT '[]',
    "immunizations" JSONB NOT NULL DEFAULT '[]',
    "ai_analysis" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_case_number_key" ON "patients"("case_number");

-- CreateIndex
CREATE INDEX "patients_last_name_idx" ON "patients"("last_name");

-- CreateIndex
CREATE INDEX "patients_case_number_idx" ON "patients"("case_number");

-- CreateIndex
CREATE INDEX "medical_histories_patient_id_idx" ON "medical_histories"("patient_id");

-- AddForeignKey
ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
