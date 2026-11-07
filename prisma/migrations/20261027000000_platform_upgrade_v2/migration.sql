-- Platform upgrade v2. Additive only: no existing column is dropped or retyped.

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- Ads: image, link, schedule and ordering
ALTER TABLE "ads"
  ADD COLUMN "image_url" VARCHAR(500),
  ADD COLUMN "link_url" VARCHAR(500),
  ADD COLUMN "starts_at" TIMESTAMP(3),
  ADD COLUMN "ends_at" TIMESTAMP(3),
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "ads_placement_active_sort_order_idx" ON "ads"("placement", "active", "sort_order");

-- Consultations: amendment tracking
ALTER TABLE "consultations"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "amended_at" TIMESTAMP(3);
CREATE INDEX "consultations_doctor_id_status_updated_at_idx" ON "consultations"("doctor_id", "status", "updated_at");
CREATE INDEX "consultations_patient_id_status_finalized_at_idx" ON "consultations"("patient_id", "status", "finalized_at");

-- Consultation revisions (snapshots taken before each amendment)
CREATE TABLE "consultation_revisions" (
  "id" UUID NOT NULL,
  "consultation_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "reason" VARCHAR(500),
  "edited_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consultation_revisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "consultation_revisions_consultation_id_revision_key" ON "consultation_revisions"("consultation_id", "revision");
CREATE INDEX "consultation_revisions_consultation_id_idx" ON "consultation_revisions"("consultation_id");
ALTER TABLE "consultation_revisions"
  ADD CONSTRAINT "consultation_revisions_consultation_id_fkey"
  FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Facility-wide document shares
CREATE TABLE "document_facility_shares" (
  "id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "granted_by_id" UUID NOT NULL,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "document_facility_shares_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "document_facility_shares_document_id_facility_id_key" ON "document_facility_shares"("document_id", "facility_id");
CREATE INDEX "document_facility_shares_facility_id_revoked_at_idx" ON "document_facility_shares"("facility_id", "revoked_at");
ALTER TABLE "document_facility_shares"
  ADD CONSTRAINT "document_facility_shares_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "patient_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_facility_shares"
  ADD CONSTRAINT "document_facility_shares_facility_id_fkey"
  FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Patient documents: list by issuing facility
CREATE INDEX "patient_documents_issuing_facility_id_created_at_idx" ON "patient_documents"("issuing_facility_id", "created_at");

-- Homepage "top rated" queries
CREATE INDEX "doctor_profiles_top_rated_idx"
  ON "doctor_profiles"("verification_status", "rating_avg" DESC, "rating_count" DESC);
CREATE INDEX "lab_staff_profiles_top_rated_idx"
  ON "lab_staff_profiles"("is_published", "verification_status", "kind", "rating_avg" DESC);

-- News articles
CREATE TABLE "news_articles" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "summary" VARCHAR(500),
  "body" TEXT NOT NULL,
  "cover_image_url" VARCHAR(500),
  "author_name" VARCHAR(120),
  "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "news_articles_slug_key" ON "news_articles"("slug");
CREATE INDEX "news_articles_status_published_at_idx" ON "news_articles"("status", "published_at" DESC);

-- Podcast episodes
CREATE TABLE "podcast_episodes" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "audio_url" VARCHAR(500),
  "cover_image_url" VARCHAR(500),
  "duration_seconds" INTEGER,
  "episode_number" INTEGER,
  "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "podcast_episodes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "podcast_episodes_slug_key" ON "podcast_episodes"("slug");
CREATE INDEX "podcast_episodes_status_published_at_idx" ON "podcast_episodes"("status", "published_at" DESC);
