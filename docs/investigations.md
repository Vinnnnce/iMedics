# Investigations: Results & Reports

One central catalogue, one order pipeline, one result chain. Doctors, laboratories
and diagnostic centres use different views of the same rows.

## Flow
1. Doctor: `/doctor/lab-requests` -> Diagnostics or Laboratory Analysis -> `/doctor/lab-requests/new?domain=`.
2. Submit (electronic authorisation) routes every item to a facility + department (`investigation_order_items.departmentKey`).
3. Facility: `/lab/results-reports` worklists -> `/lab/results-reports/items/[id]` workspace.
4. enter -> verify (different person) -> sign -> release. Released reports reach the doctor, the patient (if visible) and the case-file folders.

## Data model (migration `20261120000000_investigations_platform`)
investigation_categories, investigation_catalogue_items, investigation_Analytes, facility_investigations, investigation_orders,
investigation_order_items, investigation_status_history, investigation_specimens, investigation_results (versioned),
investigation_observations, investigation_media, investigation_critical_alerts/AlertEvent, investigation_interpretations,
investigation_order-sets, investigation_referrals, InvestigationCounter.
DB triggers: signed/released results and their observations are immutable; status history and alert events are append-only.
Facility RLS (inert until `app.facility_id` is set) on order items and specimens.

## Terminology
Local codes are `M19-...` (never international). LOINC codes are shipped only for common analytes and every item is
`standardCodesVerified = false` until verified. No SNOMED CT ids are shipped. No reference ranges are seeded.

## Seeding
The standard catalogue seeds itself on first read of an empty database (`ensureCatalogueSeeded`), or call
`seedInvestigationCatalogue()` from `src/lib/investigations/catalogue-seed.ts`. It is idempotent.

## Tests
- `npm test` runs the unit tests.
- Database integration test (disposable `*_test` database with all migrations applied):
  `INVESTIGATIONS_TEST_DATABASE_URL=postgres://.../medic_test npx vitest run src/lib/investigations`
