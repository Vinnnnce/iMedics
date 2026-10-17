-- Admin console: verification review records, applicant documents with metadata, account status reasons.

-- CreateEnum
CREATE TYPE "VerificationDecision" AS ENUM ('APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status_changed_at" TIMESTAMP(3),
ADD COLUMN     "status_reason" TEXT;

-- AlterTable
ALTER TABLE "doctor_profiles" DROP COLUMN "document_keys",
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "middle_name" TEXT;

-- AlterTable
ALTER TABLE "lab_staff_profiles" DROP COLUMN "document_keys";

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" "VerificationDecision" NOT NULL,
    "reason" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_documents_key_key" ON "verification_documents"("key");

-- CreateIndex
CREATE INDEX "verification_documents_user_id_idx" ON "verification_documents"("user_id");

-- CreateIndex
CREATE INDEX "verification_reviews_user_id_created_at_idx" ON "verification_reviews"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
