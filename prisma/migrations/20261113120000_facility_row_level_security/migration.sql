-- Facility row-level security (defence in depth behind the application's own facility checks).
--
-- Rows in the tables below belong to exactly one facility. When a request has proven which facility
-- it is acting for, the application sets the transaction-local setting app.facility_id and Postgres
-- then refuses to read or write any other facility's rows, even if a route forgets its own filter.
--
--  * No setting (patients, doctors, admins, cron, scripts, migrations): every row is visible, so
--    this migration changes nothing until the application starts setting it (FACILITY_RLS_CONTEXT=on).
--  * FORCE ROW LEVEL SECURITY makes the policy apply to the table owner too. Superusers and roles
--    with BYPASSRLS are never subject to it, so the application must connect as an ordinary role
--    (see docs/ROW_LEVEL_SECURITY.md).
--
-- diagnostic_reports has its own policy (below) because hospitals legitimately read reports sent to them.
--
-- Not covered on purpose: tables read across facilities by design (facility_staff for multi-facility
-- staff, patient_documents and document_facility_shares for shared records, referrals, lab_orders).

CREATE OR REPLACE FUNCTION app_facility_visible(row_facility uuid) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(current_setting('app.facility_id', true), '') IS NULL
      OR row_facility = nullif(current_setting('app.facility_id', true), '')::uuid
$$;

ALTER TABLE "encounters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encounters" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "encounters" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "admissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "admissions" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "specimens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "specimens" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "specimens" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "diagnostic_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnostic_reports" FORCE ROW LEVEL SECURITY;
-- A diagnostic centre owns its reports and may change them. The hospital a report was sent to (or that
-- requested the booking) may read it, which is a cross-facility read by design.
CREATE POLICY facility_isolation ON "diagnostic_reports"
  USING (
    app_facility_visible(facility_id)
    OR app_facility_visible(sent_to_facility_id)
    OR EXISTS (SELECT 1 FROM "facility_bookings" b WHERE b.id = booking_id AND app_facility_visible(b.requesting_facility_id))
  )
  WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "clinical_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "clinical_documents" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "medical_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medical_media" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "medical_media" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "medical_media_upload_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medical_media_upload_session" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "medical_media_upload_session" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "nursing_observation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursing_observation" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "nursing_observation" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "nursing_task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursing_task" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "nursing_task" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "nursing_handover" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursing_handover" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "nursing_handover" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "nursing_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursing_assessments" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "nursing_assessments" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "nursing_care_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nursing_care_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "nursing_care_plans" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "medication_order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medication_order" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "medication_order" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "medication_administration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medication_administration" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "medication_administration" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "wards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wards" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "wards" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "beds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "beds" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "beds" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "pharmacy_stock_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pharmacy_stock_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "pharmacy_stock_batches" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "controlled_substance_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "controlled_substance_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "controlled_substance_events" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "registration_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registration_drafts" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "registration_drafts" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));

ALTER TABLE "payer_coverages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payer_coverages" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "payer_coverages" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));
