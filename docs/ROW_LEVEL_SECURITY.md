# Facility row-level security

A second, database-level lock behind the application's own facility checks. If a route ever forgets its `facilityId` filter, Postgres still refuses to show or change another facility's clinical rows.

## What it does

- 20 clinical tables carry a policy (`facility_isolation`): encounters, admissions, specimens, diagnostic reports, clinical documents, medical media (and upload sessions), nursing observations/tasks/handovers/assessments/care plans, medication orders and administrations, wards, beds, pharmacy stock batches, controlled-substance events, registration drafts, payer coverages.
- `requireFacilityAccess` records the facility a request has proven it acts for. The database pool sends it to Postgres as the transaction-local setting `app.facility_id`. From then on, every query in that request, including raw SQL, joins, batches and interactive transactions, can only see and write that facility's rows. A row cannot be moved to another facility either.
- Without that setting (patients, doctors, admins, cron jobs, scripts, migrations) nothing is restricted. The policy is therefore **inert until you switch it on**, and shipping the migration alone changes nothing.

Diagnostic reports have a slightly wider policy: the owning diagnostic centre can read and change them, and the hospital a report was sent to (or that requested the booking) can read them. The cross-tenant test suite found this when enforcement was first run against it. Other tables where staging may reveal a similar legitimate cross-facility read: specimens, admissions (inter-facility transfers) and clinical documents shared with another facility.

Intentionally not covered, because they are read across facilities by design: `facility_staff` (staff with several memberships), `patient_documents` and `document_facility_shares` (shared records), `facility_referrals`, `lab_orders`. Server-rendered pages do not carry the context yet; only API routes do.

## Turning it on

1. **Create a restricted runtime role.** Postgres superusers and roles with `BYPASSRLS` ignore row-level security, so the app must not connect as one. On Neon the default owner role usually bypasses it. Create a separate role and keep the owner for migrations only:

   ```sql
   CREATE ROLE app_runtime LOGIN PASSWORD '<strong password>' NOSUPERUSER NOBYPASSRLS;
   GRANT USAGE ON SCHEMA public TO app_runtime;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
   ```

   Check it: `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_runtime';` must return `false, false`, and the role must not be a member of any role that bypasses RLS (on Neon, check `neon_superuser`).
2. Apply the migration `20261113120000_facility_row_level_security` (with the owner role, as for every migration). Nothing changes yet.
3. On **staging**, point `DATABASE_URL` at `app_runtime` and set `FACILITY_RLS_CONTEXT=on`. Keep `DIRECT_URL` on the owner for migrations.
4. Run the acceptance flows (`npm run his:acceptance`) and click through each facility dashboard. Watch the error alerts for `42501` / "row-level security" errors: each one is a place where code reads another facility's rows on purpose and needs either a context-free path or a policy exception.
5. Repeat in production.

Cost: one extra database round trip per query in facility requests (none for other requests). Roll back instantly by unsetting `FACILITY_RLS_CONTEXT`.

## How it is tested

`src/lib/rls.int.test.ts` connects as a non-superuser role and checks reads, raw SQL, joins, updates, deletes, moving rows, interactive transactions, batches, concurrent facilities, and that no context leaks to the next request on a reused connection. Run it with `RLS_TEST_DATABASE_URL` pointing at a migrated `*_test` database. The other integration suites (`cross-tenant`, HIS safety, organization, super admin, payments) also pass when run as the restricted role with `FACILITY_RLS_CONTEXT=on`.

Deliberate-break checks: disabling the policy, or stopping the pool from sending the facility, each fails 5 of the 11 tests. Removing the application's own facility filter on the encounter route lets Hospital B change Hospital A's encounter when RLS is off, and is blocked when it is on.

## Adding a table

Give it a required `facility_id uuid` column, then in a migration: `ENABLE` and `FORCE ROW LEVEL SECURITY`, and `CREATE POLICY facility_isolation ON "<table>" USING (app_facility_visible(facility_id)) WITH CHECK (app_facility_visible(facility_id));`. Only do this for tables that are never read across facilities inside a facility request.
