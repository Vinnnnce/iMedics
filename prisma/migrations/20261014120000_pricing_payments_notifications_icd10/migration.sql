-- ICD-10 coding, consultation/facility pricing, payments and notifications.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT';

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "ConsultationFeeKind" AS ENUM ('STANDARD', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('LAB_TEST', 'IMAGING', 'PROCEDURE', 'CONSULTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "FacilityBookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('CONSULTATION', 'FACILITY_SERVICE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'USSD', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "doctor_profiles" ALTER COLUMN "consultation_fee" SET DATA TYPE DECIMAL(12,2),
ADD COLUMN     "follow_up_fee" DECIMAL(12,2),
ADD COLUMN     "follow_up_window_days" INTEGER NOT NULL DEFAULT 14;

-- AlterTable
ALTER TABLE "lab_staff_profiles" ADD COLUMN     "about" TEXT,
ADD COLUMN     "address_line" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "operating_hours" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "fee_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "fee_currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "fee_kind" "ConsultationFeeKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "reminder_1h_sent_at" TIMESTAMP(3),
ADD COLUMN     "reminder_24h_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "consultations" DROP COLUMN "icd_code";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "href" TEXT;

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_system_releases" (
    "id" UUID NOT NULL,
    "system" TEXT NOT NULL,
    "edition" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source_url" TEXT,
    "code_count" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_system_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "icd10_codes" (
    "id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "code_normalized" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chapter" TEXT,
    "chapter_title" TEXT,
    "block" TEXT,
    "parent_code" TEXT,
    "is_selectable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "icd10_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_diagnoses" (
    "id" UUID NOT NULL,
    "consultation_id" UUID NOT NULL,
    "release_id" UUID,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "consultation_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_services" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ServiceCategory" NOT NULL DEFAULT 'LAB_TEST',
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "turnaround_hours" INTEGER,
    "availability" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_bookings" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "preferred_at" TIMESTAMP(3) NOT NULL,
    "status" "FacilityBookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "payer_id" UUID NOT NULL,
    "payee_id" UUID NOT NULL,
    "appointment_id" UUID,
    "facility_booking_id" UUID,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PaymentMethod",
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "provider_reference" TEXT NOT NULL,
    "receipt_number" TEXT,
    "failure_reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_category_channel_key" ON "notification_preferences"("user_id", "category", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "code_system_releases_system_is_active_idx" ON "code_system_releases"("system", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "code_system_releases_system_edition_jurisdiction_key" ON "code_system_releases"("system", "edition", "jurisdiction");

-- CreateIndex
CREATE INDEX "icd10_codes_release_id_is_selectable_code_normalized_idx" ON "icd10_codes"("release_id", "is_selectable", "code_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "icd10_codes_release_id_code_key" ON "icd10_codes"("release_id", "code");

-- CreateIndex
CREATE INDEX "consultation_diagnoses_code_idx" ON "consultation_diagnoses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_diagnoses_consultation_id_code_key" ON "consultation_diagnoses"("consultation_id", "code");

-- CreateIndex
CREATE INDEX "facility_services_facility_id_is_active_idx" ON "facility_services"("facility_id", "is_active");

-- CreateIndex
CREATE INDEX "facility_bookings_patient_id_created_at_idx" ON "facility_bookings"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "facility_bookings_service_id_status_idx" ON "facility_bookings"("service_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_appointment_id_key" ON "payments"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_facility_booking_id_key" ON "payments"("facility_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_reference_key" ON "payments"("provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_number_key" ON "payments"("receipt_number");

-- CreateIndex
CREATE INDEX "payments_payer_id_created_at_idx" ON "payments"("payer_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_payee_id_created_at_idx" ON "payments"("payee_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_status_expires_at_idx" ON "payments"("status", "expires_at");

-- CreateIndex
CREATE INDEX "payment_events_payment_id_created_at_idx" ON "payment_events"("payment_id", "created_at");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icd10_codes" ADD CONSTRAINT "icd10_codes_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "code_system_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_diagnoses" ADD CONSTRAINT "consultation_diagnoses_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_diagnoses" ADD CONSTRAINT "consultation_diagnoses_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "code_system_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_services" ADD CONSTRAINT "facility_services_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "facility_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_facility_booking_id_fkey" FOREIGN KEY ("facility_booking_id") REFERENCES "facility_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
