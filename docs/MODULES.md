# Hospital, Laboratory & Diagnostic Centre Modules

This document describes the three integrated management modules added to the
Medic1905 platform: **Hospital Management (Module 01)**, **Laboratory
Management (Module 02)** and **Diagnostic Centre Management (Module 03)**,
their shared patient/investigation workflow, the server-enforced access
matrix, and the medical-document template system.

The modules extend the existing facility portal (`/lab`) and reuse the
platform's existing authentication (Clerk), roles, Prisma/Postgres schema,
audit log, notification service and shadcn/ui design system. Facility
"organization kind" (HOSPITAL / LABORATORY / DIAGNOSTIC_CENTRE) is taken from
the facility owner's account type, now denormalized onto the facility profile
(`lab_staff_profiles.kind`, backfilled by migration) so organization scoping
never depends on a join.

## Roles and access control

The platform keeps roles in its own database (`lib/auth.ts`); every API route
is wrapped in `withAuth` and every facility route resolves the caller's
facility membership and permissions (`lib/facility-auth.ts`). On top of that,
the modules add a server-side **access matrix** (`src/lib/modules/access-matrix.ts`):

| Resource | Hospital | Laboratory | Diagnostic centre |
|---|---|---|---|
| Patient registration | Authorized access | Minimum required data | Minimum required data |
| Admission records | Authorized access | No access | No access |
| Outpatient records | Authorized access | No access | No access |
| Inpatient records | Authorized access | No access | No access |
| Laboratory orders / results | Authorized access | Authorized processing access | No access |
| Diagnostic referrals / reports / images | Authorized access | No access | Authorized processing access |
| Discharge summaries / treatment plans | Authorized access | No access | No access |
| Own organization's audit logs | Authorized roles only | Authorized roles only | Authorized roles only |

"Authorized access" means: within the caller's own organization, facility,
permissions and patient-care relationships. A hospital never sees another
hospital's records merely because both have the hospital role; a laboratory
never sees diagnostic reports; changing a URL or API identifier cannot cross
these boundaries because every query is facility-scoped and wrong-kind
requests are refused with 403/404 (see `src/lib/modules/access-matrix.ts` and
the route tests).

## Module 01 — Hospital Management

Portal pages: `/lab/admissions`, `/lab/admissions/[id]`, `/lab/investigations`,
`/lab/critical-alerts` (hospital facilities only; other kinds are redirected).

- **Admissions** (`Admission`): registration and identification of the patient
  by case number (`GET /api/facility/patients`), admission decision, ward/bed,
  reason, initial assessment, working diagnosis with ICD-10 code snapshot.
  Duplicate active admissions per patient are refused (409).
- **Progress documentation** (`AdmissionNote`): admission examinations,
  physician progress notes, nursing observations, specialist consultations and
  procedure reports, with structured vitals (temperature, pulse, BP, …).
- **Transfers**: internal ward transfers (`WardTransfer`, history preserved)
  and interfacility transfers (episode closed with a mandatory transfer
  summary; the receiving facility registers its own admission).
- **Discharge** (`POST .../discharge`): requires a discharge summary
  (epicrisis), final diagnosis, disposition, medication and follow-up
  instructions. Closed episodes are immutable — clinical fields cannot be
  edited after discharge (`admissionIsEditable`).
- **Investigation tracking** (`/lab/investigations`): laboratory orders the
  hospital requested and diagnostic referrals it sent, with statuses,
  specimen accession numbers and critical-alert counts.

## Module 02 — Laboratory Management

Portal pages: `/lab/orders`, `/lab/specimens`, `/lab/critical-alerts`
(laboratory facilities only).

- **Requests**: the laboratory work queue lists only orders where it is the
  performing facility (or unassigned legacy doctor orders, which are claimed
  atomically). Hospitals create orders addressed to a specific laboratory
  (`POST /api/facility/lab-orders`), and the doctor-side flow is unchanged.
- **Specimen management** (`Specimen`): registration against an order with a
  facility-scoped accession number (`SPC-YYYY-NNNNNN`, allocated via a
  per-facility counter inside the same transaction), collection/receipt
  timestamps, processing status, rejection with a mandatory documented
  reason, and recollection as a new specimen linked to the rejected one.
