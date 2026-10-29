-- CreateEnum
CREATE TYPE "NoteTemplateKind" AS ENUM ('CONSULTATION', 'CASE_NOTE', 'REFERRAL');

-- CreateTable
CREATE TABLE "note_templates" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "NoteTemplateKind" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_templates_author_id_kind_idx" ON "note_templates"("author_id", "kind");

-- AddForeignKey
ALTER TABLE "note_templates" ADD CONSTRAINT "note_templates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

