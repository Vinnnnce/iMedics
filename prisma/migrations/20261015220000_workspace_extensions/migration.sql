-- Additive only. No existing tables, columns, roles or clinical records are changed.
-- These extension tables are deliberately accessed with parameterized SQL so that
-- the existing schema.prisma and generated model contracts remain untouched.
CREATE TABLE workspace_tasks (
  id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(160) NOT NULL, kind VARCHAR(40) NOT NULL DEFAULT 'CARE',
  due_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workspace_tasks_owner ON workspace_tasks(owner_id, completed_at, due_at);
CREATE TABLE workspace_documents (
  id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id),
  storage_key TEXT NOT NULL UNIQUE, file_name VARCHAR(200) NOT NULL,
  mime_type VARCHAR(100) NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 15728640),
  confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workspace_documents_owner ON workspace_documents(owner_id, created_at);
CREATE TABLE workspace_shares (
  id UUID PRIMARY KEY, document_id UUID NOT NULL REFERENCES workspace_documents(id),
  owner_id UUID NOT NULL REFERENCES users(id), recipient_id UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(owner_id <> recipient_id)
);
CREATE INDEX workspace_shares_recipient ON workspace_shares(recipient_id, document_id);
CREATE TABLE workspace_intakes (
  id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id),
  appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id),
  reason TEXT NOT NULL, medications TEXT NOT NULL, allergies TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE workspace_wearable_readings (
  id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id),
  metric VARCHAR(40) NOT NULL CHECK(metric IN ('steps','resting_heart_rate','sleep_hours')),
  value DOUBLE PRECISION NOT NULL CHECK(value >= 0 AND value <= 100000),
  recorded_at TIMESTAMPTZ NOT NULL, source VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, metric, recorded_at, source)
);
CREATE INDEX workspace_wearables_owner ON workspace_wearable_readings(owner_id, recorded_at);
CREATE TABLE workspace_experiment_events (
  id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id),
  experiment VARCHAR(60) NOT NULL, variant CHAR(1) NOT NULL CHECK(variant IN ('A','B')),
  event VARCHAR(40) NOT NULL CHECK(event IN ('exposure','engagement','conversion')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workspace_experiment_report ON workspace_experiment_events(experiment, variant, event);
CREATE TABLE workspace_subscriptions (
  id UUID PRIMARY KEY, owner_id UUID NOT NULL UNIQUE REFERENCES users(id),
  plan VARCHAR(80) NOT NULL, status VARCHAR(30) NOT NULL CHECK(status IN ('ACTIVE','PAUSED','CANCELLED')),
  renews_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE workspace_disputes (
  id UUID PRIMARY KEY, payment_id UUID NOT NULL REFERENCES payments(id),
  opened_by UUID NOT NULL REFERENCES users(id), reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','REVIEWING','RESOLVED')),
  resolution TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE workspace_resources (
  id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id),
  kind VARCHAR(20) NOT NULL CHECK(kind IN ('STAFF','ROOM')),
  name VARCHAR(100) NOT NULL, capacity INTEGER NOT NULL DEFAULT 1 CHECK(capacity BETWEEN 1 AND 100),
  active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE workspace_resource_bookings (
  id UUID PRIMARY KEY, resource_id UUID NOT NULL REFERENCES workspace_resources(id),
  booking_id UUID NOT NULL REFERENCES facility_bookings(id),
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, CHECK(ends_at > starts_at),
  UNIQUE(resource_id, booking_id)
);
CREATE TABLE workspace_followups (
  id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID NOT NULL REFERENCES users(id), consultation_id UUID NOT NULL REFERENCES consultations(id),
  due_at TIMESTAMPTZ NOT NULL, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(consultation_id, due_at)
);
CREATE TABLE workspace_delivery (
  id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id),
  event_key TEXT NOT NULL UNIQUE, title VARCHAR(100) NOT NULL, href TEXT NOT NULL,
  email_done BOOLEAN NOT NULL DEFAULT false, push_done BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0, lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workspace_delivery_pending ON workspace_delivery(attempts, lease_until);
