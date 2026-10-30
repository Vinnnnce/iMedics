CREATE OR REPLACE FUNCTION his_preserve_final_document() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status::text IN ('FINAL','AMENDED','ENTERED_IN_ERROR') THEN
    IF NEW.status::text NOT IN ('FINAL','AMENDED','ENTERED_IN_ERROR')
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.template_version_id IS DISTINCT FROM OLD.template_version_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.author_id IS DISTINCT FROM OLD.author_id
       OR NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
       OR NEW.revision IS DISTINCT FROM OLD.revision
       OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id THEN
      RAISE EXCEPTION 'HIS finalized clinical content is immutable; create an amendment' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER his_final_document_content BEFORE UPDATE ON clinical_documents
FOR EACH ROW EXECUTE FUNCTION his_preserve_final_document();
