-- Additive only. No historical clinical content is rewritten.
ALTER TABLE "users" ADD COLUMN "test_account_expires_at" TIMESTAMP(3);

-- Existing single-column foreign keys do not ensure that the related record
-- belongs to the SAME hospital and patient. Validate new/relinked records at
-- the database boundary, independently of application request guards.
CREATE OR REPLACE FUNCTION his_check_document_links() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE linked_facility uuid;
BEGIN
  SELECT t.facility_id INTO linked_facility
    FROM clinical_document_template_versions v
    JOIN clinical_document_templates t ON t.id = v.template_id
    WHERE v.id = NEW.template_version_id;
  IF linked_facility IS DISTINCT FROM NEW.facility_id THEN
    RAISE EXCEPTION 'HIS template tenant mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW.encounter_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM encounters e WHERE e.id = NEW.encounter_id
      AND e.facility_id = NEW.facility_id AND e.patient_id = NEW.patient_id
  ) THEN RAISE EXCEPTION 'HIS encounter scope mismatch' USING ERRCODE = '23514'; END IF;
  IF NEW.admission_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM admissions a WHERE a.id = NEW.admission_id
      AND a.facility_id = NEW.facility_id AND a.patient_id = NEW.patient_id
  ) THEN RAISE EXCEPTION 'HIS admission scope mismatch' USING ERRCODE = '23514'; END IF;
  IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clinical_documents d WHERE d.id = NEW.supersedes_id
      AND d.facility_id = NEW.facility_id AND d.patient_id = NEW.patient_id
  ) THEN RAISE EXCEPTION 'HIS amendment scope mismatch' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER his_document_scope_check
BEFORE INSERT OR UPDATE OF facility_id, patient_id, template_version_id, encounter_id, admission_id, supersedes_id
ON clinical_documents FOR EACH ROW EXECUTE FUNCTION his_check_document_links();

CREATE OR REPLACE FUNCTION his_check_media_links() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.encounter_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM encounters e WHERE e.id = NEW.encounter_id
      AND e.facility_id = NEW.facility_id AND e.patient_id = NEW.patient_id
  ) THEN RAISE EXCEPTION 'HIS media encounter scope mismatch' USING ERRCODE = '23514'; END IF;
  IF NEW.storage_key NOT LIKE 'medical-media/final/' || NEW.facility_id::text || '/' || NEW.patient_id::text || '/%' THEN
    RAISE EXCEPTION 'HIS media storage scope mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER his_media_scope_check
BEFORE INSERT OR UPDATE OF facility_id, patient_id, encounter_id, storage_key
ON medical_media FOR EACH ROW EXECUTE FUNCTION his_check_media_links();

CREATE OR REPLACE FUNCTION his_check_encounter_links() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE linked_category text;
BEGIN
  IF NEW.coverage_id IS NOT NULL THEN
    SELECT c.category::text INTO linked_category FROM payer_coverages c WHERE c.id = NEW.coverage_id
      AND c.facility_id = NEW.facility_id AND c.patient_id = NEW.patient_id FOR SHARE;
    IF linked_category IS NULL THEN
      RAISE EXCEPTION 'HIS payer scope mismatch' USING ERRCODE = '23514';
    END IF;
    IF NEW.payer_category::text IS DISTINCT FROM linked_category THEN
      RAISE EXCEPTION 'HIS payer snapshot changed during registration; retry' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.admission_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM admissions a WHERE a.id = NEW.admission_id
      AND a.facility_id = NEW.facility_id AND a.patient_id = NEW.patient_id
  ) THEN RAISE EXCEPTION 'HIS encounter admission scope mismatch' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER his_encounter_scope_check
BEFORE INSERT OR UPDATE OF facility_id, patient_id, coverage_id, admission_id
ON encounters FOR EACH ROW EXECUTE FUNCTION his_check_encounter_links();

-- Identity is not an editable clinical field. This also prevents a parent
-- being reparented after a valid child was linked to it.
CREATE OR REPLACE FUNCTION his_immutable_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE field_name text;
BEGIN
  FOREACH field_name IN ARRAY TG_ARGV LOOP
    IF to_jsonb(OLD)->field_name IS DISTINCT FROM to_jsonb(NEW)->field_name THEN
      RAISE EXCEPTION 'HIS record identity is immutable' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER his_document_identity BEFORE UPDATE ON clinical_documents
FOR EACH ROW EXECUTE FUNCTION his_immutable_identity('facility_id', 'patient_id');
CREATE TRIGGER his_media_identity BEFORE UPDATE ON medical_media
FOR EACH ROW EXECUTE FUNCTION his_immutable_identity('facility_id', 'patient_id');
CREATE TRIGGER his_encounter_identity BEFORE UPDATE ON encounters
FOR EACH ROW EXECUTE FUNCTION his_immutable_identity('facility_id', 'patient_id', 'coverage_id', 'payer_category');
CREATE TRIGGER his_coverage_identity BEFORE UPDATE ON payer_coverages
FOR EACH ROW EXECUTE FUNCTION his_immutable_identity('facility_id', 'patient_id');
CREATE TRIGGER his_admission_identity BEFORE UPDATE ON admissions
FOR EACH ROW EXECUTE FUNCTION his_immutable_identity('facility_id', 'patient_id');
CREATE TRIGGER his_template_identity BEFORE UPDATE ON clinical_document_templates
FOR EACH ROW EXECUTE FUNCTION his_immutable_identity('facility_id');
CREATE TRIGGER his_template_version_identity BEFORE UPDATE ON clinical_document_template_versions
FOR EACH ROW EXECUTE FUNCTION his_immutable_identity('template_id');

CREATE OR REPLACE FUNCTION his_preserve_used_coverage() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['eligibility','claim_status','active','ended_at','ended_reason','updated_at'])
      IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['eligibility','claim_status','active','ended_at','ended_reason','updated_at'])
     AND EXISTS (SELECT 1 FROM encounters e WHERE e.coverage_id = OLD.id) THEN
    RAISE EXCEPTION 'HIS historical coverage is immutable; end it and create a replacement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER his_coverage_history BEFORE UPDATE ON payer_coverages
FOR EACH ROW EXECUTE FUNCTION his_preserve_used_coverage();
