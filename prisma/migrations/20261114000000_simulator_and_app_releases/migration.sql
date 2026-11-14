-- Medic1905 Virtual Hospital simulator tables (synthetic educational data only)
-- + App release management for the download centre.

CREATE TABLE "sim_users" (
    "id" SERIAL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "city_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "sim_sessions" (
    "token" TEXT PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "sim_users"("id") ON DELETE CASCADE,
    "expires_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "sim_regions" (
    "id" SERIAL PRIMARY KEY,
    "code" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "population" INTEGER NOT NULL,
    "description" TEXT
);

CREATE TABLE "sim_cities" (
    "id" SERIAL PRIMARY KEY,
    "region_id" INTEGER NOT NULL REFERENCES "sim_regions"("id"),
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "population" INTEGER NOT NULL
);

CREATE TABLE "sim_hospitals" (
    "id" SERIAL PRIMARY KEY,
    "city_id" INTEGER NOT NULL REFERENCES "sim_cities"("id"),
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "beds" INTEGER NOT NULL,
    "has_ed" BOOLEAN NOT NULL DEFAULT false,
    "has_icu" BOOLEAN NOT NULL DEFAULT false,
    "has_theatre" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE "sim_departments" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL
);

CREATE TABLE "sim_hospital_departments" (
    "hospital_id" INTEGER NOT NULL REFERENCES "sim_hospitals"("id") ON DELETE CASCADE,
    "department_id" INTEGER NOT NULL REFERENCES "sim_departments"("id") ON DELETE CASCADE,
    PRIMARY KEY ("hospital_id", "department_id")
);

CREATE TABLE "sim_drugs" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "generic" TEXT NOT NULL,
    "drug_class" TEXT NOT NULL,
    "forms" TEXT NOT NULL,
    "adult_dose" TEXT NOT NULL,
    "max_dose" TEXT,
    "renal_note" TEXT,
    "hepatic_note" TEXT,
    "pregnancy_category" TEXT,
    "interactions" TEXT NOT NULL,
    "contraindications" TEXT NOT NULL,
    "allergy_tags" TEXT NOT NULL,
    "high_alert" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE "sim_lab_catalog" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT,
    "ref_range" TEXT NOT NULL,
    "turnaround_min" INTEGER NOT NULL DEFAULT 45,
    "container" TEXT
);

CREATE TABLE "sim_imaging_catalog" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "turnaround_min" INTEGER NOT NULL DEFAULT 30,
    "requires_justify" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "sim_cases" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "scenario_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "author_id" INTEGER,
    "scenario" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "sim_case_runs" (
    "id" SERIAL PRIMARY KEY,
    "case_id" INTEGER NOT NULL REFERENCES "sim_cases"("id"),
    "learner_id" INTEGER NOT NULL REFERENCES "sim_users"("id"),
    "status" TEXT NOT NULL DEFAULT 'active',
    "state" TEXT NOT NULL,
    "score" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3)
);

CREATE INDEX "sim_case_runs_learner_id_idx" ON "sim_case_runs"("learner_id");

CREATE TABLE "sim_run_participants" (
    "run_id" INTEGER NOT NULL REFERENCES "sim_case_runs"("id") ON DELETE CASCADE,
    "user_id" INTEGER NOT NULL REFERENCES "sim_users"("id"),
    "role_in_case" TEXT NOT NULL DEFAULT 'learner',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("run_id", "user_id")
);

CREATE TABLE "sim_run_events" (
    "id" SERIAL PRIMARY KEY,
    "run_id" INTEGER NOT NULL REFERENCES "sim_case_runs"("id") ON DELETE CASCADE,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" INTEGER,
    "actor_role" TEXT,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL
);

CREATE INDEX "sim_run_events_run_id_idx" ON "sim_run_events"("run_id");

CREATE TABLE "sim_chat_messages" (
    "id" SERIAL PRIMARY KEY,
    "run_id" INTEGER NOT NULL REFERENCES "sim_case_runs"("id") ON DELETE CASCADE,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "sim_chat_messages_run_id_idx" ON "sim_chat_messages"("run_id");

CREATE TABLE "sim_orders" (
    "id" SERIAL PRIMARY KEY,
    "run_id" INTEGER NOT NULL REFERENCES "sim_case_runs"("id") ON DELETE CASCADE,
    "kind" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "justification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resulted_at" TIMESTAMP(3),
    "result" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX "sim_orders_run_id_idx" ON "sim_orders"("run_id");

CREATE TABLE "sim_prescriptions" (
    "id" SERIAL PRIMARY KEY,
    "run_id" INTEGER NOT NULL REFERENCES "sim_case_runs"("id") ON DELETE CASCADE,
    "drug_key" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT,
    "checks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'prescribed',
    "prescribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "sim_prescriptions_run_id_idx" ON "sim_prescriptions"("run_id");

CREATE TABLE "sim_clinical_notes" (
    "id" SERIAL PRIMARY KEY,
    "run_id" INTEGER NOT NULL REFERENCES "sim_case_runs"("id") ON DELETE CASCADE,
    "author_id" INTEGER,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "sim_clinical_notes_run_id_idx" ON "sim_clinical_notes"("run_id");

CREATE TABLE "sim_nursing_observations" (
    "id" SERIAL PRIMARY KEY,
    "run_id" INTEGER NOT NULL REFERENCES "sim_case_runs"("id") ON DELETE CASCADE,
    "author_id" INTEGER,
    "hr" INTEGER,
    "sbp" INTEGER,
    "dbp" INTEGER,
    "rr" INTEGER,
    "temp" DOUBLE PRECISION,
    "spo2" INTEGER,
    "pain_score" INTEGER,
    "gcs" INTEGER,
    "consciousness" TEXT,
    "urine_output" TEXT,
    "fluid_balance" TEXT,
    "wound" TEXT,
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "sim_nursing_observations_run_id_idx" ON "sim_nursing_observations"("run_id");

CREATE TABLE "sim_audit_log" (
    "id" SERIAL PRIMARY KEY,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT
);

-- App distribution / download centre
CREATE TABLE "app_releases" (
    "id" TEXT PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'stable',
    "version" TEXT NOT NULL,
    "build_number" INTEGER NOT NULL DEFAULT 1,
    "file_url" TEXT,
    "file_name" TEXT,
    "file_size_bytes" INTEGER,
    "checksum_sha256" TEXT,
    "min_os_version" TEXT,
    "release_notes" TEXT NOT NULL DEFAULT '',
    "store_url" TEXT,
    "testflight_url" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "release_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "app_releases_platform_published_idx" ON "app_releases"("platform", "published");
