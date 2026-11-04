-- Backward-compatible additions. No patient, signed-document or account row is rewritten.
ALTER TYPE "StaffAccessLevel" ADD VALUE IF NOT EXISTS 'NONE';
ALTER TYPE "StaffAccessLevel" ADD VALUE IF NOT EXISTS 'READ_ONLY';
ALTER TYPE "StaffAccessLevel" ADD VALUE IF NOT EXISTS 'DEPARTMENT';

-- A professional has a distinct membership per facility, not per platform.
DROP INDEX IF EXISTS "facility_staff_user_id_key";
CREATE UNIQUE INDEX "facility_staff_facility_id_user_id_key" ON "facility_staff"("facility_id", "user_id");

ALTER TABLE "facility_staff"
  ADD COLUMN "access_starts_at" TIMESTAMP(3),
  ADD COLUMN "access_expires_at" TIMESTAMP(3),
  ADD COLUMN "invitation_state" TEXT NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
  ADD COLUMN "reports_to_id" UUID,
  ADD CONSTRAINT "facility_staff_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "facility_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "staff_access_dates_check" CHECK ("access_starts_at" IS NULL OR "access_expires_at" IS NULL OR "access_starts_at" < "access_expires_at");

ALTER TABLE "facility_departments"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "parent_id" UUID,
  ADD COLUMN "deputy_staff_id" UUID,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "image_url" TEXT,
  ADD CONSTRAINT "facility_departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "facility_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "facility_departments_deputy_staff_id_fkey" FOREIGN KEY ("deputy_staff_id") REFERENCES "facility_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "department_distinct_leadership" CHECK ("lead_staff_id" IS NULL OR "deputy_staff_id" IS NULL OR "lead_staff_id" <> "deputy_staff_id");
CREATE UNIQUE INDEX "facility_departments_facility_id_code_key" ON "facility_departments"("facility_id", "code");

