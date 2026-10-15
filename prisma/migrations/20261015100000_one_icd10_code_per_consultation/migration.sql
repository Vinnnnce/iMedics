-- Keep the primary diagnosis, then the earliest remaining diagnosis, for consultations
-- that were previously allowed to have multiple ICD-10 codes.
WITH ranked_diagnoses AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "consultation_id"
            ORDER BY "is_primary" DESC, "position" ASC, "id" ASC
        ) AS "rank"
    FROM "consultation_diagnoses"
)
DELETE FROM "consultation_diagnoses"
WHERE "id" IN (SELECT "id" FROM ranked_diagnoses WHERE "rank" > 1);

DROP INDEX "consultation_diagnoses_consultation_id_code_key";

CREATE UNIQUE INDEX "consultation_diagnoses_consultation_id_key"
ON "consultation_diagnoses"("consultation_id");