- **Workflow** (`LabOrderStatus`): ORDERED → ACCEPTED → SPECIMEN_PENDING →
  IN_PROGRESS → AWAITING_VERIFICATION → FINALIZED → SENT_TO_FACILITY, with
  AMENDED and SPECIMEN_REJECTED branches. All transitions are validated by
  the state machine (`src/lib/modules/workflows.ts`) against the caller's
  facility permissions; cancellations and amendments require reasons.
- **Results**: the existing result-entry flow (`/api/labs/manual`,
  `/api/lab-orders/[id]`) is extended with optional critical bounds — values
  outside them are flagged CRITICAL_LOW/CRITICAL_HIGH, raise a
  `CriticalResultAlert` for the ordering hospital/clinician and send a
  notification (no clinical detail in the notification body). Hospitals
  acknowledge alerts; unacknowledged alerts escalate after 30 minutes.

## Module 03 — Diagnostic Centre Management

Portal pages: `/lab/examinations` (diagnostic centres only).

- **Referrals & scheduling**: hospitals refer patients via
  `POST /api/facility/diagnostic-referrals` (creates a booking owned by the
  diagnostic centre, tracked by the hospital). The existing appointment and
  workflow-stage machinery is reused.
- **Examination reports** (`DiagnosticReport`): drafts with preliminary
  findings, specialist interpretation and recommendations; submission for
  verification; finalization (verify + sign, version 1 snapshot); delivery to
  the requesting hospital; and amendments.
- **Immutability**: finalized/sent reports can never be edited in place.
  Corrections are amendments (`DiagnosticReportVersion`): a new immutable
  version with a mandatory reason, while every previous version and the
  original remain in the report history.

## Document templates

Facilities customize the structure of the medical documents they issue in
`/lab/document-templates`. The template kinds now cover hospital documents
(discharge summary, epicrisis, admission note, progress note, transfer
summary) and diagnostic reports in addition to the existing lab report,
referral form, case note and imaging report kinds. Templates hold field
scaffolds only — never patient data.

## Shared workflow

1. A hospital identifies a patient (case-number lookup, audited).
2. An authorized clinician creates a lab order or diagnostic referral.
3. The request appears in the receiving organization's queue.
4. The lab/diagnostic centre processes it (specimens, examinations).
5. Authorized personnel enter and verify results.
6. A responsible professional finalizes (and signs) the report.
7. The completed report is returned to the requesting hospital.
8. The hospital sees it in its investigation history and tracks critical
   alerts through acknowledgement.

Patient, order, specimen and report relationships are foreign-keyed and
consistent across the three modules; every sensitive action is audit-logged.

## Database changes

Migration `20261022000000_hospital_lab_diagnostic_modules` adds: `specimens`,
`facility_accession_counters`, `admissions`, `admission_notes`,
`ward_transfers`, `diagnostic_reports`, `diagnostic_report_versions`,
`diagnostic_images`, `lab_result_amendments`, `critical_result_alerts`; the
`FacilityKind` column on facility profiles (backfilled); requesting/performing
facility links on lab orders and bookings; and extended enums (lab order
workflow states, template kinds, notification types). All changes are
additive — existing rows and flows are untouched.

## Remaining / external dependencies

- **Escalation cron**: critical-alert escalation (30 min) is computed from
  timestamps; a scheduled job to mark alerts ESCALATED and re-notify can be
  added to the existing cron pattern (`/api/cron/*`) when the platform wants
  automatic escalation.
- **Imaging upload UI**: `DiagnosticImage` storage keys are persisted and the
  schema supports image attachments; the upload widget for examinations can
  reuse the existing private S3 upload flow (`/api/labs/[id]/files`) — wiring
  it into the examinations page is the remaining UI step.
- **Consent flags**: patient-level access restrictions exist via document
  sharing; a dedicated consent/consent-restriction model per investigation is
  a future increment (the access matrix already isolates organizations).
- **LabResultAmendment UI**: the amendment model and audit trail are in
  place; the lab portal amendment form for verified results is the remaining
  UI step (the workflow and API transitions are complete).
- Clinical validation of critical thresholds per test is configured by the
  laboratory at result entry; catalogue-level default bounds can be seeded
  later.
