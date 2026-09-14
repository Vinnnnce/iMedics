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
