-- Healthcare Operations Intelligence. Purely additive: two nullable-safe defaults on hospital_settings
-- and four new tables. No existing data is rewritten and no operational record is duplicated.

ALTER TABLE "hospital_settings"
  ADD COLUMN IF NOT EXISTS "week_starts_on" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "financial_year_start_month" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "hospital_settings" ADD CONSTRAINT "hospital_settings_week_starts_on_chk" CHECK ("week_starts_on" BETWEEN 0 AND 6);
ALTER TABLE "hospital_settings" ADD CONSTRAINT "hospital_settings_fy_start_month_chk" CHECK ("financial_year_start_month" BETWEEN 1 AND 12);

CREATE TABLE "analytics_performance_targets" (
  "id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "metric_key" VARCHAR(80) NOT NULL,
  "scope_key" VARCHAR(60) NOT NULL DEFAULT 'FACILITY',
  "department_id" UUID,
  "target_value" DECIMAL(14,4) NOT NULL,
  "direction" VARCHAR(10) NOT NULL DEFAULT 'AT_LEAST',
  "note" VARCHAR(300),
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_performance_targets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analytics_performance_targets_direction_chk" CHECK ("direction" IN ('AT_LEAST', 'AT_MOST'))
);
CREATE UNIQUE INDEX "analytics_performance_targets_facility_id_metric_key_scope_key_key" ON "analytics_performance_targets"("facility_id", "metric_key", "scope_key");
CREATE INDEX "analytics_performance_targets_facility_id_idx" ON "analytics_performance_targets"("facility_id");
ALTER TABLE "analytics_performance_targets" ADD CONSTRAINT "analytics_performance_targets_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_snapshots" (
  "id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "dashboard" VARCHAR(40) NOT NULL,
  "cache_key" VARCHAR(200) NOT NULL,
  "payload" JSONB NOT NULL,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "analytics_snapshots_facility_id_dashboard_cache_key_key" ON "analytics_snapshots"("facility_id", "dashboard", "cache_key");
CREATE INDEX "analytics_snapshots_expires_at_idx" ON "analytics_snapshots"("expires_at");
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_report_definitions" (
  "id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "report_key" VARCHAR(60) NOT NULL,
  "params" JSONB NOT NULL DEFAULT '{}',
  "schedule" VARCHAR(12) NOT NULL DEFAULT 'NONE',
  "next_run_at" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_report_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analytics_report_definitions_schedule_chk" CHECK ("schedule" IN ('NONE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'))
);
CREATE INDEX "analytics_report_definitions_facility_id_active_idx" ON "analytics_report_definitions"("facility_id", "active");
CREATE INDEX "analytics_report_definitions_next_run_at_idx" ON "analytics_report_definitions"("next_run_at");
ALTER TABLE "analytics_report_definitions" ADD CONSTRAINT "analytics_report_definitions_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_generated_reports" (
  "id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "definition_id" UUID,
  "report_key" VARCHAR(60) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "time_zone" VARCHAR(60) NOT NULL,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB NOT NULL,
  "generated_by_id" UUID,
  "trigger" VARCHAR(12) NOT NULL DEFAULT 'MANUAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_generated_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "analytics_generated_reports_facility_id_created_at_idx" ON "analytics_generated_reports"("facility_id", "created_at" DESC);
ALTER TABLE "analytics_generated_reports" ADD CONSTRAINT "analytics_generated_reports_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_generated_reports" ADD CONSTRAINT "analytics_generated_reports_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "analytics_report_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Facility isolation (same policy as the clinical tables; see 20261113120000_facility_row_level_security).
ALTER TABLE "analytics_performance_targets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_performance_targets" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "analytics_performance_targets" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));
ALTER TABLE "analytics_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "analytics_snapshots" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));
ALTER TABLE "analytics_report_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_report_definitions" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "analytics_report_definitions" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));
ALTER TABLE "analytics_generated_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_generated_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_isolation ON "analytics_generated_reports" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));
