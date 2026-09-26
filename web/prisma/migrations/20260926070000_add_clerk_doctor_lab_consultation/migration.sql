-- Add Clerk ID and onboarding fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_id" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_complete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- Create Doctor Profiles table
CREATE TABLE IF NOT EXISTS "doctor_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "gender" TEXT,
    "license_number" TEXT,
    "years_of_experience" INTEGER,
    "specialty" TEXT,
    "affiliation" TEXT,
    "biography" TEXT,
    "areas_of_expertise" JSONB NOT NULL DEFAULT '[]',
    "ai_tools_enabled" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "document_urls" JSONB NOT NULL DEFAULT '[]',
    "consultation_schedule" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "doctor_profiles_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "doctor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create Lab Staff Profiles table
CREATE TABLE IF NOT EXISTS "lab_staff_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "laboratory_name" TEXT,
    "position" TEXT,
    "license_id_number" TEXT,
    "document_urls" JSONB NOT NULL DEFAULT '[]',
    "departments" JSONB NOT NULL DEFAULT '[]',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_staff_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lab_staff_profiles_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "lab_staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create Consultations table
CREATE TABLE IF NOT EXISTS "consultations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "appointment_id" UUID,
    "notes" TEXT,
    "diagnosis" TEXT,
    "treatment_plan" TEXT,
    "ai_summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consultations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "consultations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "consultations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "consultations_patient_id_idx" ON "consultations"("patient_id");
CREATE INDEX IF NOT EXISTS "consultations_doctor_id_idx" ON "consultations"("doctor_id");
