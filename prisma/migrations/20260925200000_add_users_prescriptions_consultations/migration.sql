-- Medic1905 Schema Update — Add User, Prescription, ChatMessage, Consultation, CaseFile, AuditLog
-- Applied to Neon database on 2026-09-25

-- ============ USERS TABLE ============
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'PATIENT',
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "date_of_birth" DATE,
  "sex" TEXT,
  "language" TEXT NOT NULL DEFAULT 'en',
  "avatar_url" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");

-- ============ ALTER DOCTORS TABLE ============
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "like_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- ============ ALTER PATIENTS TABLE ============
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "admitted_at" TIMESTAMP(3);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "discharged_at" TIMESTAMP(3);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "assigned_doctor_id" TEXT;
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "patients" ADD CONSTRAINT "patients_assigned_doctor_id_fkey" FOREIGN KEY ("assigned_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL;

-- ============ ALTER PATIENT_APPOINTMENTS TABLE ============
ALTER TABLE "patient_appointments" ADD COLUMN IF NOT EXISTS "video_room_id" TEXT;
ALTER TABLE "patient_appointments" ADD COLUMN IF NOT EXISTS "video_token" TEXT;
ALTER TABLE "patient_appointments" ADD COLUMN IF NOT EXISTS "is_follow_up" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "patient_appointments" ADD COLUMN IF NOT EXISTS "parent_appointment_id" TEXT;

-- ============ ALTER DOCTOR_REVIEWS TABLE ============
ALTER TABLE "doctor_reviews" ADD COLUMN IF NOT EXISTS "patient_id" TEXT;
ALTER TABLE "doctor_reviews" ADD COLUMN IF NOT EXISTS "liked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- ============ PRESCRIPTIONS TABLE ============
CREATE TABLE IF NOT EXISTS "prescriptions" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "doctor_id" TEXT NOT NULL,
  "appointment_id" TEXT,
  "medications" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prescriptions_patient_id_idx" ON "prescriptions"("patient_id");
CREATE INDEX IF NOT EXISTS "prescriptions_doctor_id_idx" ON "prescriptions"("doctor_id");
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "patient_appointments"("id") ON DELETE SET NULL;

-- ============ CHAT_MESSAGES TABLE ============
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" TEXT NOT NULL,
  "appointment_id" TEXT,
  "sender_id" TEXT NOT NULL,
  "receiver_id" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "message_type" TEXT NOT NULL DEFAULT 'TEXT',
  "attachment_url" TEXT,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_messages_sender_id_idx" ON "chat_messages"("sender_id");
CREATE INDEX IF NOT EXISTS "chat_messages_receiver_id_idx" ON "chat_messages"("receiver_id");
CREATE INDEX IF NOT EXISTS "chat_messages_appointment_id_idx" ON "chat_messages"("appointment_id");
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "patient_appointments"("id") ON DELETE SET NULL;

-- ============ CONSULTATIONS TABLE ============
CREATE TABLE IF NOT EXISTS "consultations" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "doctor_id" TEXT NOT NULL,
  "appointment_id" TEXT,
  "case_id" TEXT,
  "chief_complaint" TEXT,
  "history_present_illness" TEXT,
  "examination" TEXT,
  "diagnosis" TEXT,
  "differential_diagnosis" TEXT,
  "treatment_plan" TEXT,
  "follow_up_plan" TEXT,
  "notes" TEXT,
  "ai_draft" TEXT,
  "ai_risk_factors" JSONB,
  "ai_follow_up_questions" JSONB,
  "ai_used" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "consultations_patient_id_idx" ON "consultations"("patient_id");
CREATE INDEX IF NOT EXISTS "consultations_doctor_id_idx" ON "consultations"("doctor_id");
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "patient_appointments"("id") ON DELETE SET NULL;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "diagnostics_cases"("id") ON DELETE SET NULL;

-- ============ CASE_FILES TABLE ============
CREATE TABLE IF NOT EXISTS "case_files" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "case_number" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'open',
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "summary" TEXT,
  "consultation_ids" TEXT[] DEFAULT '{}',
  "lab_result_ids" TEXT[] DEFAULT '{}',
  "imaging_ids" TEXT[] DEFAULT '{}',
  "prescription_ids" TEXT[] DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opened_by_id" TEXT,
  CONSTRAINT "case_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "case_files_patient_id_idx" ON "case_files"("patient_id");
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- ============ AUDIT_LOGS TABLE ============
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "action" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}',
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