CREATE TABLE "super_admin_grants" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "granted_by" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3), "revoked_at" TIMESTAMP(3)
);
CREATE TABLE "organization_positions" (
  "id" UUID PRIMARY KEY, "facility_id" UUID NOT NULL REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT,
  "department_id" UUID REFERENCES "facility_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" TEXT NOT NULL, "category" TEXT NOT NULL, "rank" INTEGER NOT NULL DEFAULT 0 CHECK ("rank" >= 0),
  "parent_id" UUID REFERENCES "organization_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "organization_positions_facility_id_department_id_idx" ON "organization_positions"("facility_id", "department_id");
CREATE TABLE "staff_appointments" (
  "id" UUID PRIMARY KEY, "facility_id" UUID NOT NULL REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT,
  "staff_id" UUID NOT NULL REFERENCES "facility_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "position_id" UUID NOT NULL REFERENCES "organization_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" TEXT NOT NULL DEFAULT 'SUBSTANTIVE' CHECK ("kind" IN ('SUBSTANTIVE','ACTING','DEPUTY')),
  "effective_at" TIMESTAMP(3) NOT NULL, "ends_at" TIMESTAMP(3), "reason" TEXT NOT NULL,
  "created_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("ends_at" IS NULL OR "ends_at" > "effective_at")
);
CREATE INDEX "staff_appointments_facility_id_position_id_effective_at_idx" ON "staff_appointments"("facility_id", "position_id", "effective_at");
CREATE INDEX "staff_appointments_staff_id_effective_at_idx" ON "staff_appointments"("staff_id", "effective_at");
CREATE TABLE "clinical_privileges" (
  "id" UUID PRIMARY KEY,
  "staff_id" UUID NOT NULL REFERENCES "facility_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "credential_id" UUID NOT NULL REFERENCES "staff_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "permission" TEXT NOT NULL, "granted_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "reason" TEXT NOT NULL, "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL, "revoked_at" TIMESTAMP(3), CHECK ("expires_at" > "starts_at")
);
CREATE INDEX "clinical_privileges_staff_id_permission_expires_at_idx" ON "clinical_privileges"("staff_id", "permission", "expires_at");
CREATE UNIQUE INDEX "staff_credentials_id_staff_id_key" ON "staff_credentials"("id", "staff_id");
ALTER TABLE "clinical_privileges" ADD CONSTRAINT "clinical_privileges_credential_staff_fkey"
  FOREIGN KEY ("credential_id", "staff_id") REFERENCES "staff_credentials"("id", "staff_id") ON DELETE RESTRICT;
CREATE TABLE "platform_policies" (
  "id" UUID PRIMARY KEY, "key" TEXT NOT NULL, "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "resource" TEXT NOT NULL, "kind" TEXT NOT NULL CHECK ("kind" IN ('FEATURE','DOCUMENT')),
  "mode" TEXT NOT NULL CHECK ("mode" IN ('ENABLED','DISABLED','READ_ONLY','RESTRICTED')),
  "rules" JSONB NOT NULL, "reason" TEXT NOT NULL, "created_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "platform_policies_key_revision_key" ON "platform_policies"("key","revision");
CREATE INDEX "platform_policies_kind_resource_created_at_idx" ON "platform_policies"("kind","resource","created_at");
CREATE TABLE "control_audit_events" (
  "sequence" BIGSERIAL PRIMARY KEY,
  "actor_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "facility_id" UUID REFERENCES "lab_staff_profiles"("id") ON DELETE RESTRICT,
  "action" TEXT NOT NULL, "resource_id" TEXT NOT NULL, "details" JSONB NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previous_hash" TEXT NOT NULL DEFAULT '', "hash" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX "control_audit_events_facility_id_occurred_at_idx" ON "control_audit_events"("facility_id","occurred_at");

CREATE FUNCTION medic_control_audit_chain() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('medic1905-audit-chain'));
  -- Allocate the visible order after the lock, not before it: concurrent
  -- inserts must not invert sequence ordering relative to chain ordering.
  NEW.sequence := nextval(pg_get_serial_sequence('control_audit_events', 'sequence'));
  SELECT hash INTO NEW.previous_hash FROM control_audit_events ORDER BY sequence DESC LIMIT 1;
  NEW.previous_hash := COALESCE(NEW.previous_hash, '');
  NEW.hash := encode(sha256(convert_to(
    jsonb_build_array(NEW.previous_hash, NEW.sequence, NEW.actor_id, NEW.facility_id,
      NEW.action, NEW.resource_id, NEW.details, NEW.occurred_at)::text, 'UTF8')), 'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER control_audit_chain BEFORE INSERT ON control_audit_events FOR EACH ROW EXECUTE FUNCTION medic_control_audit_chain();
CREATE FUNCTION medic_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only audit/policy history cannot be changed'; END $$;
CREATE TRIGGER control_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON control_audit_events FOR EACH STATEMENT EXECUTE FUNCTION medic_append_only();
CREATE TRIGGER platform_policy_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON platform_policies FOR EACH STATEMENT EXECUTE FUNCTION medic_append_only();

-- Enforce tenant links even for direct SQL and future API implementations.
CREATE FUNCTION medic_organization_tenant_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked UUID; candidate UUID; ancestor UUID; seen UUID[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.facility_id::text));
  IF TG_OP = 'UPDATE' AND NEW.facility_id <> OLD.facility_id THEN
    RAISE EXCEPTION 'Facility identity is immutable';
  END IF;
  IF TG_TABLE_NAME = 'facility_departments' THEN
    FOREACH candidate IN ARRAY ARRAY[NEW.lead_staff_id, NEW.deputy_staff_id] LOOP
      IF candidate IS NOT NULL THEN
        SELECT facility_id INTO linked FROM facility_staff WHERE id = candidate;
        IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility leadership denied'; END IF;
      END IF;
    END LOOP;
    ancestor := NEW.parent_id; seen := ARRAY[NEW.id];
    WHILE ancestor IS NOT NULL LOOP
      IF ancestor = ANY(seen) THEN RAISE EXCEPTION 'Department cycle denied'; END IF;
      seen := array_append(seen, ancestor);
      SELECT facility_id, parent_id INTO linked, ancestor FROM facility_departments WHERE id = ancestor;
      IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility parent denied'; END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'facility_staff' THEN
    IF NEW.department_id IS NOT NULL THEN
      SELECT facility_id INTO linked FROM facility_departments WHERE id = NEW.department_id;
      IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility department denied'; END IF;
    END IF;
    IF NEW.branch_id IS NOT NULL THEN
      SELECT facility_id INTO linked FROM facility_branches WHERE id = NEW.branch_id;
      IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility branch denied'; END IF;
    END IF;
    FOREACH candidate IN ARRAY NEW.department_ids LOOP
      SELECT facility_id INTO linked FROM facility_departments WHERE id = candidate;
      IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility scope denied'; END IF;
    END LOOP;
    ancestor := NEW.reports_to_id; seen := ARRAY[NEW.id];
    WHILE ancestor IS NOT NULL LOOP
      IF ancestor = ANY(seen) THEN RAISE EXCEPTION 'Staff reporting cycle denied'; END IF;
      seen := array_append(seen, ancestor);
      SELECT facility_id, reports_to_id INTO linked, ancestor FROM facility_staff WHERE id = ancestor;
      IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility manager denied'; END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'organization_positions' THEN
    IF NEW.department_id IS NOT NULL THEN
      SELECT facility_id INTO linked FROM facility_departments WHERE id = NEW.department_id;
      IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility position denied'; END IF;
    END IF;
    ancestor := NEW.parent_id; seen := ARRAY[NEW.id];
    WHILE ancestor IS NOT NULL LOOP
      IF ancestor = ANY(seen) THEN RAISE EXCEPTION 'Position cycle denied'; END IF;
      seen := array_append(seen, ancestor);
      SELECT facility_id, parent_id INTO linked, ancestor FROM organization_positions WHERE id = ancestor;
      IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility reporting position denied'; END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'staff_appointments' THEN
    SELECT facility_id INTO linked FROM facility_staff WHERE id = NEW.staff_id;
    IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility appointment denied'; END IF;
    SELECT facility_id INTO linked FROM organization_positions WHERE id = NEW.position_id;
    IF linked IS DISTINCT FROM NEW.facility_id THEN RAISE EXCEPTION 'Cross-facility position denied'; END IF;
    IF EXISTS (SELECT 1 FROM staff_appointments WHERE id <> NEW.id AND position_id = NEW.position_id AND kind = NEW.kind
      AND effective_at < COALESCE(NEW.ends_at, 'infinity'::timestamp)
      AND COALESCE(ends_at, 'infinity'::timestamp) > NEW.effective_at) THEN RAISE EXCEPTION 'Overlapping appointment denied'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER department_tenant_guard BEFORE INSERT OR UPDATE ON facility_departments FOR EACH ROW EXECUTE FUNCTION medic_organization_tenant_guard();
CREATE TRIGGER staff_tenant_guard BEFORE INSERT OR UPDATE ON facility_staff FOR EACH ROW EXECUTE FUNCTION medic_organization_tenant_guard();
CREATE TRIGGER position_tenant_guard BEFORE INSERT OR UPDATE ON organization_positions FOR EACH ROW EXECUTE FUNCTION medic_organization_tenant_guard();
CREATE TRIGGER appointment_tenant_guard BEFORE INSERT OR UPDATE ON staff_appointments FOR EACH ROW EXECUTE FUNCTION medic_organization_tenant_guard();
