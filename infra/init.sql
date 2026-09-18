-- iMedics Database Initialization
-- Run on PostgreSQL startup (Docker entrypoint)

-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'PATIENT' CHECK (role IN ('PATIENT', 'DOCTOR', 'LAB_SCIENTIST', 'ADMIN')),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    date_of_birth DATE,
    sex VARCHAR(10),
    language VARCHAR(5) DEFAULT 'en',
    conditions JSONB DEFAULT '[]',
    medications JSONB DEFAULT '[]',
    insurance_info JSONB,
    kyc_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ── Appointments ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INT DEFAULT 30,
    status VARCHAR(20) DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    reason TEXT,
    notes TEXT,
    video_room_id VARCHAR(255),
    video_token VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ── Lab Orders ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id),
    ordered_by UUID NOT NULL REFERENCES users(id),
    panel_type VARCHAR(50) NOT NULL,
    tests JSONB DEFAULT '[]',
    notes TEXT,
    status VARCHAR(20) DEFAULT 'ORDERED' CHECK (status IN ('ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ── Lab Results ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id),
    panel_type VARCHAR(50) NOT NULL,
    test_date DATE NOT NULL,
    lab_name VARCHAR(255),
    values JSONB NOT NULL DEFAULT '[]',
    file_url TEXT,
    uploaded_by_id UUID REFERENCES users(id),
    verified_by_id UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PENDING_AI_ANALYSIS', 'AI_ANALYSIS_COMPLETE', 'VERIFIED', 'REJECTED')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lab_results_patient ON lab_results(patient_id);
CREATE INDEX idx_lab_results_date ON lab_results(test_date DESC);

-- ── AI Analyses ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_result_id UUID NOT NULL REFERENCES lab_results(id),
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'COMPLETED_WITH_OVERRIDE', 'FAILED', 'BLOCKED')),
    doctor_view JSONB,
    patient_view JSONB,
    flags JSONB DEFAULT '{}',
    urgency_level VARCHAR(20) DEFAULT 'routine',
    confidence JSONB DEFAULT '{}',
    safety_report JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ── Audit Logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ── Prescriptions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    appointment_id UUID REFERENCES appointments(id),
    medications JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISCONTINUED', 'EXPIRED')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ── Chat Messages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id),
    sender_id UUID NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE', 'FILE', 'SYSTEM')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_appointment ON chat_messages(appointment_id);

-- ── Medical Knowledge Base (for RAG) ──────────────────
CREATE TABLE IF NOT EXISTS medical_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(255),
    category VARCHAR(100),
    embedding vector(384),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_medical_knowledge_category ON medical_knowledge(category);

-- ═══════════════════════════════════════════════════════════
-- PATIENT HISTORY MODULE — Patient ID + Medical History
-- ═══════════════════════════════════════════════════════════

-- ── Patient Profiles (Identification) ──────────────────
CREATE TABLE IF NOT EXISTS patient_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    case_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    gender VARCHAR(30), -- male, female, non-binary, prefer_not_to_say
    date_of_birth DATE,
    height_cm NUMERIC(5,1), -- CHECK (height_cm >= 30 AND height_cm <= 300)
    weight_kg NUMERIC(5,1), -- CHECK (weight_kg >= 1 AND weight_kg <= 500)
    bmi NUMERIC(4,1),       -- auto-calculated
    bmi_category VARCHAR(20), -- underweight, normal, overweight, obese
    occupation VARCHAR(255),
    street VARCHAR(500),
    city VARCHAR(255),
    state_region VARCHAR(255),
    country VARCHAR(255),
    postal_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_patient_profiles_name ON patient_profiles(last_name, first_name);
CREATE INDEX idx_patient_profiles_case ON patient_profiles(case_number);

-- ── Emergency Contacts ────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50),
    phone VARCHAR(50) NOT NULL,
    street VARCHAR(500),
    city VARCHAR(255),
    state_region VARCHAR(255),
    country VARCHAR(255),
    postal_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_emergency_contacts_patient ON emergency_contacts(patient_id);

-- ── Medical Histories (Episodes) ──────────────────────
CREATE TABLE IF NOT EXISTS medical_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id),
    appointment_id UUID REFERENCES appointments(id),
    case_number VARCHAR(50) NOT NULL,
    chief_complaint TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED')),
    ai_summary JSONB,
    ai_patient_recap JSONB,
    ai_suggested_questions JSONB,
    ai_risk_factors JSONB,
    ai_symptom_clusters JSONB,
    ai_timeline JSONB,
    clinician_notes TEXT,
    clinician_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    reviewed_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_medical_histories_patient ON medical_histories(patient_id);
CREATE INDEX idx_medical_histories_doctor ON medical_histories(doctor_id);
CREATE INDEX idx_medical_histories_status ON medical_histories(status);

-- ── Symptoms ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS symptoms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    onset VARCHAR(30), -- sudden, gradual, unknown, custom
    onset_custom_text VARCHAR(255),
    worsening_time VARCHAR(30), -- morning, afternoon, evening, night, constant
    relief_time VARCHAR(30), -- morning, afternoon, evening, night, none
    character VARCHAR(30), -- sharp, dull, throbbing, burning, pressure, intermittent, continuous, other
    character_custom_text VARCHAR(255),
    severity INTEGER CHECK (severity >= 0 AND severity <= 10),
    duration VARCHAR(255),
    additional_notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_symptoms_history ON symptoms(medical_history_id);

