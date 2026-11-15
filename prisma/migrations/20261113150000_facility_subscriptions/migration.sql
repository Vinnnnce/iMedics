-- Facility subscriptions and the launch free trial. Additive only.
CREATE TYPE "PlanAudience" AS ENUM ('DOCTOR', 'FACILITY');
CREATE TYPE "FacilitySubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

ALTER TABLE "subscription_plans" ADD COLUMN "audience" "PlanAudience" NOT NULL DEFAULT 'DOCTOR';

CREATE TABLE "facility_subscriptions" (
  "id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "plan_id" UUID,
  "status" "FacilitySubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "trial_starts_at" TIMESTAMP(3) NOT NULL,
  "trial_ends_at" TIMESTAMP(3) NOT NULL,
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "payment_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "facility_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "facility_subscriptions_facility_id_key" ON "facility_subscriptions"("facility_id");
CREATE UNIQUE INDEX "facility_subscriptions_payment_id_key" ON "facility_subscriptions"("payment_id");
CREATE INDEX "facility_subscriptions_status_trial_ends_at_idx" ON "facility_subscriptions"("status", "trial_ends_at");
CREATE INDEX "facility_subscriptions_status_current_period_end_idx" ON "facility_subscriptions"("status", "current_period_end");
ALTER TABLE "facility_subscriptions" ADD CONSTRAINT "facility_subscriptions_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "facility_subscriptions" ADD CONSTRAINT "facility_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "facility_subscription_events" (
  "id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "type" VARCHAR(30) NOT NULL,
  "payment_id" UUID,
  "actor_user_id" UUID,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "facility_subscription_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "facility_subscription_events_payment_id_key" ON "facility_subscription_events"("payment_id");
CREATE INDEX "facility_subscription_events_subscription_id_created_at_idx" ON "facility_subscription_events"("subscription_id", "created_at");
ALTER TABLE "facility_subscription_events" ADD CONSTRAINT "facility_subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "facility_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
