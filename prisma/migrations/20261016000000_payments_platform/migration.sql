-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('DOCTOR', 'HOSPITAL', 'LABORATORY', 'DIAGNOSTIC_CENTRE');

-- CreateEnum
CREATE TYPE "SubaccountStatus" AS ENUM ('PENDING', 'CREATED', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "CommissionKind" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('MISSING_WEBHOOK', 'AMOUNT_MISMATCH', 'DUPLICATE_PAYMENT', 'FAILED_SETTLEMENT', 'ORPHANED_GATEWAY_RECORD');

-- CreateEnum
CREATE TYPE "DiscrepancySeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION';

-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'SUBSCRIPTION';

-- AlterTable
ALTER TABLE "facility_services" ADD COLUMN     "branch" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "charged_reference" TEXT,
ADD COLUMN     "commission_amount" DECIMAL(12,2),
ADD COLUMN     "provider_amount" DECIMAL(12,2),
ADD COLUMN     "subaccount_code" TEXT;

-- AlterTable
ALTER TABLE "payment_events" ADD COLUMN     "dedupe_key" TEXT;

-- CreateTable
CREATE TABLE "provider_subaccounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "ProviderType" NOT NULL,
    "doctor_id" UUID,
    "facility_id" UUID,
    "business_name" TEXT NOT NULL,
    "settlement_bank" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "percentage_charge" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "subaccount_code" TEXT,
    "status" "SubaccountStatus" NOT NULL DEFAULT 'PENDING',
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_subaccounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" UUID NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "facility_id" UUID,
    "kind" "CommissionKind" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "currency" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_records" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "auto_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "monthly_price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "consultationAllowance" INTEGER,
    "features" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_subscriptions" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "consultations_used" INTEGER NOT NULL DEFAULT 0,
    "payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_runs" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "local_count" INTEGER NOT NULL DEFAULT 0,
    "local_amount_minor" BIGINT NOT NULL DEFAULT 0,
    "gateway_count" INTEGER NOT NULL DEFAULT 0,
    "gateway_amount_minor" BIGINT NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_discrepancies" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "type" "DiscrepancyType" NOT NULL,
    "severity" "DiscrepancySeverity" NOT NULL DEFAULT 'WARNING',
    "payment_id" UUID,
    "provider_reference" TEXT,
    "expected" JSONB NOT NULL DEFAULT '{}',
    "actual" JSONB NOT NULL DEFAULT '{}',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_subaccounts_user_id_key" ON "provider_subaccounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_subaccounts_doctor_id_key" ON "provider_subaccounts"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_subaccounts_facility_id_key" ON "provider_subaccounts"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_subaccounts_subaccount_code_key" ON "provider_subaccounts"("subaccount_code");

-- CreateIndex
CREATE INDEX "provider_subaccounts_status_idx" ON "provider_subaccounts"("status");

-- CreateIndex
CREATE INDEX "commission_rules_providerType_active_idx" ON "commission_rules"("providerType", "active");

-- CreateIndex
CREATE INDEX "commission_rules_facility_id_idx" ON "commission_rules"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_records_payment_id_key" ON "refund_records"("payment_id");

-- CreateIndex
CREATE INDEX "refund_records_status_created_at_idx" ON "refund_records"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_subscriptions_doctor_id_key" ON "doctor_subscriptions"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_subscriptions_payment_id_key" ON "doctor_subscriptions"("payment_id");

-- CreateIndex
CREATE INDEX "doctor_subscriptions_status_idx" ON "doctor_subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_events_payment_id_key" ON "subscription_events"("payment_id");

-- CreateIndex
CREATE INDEX "subscription_events_subscription_id_created_at_idx" ON "subscription_events"("subscription_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_runs_date_provider_key" ON "reconciliation_runs"("date", "provider");

-- CreateIndex
CREATE INDEX "reconciliation_discrepancies_run_id_idx" ON "reconciliation_discrepancies"("run_id");

-- CreateIndex
CREATE INDEX "reconciliation_discrepancies_type_resolved_at_idx" ON "reconciliation_discrepancies"("type", "resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_dedupe_key_key" ON "payment_events"("dedupe_key");

-- AddForeignKey
ALTER TABLE "provider_subaccounts" ADD CONSTRAINT "provider_subaccounts_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_subaccounts" ADD CONSTRAINT "provider_subaccounts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_subaccounts" ADD CONSTRAINT "provider_subaccounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_subscriptions" ADD CONSTRAINT "doctor_subscriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_subscriptions" ADD CONSTRAINT "doctor_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_subscriptions" ADD CONSTRAINT "doctor_subscriptions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "doctor_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_discrepancies" ADD CONSTRAINT "reconciliation_discrepancies_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

