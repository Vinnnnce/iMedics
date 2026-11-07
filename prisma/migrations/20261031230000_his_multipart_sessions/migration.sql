-- Resumable multipart upload sessions for large diagnostic studies.
-- Additive only: a new table, no changes to existing clinical tables.
CREATE TABLE "medical_media_upload_session" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "format_key" VARCHAR(30) NOT NULL,
    "declared_size_bytes" BIGINT NOT NULL,
    "declared_sha256" VARCHAR(64) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "s3_upload_id" VARCHAR(200) NOT NULL,
    "part_size_bytes" BIGINT NOT NULL,
    "parts_total" INTEGER NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_media_upload_session_pkey" PRIMARY KEY ("id")
);

-- @@Unique
CREATE UNIQUE INDEX "medical_media_upload_session_storage_key_key" ON "medical_media_upload_session"("storage_key");

-- @@Index
CREATE INDEX "medical_media_upload_session_facility_id_status_idx" ON "medical_media_upload_session"("facility_id", "status");
CREATE INDEX "medical_media_upload_session_status_expires_at_idx" ON "medical_media_upload_session"("status", "expires_at");
