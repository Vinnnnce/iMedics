-- Profile reports: users flag a doctor or facility profile for admin review. Additive only.
CREATE TYPE "ProfileReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');
CREATE TYPE "ProfileReportTarget" AS ENUM ('DOCTOR', 'FACILITY');

CREATE TABLE "profile_reports" (
  "id" UUID NOT NULL,
  "reporter_id" UUID NOT NULL,
  "target_type" "ProfileReportTarget" NOT NULL,
  "target_id" UUID NOT NULL,
  "reason" VARCHAR(40) NOT NULL,
  "details" VARCHAR(1000),
  "status" "ProfileReportStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_id" UUID,
  CONSTRAINT "profile_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "profile_reports_status_created_at_idx" ON "profile_reports"("status", "created_at" DESC);
CREATE INDEX "profile_reports_target_type_target_id_idx" ON "profile_reports"("target_type", "target_id");
CREATE INDEX "profile_reports_reporter_id_target_type_target_id_status_idx" ON "profile_reports"("reporter_id", "target_type", "target_id", "status");
