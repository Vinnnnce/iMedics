-- Advanced patient admission/registration workspace.
-- All changes are additive: existing columns, rows and code paths are untouched.

-- Additional patient demographics captured during registration (all optional
-- except where the application validates). Contact + guardian + identity fields.
ALTER TABLE "patients" ADD COLUMN     "phone" VARCHAR(40),
ADD COLUMN     "alt_phone" VARCHAR(40),
ADD COLUMN     "email" VARCHAR(160),
ADD COLUMN     "preferred_contact_method" VARCHAR(20),
ADD COLUMN     "marital_status" VARCHAR(30),
ADD COLUMN     "nationality" VARCHAR(80),
ADD COLUMN     "preferred_language" VARCHAR(60),
ADD COLUMN     "identity_number" VARCHAR(60),
ADD COLUMN     "identity_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insurance_number" VARCHAR(80),
ADD COLUMN     "guardian_name" VARCHAR(160),
ADD COLUMN     "guardian_relationship" VARCHAR(80),
ADD COLUMN     "guardian_phone" VARCHAR(40),
ADD COLUMN     "guardian_authority" VARCHAR(200);

-- Indexes supporting the patient search / duplicate-detection workflow.
CREATE INDEX "patients_phone_idx" ON "patients"("phone");
CREATE INDEX "patients_email_idx" ON "patients"("email");
CREATE INDEX "patients_identity_number_idx" ON "patients"("identity_number");

-- Consent acknowledgements captured at registration, stored on the encounter:
-- [{key,title,version,status,signedByRole,capturedByName,capturedAt,withdrawnAt}]
ALTER TABLE "encounters" ADD COLUMN     "consents" JSONB;

-- Incomplete registration drafts: the full workspace payload as JSON so the
-- form can evolve without schema churn. Completed drafts are kept for audit.
CREATE TYPE "RegistrationDraftStatus" AS ENUM ('DRAFT', 'COMPLETED', 'DISCARDED');

CREATE TABLE "registration_drafts" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "status" "RegistrationDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "label" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL,
    "patient_id" UUID,
    "encounter_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registration_drafts_facility_id_status_idx" ON "registration_drafts"("facility_id", "status");
CREATE INDEX "registration_drafts_created_by_id_idx" ON "registration_drafts"("created_by_id");

ALTER TABLE "registration_drafts" ADD CONSTRAINT "registration_drafts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_drafts" ADD CONSTRAINT "registration_drafts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_drafts" ADD CONSTRAINT "registration_drafts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registration_drafts" ADD CONSTRAINT "registration_drafts_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