-- ── Medication Records ─────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dose VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    medication_type VARCHAR(20) DEFAULT 'CURRENT' CHECK (medication_type IN ('CURRENT', 'RECENT')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_medication_records_history ON medication_records(medical_history_id);

-- ── Wound / Injury ────────────────────────────────────
CREATE TABLE IF NOT EXISTS wound_injuries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    has_injury BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    injury_type VARCHAR(50), -- cut, burn, bruise, fracture, other
    injury_type_custom VARCHAR(255),
    time_since_injury VARCHAR(255),
    cause VARCHAR(100), -- fall, accident, work_related, other
    cause_custom VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wound_injuries_history ON wound_injuries(medical_history_id);

-- ── Chronic Conditions (Diabetes, Stroke, Heart Attack) ──
CREATE TABLE IF NOT EXISTS chronic_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    condition_type VARCHAR(50) NOT NULL, -- DIABETES, STROKE, HEART_ATTACK, OTHER
    condition_label VARCHAR(255),
    has_condition BOOLEAN DEFAULT FALSE,
    duration VARCHAR(100),
    condition_subtype VARCHAR(100), -- Type 1, Type 2, gestational for diabetes
    control_status VARCHAR(50), -- well_controlled, poorly_controlled, unknown
    event_date DATE,
    residual_symptoms TEXT,
    interventions TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chronic_conditions_history ON chronic_conditions(medical_history_id);
CREATE INDEX idx_chronic_conditions_type ON chronic_conditions(condition_type);

-- ── Family History ────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_history_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    condition VARCHAR(100) NOT NULL, -- diabetes, hypertension, stroke, heart_disease, cancer, mental_health, other
    condition_custom VARCHAR(255),
    relationship VARCHAR(50), -- mother, father, sibling, grandparent, other
    age_at_onset INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_family_history_history ON family_history_entries(medical_history_id);

-- ── Past Medical / Surgical History ────────────────────
CREATE TABLE IF NOT EXISTS past_history_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    entry_type VARCHAR(30) NOT NULL, -- DIAGNOSIS, SURGERY, HOSPITALIZATION
    diagnosis VARCHAR(500),
    surgery_type VARCHAR(255),
    event_date DATE,
    outcome VARCHAR(100), -- recovered, ongoing, complications, unknown
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_past_history_history ON past_history_entries(medical_history_id);
CREATE INDEX idx_past_history_type ON past_history_entries(entry_type);

-- ── Allergies ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS allergies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    allergen_type VARCHAR(30) NOT NULL, -- DRUG, FOOD, ENVIRONMENTAL
    allergen VARCHAR(255) NOT NULL,
    reaction_type VARCHAR(100), -- rash, anaphylaxis, gi_upset, other
    reaction_custom VARCHAR(255),
    severity VARCHAR(30), -- mild, moderate, severe, unknown
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_allergies_history ON allergies(medical_history_id);
CREATE INDEX idx_allergies_type ON allergies(allergen_type);

-- ── Lifestyle Factors ─────────────────────────────────
CREATE TABLE IF NOT EXISTS lifestyle_factors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    smoking_status VARCHAR(20), -- never, former, current
    smoking_quantity VARCHAR(255),
    years_smoking INTEGER,
    alcohol_use VARCHAR(20), -- none, occasional, regular
    alcohol_quantity VARCHAR(255),
    physical_activity VARCHAR(30), -- sedentary, moderate, active
    exercise_frequency VARCHAR(100),
    sleep_pattern VARCHAR(30), -- good, fair, poor, insomnia
    sleep_hours NUMERIC(3,1),
    travel_history TEXT,
    occupational_exposure TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lifestyle_factors_history ON lifestyle_factors(medical_history_id);

-- ── Reproductive / Obstetric History ───────────────────
CREATE TABLE IF NOT EXISTS reproductive_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    pregnancies INTEGER DEFAULT 0,
    deliveries INTEGER DEFAULT 0,
    miscarriages INTEGER DEFAULT 0,
    living_children INTEGER,
    complications TEXT,
    last_menstrual_period DATE,
    contraception_method VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reproductive_history ON reproductive_histories(medical_history_id);

-- ── Mental Health Records ─────────────────────────────
CREATE TABLE IF NOT EXISTS mental_health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    condition VARCHAR(100) NOT NULL, -- depression, anxiety, bipolar, schizophrenia, other
    condition_custom VARCHAR(255),
    duration VARCHAR(100),
    treatment_status VARCHAR(50), -- untreated, in_treatment, resolved
    current_treatment VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mental_health_history ON mental_health_records(medical_history_id);

-- ── Immunization Records ───────────────────────────────
CREATE TABLE IF NOT EXISTS immunization_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    vaccine_name VARCHAR(255) NOT NULL,
    date_administered DATE,
    status VARCHAR(30) DEFAULT 'UP_TO_DATE', -- UP_TO_DATE, OVERDUE, UNKNOWN, NOT_RECEIVED
    booster_due DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_immunization_history ON immunization_records(medical_history_id);

-- ── Extensible Custom Fields ──────────────────────────
CREATE TABLE IF NOT EXISTS extensible_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_history_id UUID NOT NULL REFERENCES medical_histories(id) ON DELETE CASCADE,
    field_name VARCHAR(255) NOT NULL,
    field_value JSONB NOT NULL,
    field_type VARCHAR(30) DEFAULT 'TEXT', -- TEXT, NUMBER, DATE, SELECT, JSON
    category VARCHAR(100), -- travel, occupational, pain, sleep, custom
    options JSONB,
    required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_extensible_fields_history ON extensible_fields(medical_history_id);
CREATE INDEX idx_extensible_fields_category ON extensible_fields(category);
