-- Support tickets (contact form, problem reports) and database-backed rate limiting. Additive only.
CREATE TYPE "SupportTicketType" AS ENUM ('CONTACT', 'TECHNICAL', 'ACCOUNT', 'DATA_CORRECTION', 'SECURITY', 'CLINICAL_SAFETY', 'FEEDBACK', 'FACILITY_ONBOARDING');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "support_tickets" (
  "id" UUID NOT NULL,
  "reference" VARCHAR(20) NOT NULL,
  "type" "SupportTicketType" NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "subject" VARCHAR(160) NOT NULL,
  "message" VARCHAR(5000) NOT NULL,
  "reporter_user_id" UUID,
  "contact_name" VARCHAR(120),
  "contact_email" VARCHAR(254) NOT NULL,
  "page_path" VARCHAR(300),
  "assigned_to_id" UUID,
  "security_incident_id" UUID,
  "sla_due_at" TIMESTAMP(3) NOT NULL,
  "first_response_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "support_tickets_reference_key" ON "support_tickets"("reference");
CREATE INDEX "support_tickets_status_priority_created_at_idx" ON "support_tickets"("status", "priority", "created_at" DESC);
CREATE INDEX "support_tickets_reporter_user_id_created_at_idx" ON "support_tickets"("reporter_user_id", "created_at" DESC);
CREATE INDEX "support_tickets_assigned_to_id_status_idx" ON "support_tickets"("assigned_to_id", "status");
CREATE INDEX "support_tickets_sla_due_at_idx" ON "support_tickets"("sla_due_at");

CREATE TABLE "support_ticket_events" (
  "id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "kind" VARCHAR(30) NOT NULL,
  "from_value" VARCHAR(60),
  "to_value" VARCHAR(60),
  "body" VARCHAR(2000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_ticket_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_ticket_events_ticket_id_created_at_idx" ON "support_ticket_events"("ticket_id", "created_at");
ALTER TABLE "support_ticket_events" ADD CONSTRAINT "support_ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "rate_limit_buckets" (
  "key" VARCHAR(200) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets"("expires_at");
