-- CreateEnum
CREATE TYPE "FacilityDocumentTemplateKind" AS ENUM ('LAB_REPORT', 'REFERRAL_FORM', 'CASE_NOTE', 'IMAGING_REPORT');

-- AlterTable
ALTER TABLE "lab_staff_profiles" ADD COLUMN     "rating_avg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "patient_documents" ADD COLUMN     "issuing_facility_id" UUID;

-- CreateTable
CREATE TABLE "facility_document_templates" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FacilityDocumentTemplateKind" NOT NULL,
    "content" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_reviews" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "moderation_status" "ReviewModeration" NOT NULL DEFAULT 'APPROVED',
    "moderatedAt" TIMESTAMP(3),
    "facility_response" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facility_document_templates_facility_id_kind_idx" ON "facility_document_templates"("facility_id", "kind");

-- CreateIndex
CREATE INDEX "facility_reviews_facility_id_idx" ON "facility_reviews"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_reviews_patient_id_facility_id_key" ON "facility_reviews"("patient_id", "facility_id");

-- AddForeignKey
ALTER TABLE "facility_document_templates" ADD CONSTRAINT "facility_document_templates_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_document_templates" ADD CONSTRAINT "facility_document_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_reviews" ADD CONSTRAINT "facility_reviews_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_reviews" ADD CONSTRAINT "facility_reviews_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_issuing_facility_id_fkey" FOREIGN KEY ("issuing_facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

