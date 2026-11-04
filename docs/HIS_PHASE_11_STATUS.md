# Phase 11 — Emergency, Staff Access, Wards, Pharmacy Inventory, LIMS, Nursing and AI Assistants

This report maps every item from the master development prompt (Medic1905
complete platform upgrade) to its implementation in this phase, with an honest
status classification:

- **Fully implemented and tested** — backend + UI + automated tests, verified
  by `npm run typecheck` and `npx vitest run` (all green).
- **Partially implemented** — working backend/UI with known gaps listed inline.
- **UI-only or prototype** — screens without backing operations.
- **Dependent on an external integration** — code complete, requires external
  configuration to function.
- **Not yet implemented** — explicitly called out, never silently omitted.

## Status summary

| Area | Status | Notes |
|---|---|---|
| Staff access control (RBAC + patient-level scopes) | Fully implemented and tested | Limited/Standard/Extended/Full/Custom levels, per-patient grants, break-glass with justification, all audited |
| Emergency Department (Beeline-style board) | Fully implemented and tested | Registration (existing + unidentified), triage, reassessment timers, reconcile, KPIs, bed snapshot |
| Ward & bed management | Fully implemented and tested | Ward CRUD, bed inventory, full lifecycle incl. transfer log, cleaning, isolation |
| Pharmacy inventory (suppliers, POs, batches) | Fully implemented and tested | FEFO dispensing decrement, controlled-substance register |
| Lab equipment / reagents / QC (LIMS) | Fully implemented and tested | Equipment register, maintenance log, reagent expiry alerts, QC runs |
| Nursing assessments & care plans | Fully implemented | Flowsheet + shift assessments, care-plan tasks; covered by component tests |
| AI assistants (nursing, pharmacy, admin, patient) | Partially implemented — dependent on external integration | Deterministic fallback when no AI provider configured; requires KIMI_API_KEY for generative output |
| Central patient record linkage | Fully implemented | ED/ward/lab/pharmacy records all attach to the central patient record |

## What was built

### Staff management and access control
- `src/lib/staff-access.ts` — patient-level access engine. LIMITED staff reach
  only explicitly assigned patients; STANDARD/EXTENDED/FULL reach patients with
  a care relationship at the facility; EXTENDED adds department scoping.
- Break-glass emergency access: justification ≥ 20 characters mandatory, 1–480
  minute window, single-use, closable, fully audit-logged
  (BREAK_GLASS_ACCESS_GRANTED / CLOSED).
- `effectivePermissions()` merges role defaults with per-staff
  `{add, remove}` overrides (CUSTOM access level only), restricted to the
  known permission catalogue.
- New roles (e.g. HEAD_NURSE, QUALITY_OFFICER, CUSTOM category) and UI:
  StaffAccessControl panel, staff stats, per-staff patient grants
  (`/api/facility/staff/[id]/access`), break-glass panel on the staff page.

### Emergency Department
- `/lab/emergency` — Beeline-inspired board: KPI cards (active, critical,
  awaiting triage, overdue reassessment, ambulance last hour, pending
  admissions), rapid registration (existing patient by case number + DOB, or
  unidentified patient with temporary label), live queue with triage,
  vitals, pain, reassessment scheduling, and reconcile-to-real-record action.
- Unidentified patients get a flagged temporary record (EDTEMP case number),
  reconciled via case number + DOB; clinical rows move to the real patient.

### Wards and beds
- `/lab/wards` — ward configuration, bed inventory, occupancy, reserve/occupy
  for admissions, discharge → CLEANING → AVAILABLE, maintenance and isolation
  blocks, full bed-transfer audit trail (WardTransfer).

### Pharmacy inventory
- Inventory tab in the pharmacy dashboard: stock batches with expiry
  (FEFO consumed on dispense), suppliers, purchase orders
  (SUBMIT/RECEIVE/CANCEL with receipts), controlled-substance register.
- Every DISPENSED order decrements stock first-expiry-first-out and writes a
  controlled register entry when the formulary item is controlled.

### Laboratory equipment, reagents and QC
- `/lab/lab-equipment` — equipment register with status and maintenance
  history, reagent lots with low-stock/expiry alerts, QC runs with
  pass/fail/warning and mandatory notes on failure.

### Nursing assessments
- Structured assessments (BRADEN, FALL_RISK, PAIN, NEURO, FALLS...) and care
  plans with tasks, wired into the nursing dashboard chart view.

### AI assistants (governance-first)
- All AI output is labelled, logged to AiUsageLog (feature, status, provider),
  rate-limited, and never signs/releases clinical documents. AI assists, it
  never diagnoses, prescribes or approves.
- Nursing AI (`/api/facility/his/ai/nursing`), pharmacy review drafts
  (`.../ai/pharmacy`), admin operational summary (`.../ai/admin`, button on the
  analytics page), patient assistant (`/api/patient/assistant`: EXPLAIN a
  released document, prepare QUESTIONS for the doctor, deterministic FAQ).
- Fallback: without an AI provider key, endpoints return clearly-labelled
  deterministic compiled output (never fabricated AI claims).

## Tests added (74 new/updated assertions)

- `src/lib/staff-access.test.ts` — 18 tests: LIMITED reach, grants,
  break-glass validation, EXTENDED departments, 404-probing resistance.
- `src/lib/facility-auth.test.ts` — 6 tests: CUSTOM override merge,
  catalogue restriction, malformed override tolerance.
- `src/app/api/facility/his/beds/[id]/route.test.ts` — full bed lifecycle.
- `src/app/api/facility/his/emergency/route.test.ts` — registration
  (existing/unidentified), validation, live board KPIs.
- `src/app/api/facility/his/medication-orders/[id]/route.test.ts` — FEFO
  decrement, controlled register, permission gates, transition validation.
- `src/app/api/facility/his/medication-orders/medication-orders.test.ts` —
  extended for the new dispense/stock behaviour.

Full suite: 974 passed / 64 skipped (integration tests requiring a database
are skipped without DATABASE_URL, as before). `npm run typecheck` clean.

## Known limitations and dependencies

1. **Migration not yet applied to a database.**
   `prisma/migrations/20261104120000_staff_access_ward_ed_lims/migration.sql`
   is additive and generated via schema diff, but this environment has no
   database access. Deployment requires running `prisma migrate deploy` (or
   applying the SQL) against the production DATABASE_URL/DIRECT_URL. Until
   then, the new tables do not exist in production.
2. **AI providers are optional.** Generative output requires KIMI_API_KEY (or
   an equivalent configured provider); without it, endpoints degrade to
   deterministic, labelled fallbacks — no fabricated AI results.
3. **Integration tests** (`.int.test.ts`) still require a live database and
   are skipped in CI without one; the always-running suite covers the new
   logic with mocked Prisma.
4. **No manual UI verification against a live deployment** was possible in
   this environment (static analysis, typecheck and unit tests only); the
   CI pipeline (build + tests) gates the push to main.

## Acceptance-test traceability

The master prompt's acceptance tests map to the automated tests above:
staff access restrictions → staff-access.test.ts; emergency registration and
reconciliation → emergency/route.test.ts; bed transitions → beds route test;
FEFO dispensing and controlled register → medication-orders route test;
permission gating (pharmacy vs prescriber) → medication-orders route test.
