# Patient Portal — Unified Cases & Profile (Phase 6)

P0 implementation of the Medic1905 patient specification: patient profile header,
medical summary with provenance, unified care-episode cases, searchable health
timeline, and case-number surfacing across existing views.

## What changed

### Patient profile header (`/patient/case-file`)
- Initials avatar, legal + preferred name, Medic1905 ID (the existing MC- record
  number), DOB with calculated age, sex, blood group, phone, email, address,
  emergency contact, language, account status, and a profile-completion
  indicator computed from presence of self-service fields.
- Quick actions: Edit profile (`/profile`), Upload document (dashboard records
  tab), Book consultation (`/doctors`), Find diagnostic centre (`/facilities`),
  Download health summary (print-to-PDF of the case file), Manage privacy
  (dashboard records tab, where the consent-gated sharing UI already lives).
- Live status chips: upcoming appointments, pending results, unread messages,
  outstanding payments — all real queries, zero hard-coded data.
- Missing optional information is prompted with links, never forced.

### Medical summary with provenance
- Allergies (with severe-allergy alert only when recorded), chronic conditions,
  medications (clinician-issued prescriptions vs patient-reported intake,
  clearly separated), immunizations, family history, past medical & surgical
  history, lifestyle, mental health (patient-reported), primary care doctor,
  optional organ-donor status.
- "Not recorded yet" (no completed intake) is distinguished from "None
  reported" (completed intake with empty lists). Patient-reported data is
  labelled and never presented as clinician-verified; patient edits cannot touch
  clinician-authored records.

### Unified case management
- New `CareCase` / `CareCaseEvent` / `CareCaseCounter` models. Episode case
  numbers `MED1905-<TYPE>-<YEAR>-<SEQUENCE>` (C/L/D/R/H), generated server-side
  in a transaction with per-type-per-year counters and a unique constraint; the
  patient's permanent MC- number is unchanged and remains the record ID.
- Nullable `caseId` links (additive) on consultations, lab orders,
  prescriptions, payments and facility bookings.
- Statuses: OPEN, AWAITING_CONSULTATION, AWAITING_INVESTIGATION,
  AWAITING_RESULT, RESULT_AVAILABLE, UNDER_REVIEW, TREATMENT_ONGOING,
  FOLLOW_UP_REQUIRED, CLOSED, ARCHIVED — with a validated transition table,
  append-only status history and audit logging. ARCHIVED is terminal.
  Transitions are compare-and-set: two concurrent transitions cannot both
  apply (verified by an integration race test).
- Release policy: a DRAFT consultation's clinical text (chief complaint,
  diagnosis) is never copied onto the case, because the patient can see the
  case. Only finalized content is reflected there.
- Cases are created automatically when a doctor records a consultation, orders
  lab tests, or when a patient books a facility service (its payment links to
  the same case). Payments also attach to an episode through the appointment a
  consultation was recorded against — both are recorded relationships.
- Pages: `/patient/cases` (filters + pagination) and `/patient/cases/[id]`
  (linked records, payments, status history). Nav entry "My Cases" added.
- APIs: `GET /api/cases`, `GET /api/cases/[id]`, `POST /api/cases/[id]/status`
  (doctor/admin only, care-scope enforced). A case number never grants access —
  authorization is always relationship-based.

### Health timeline (`/patient/history`)
- Filters: keyword, record type, doctor, case number, date range. Expandable
  entries with source, status, case-number links. Pagination (30/page) with a
  single global chronological sort (deterministic tie-breaker) applied before
  slicing.
- Draft consultations are never shown. Note: the pre-existing patient results
  page shows lab results in any status except REJECTED (including
  AI_ANALYSIS_COMPLETE before clinician verification). That release policy
  predates this change and is flagged for clinical review — see "Open
  decisions" below.

### Case numbers across existing views
- Appointments, lab results, prescriptions and timeline entries show their
  case number, linking to the case detail page.

### Self-service profile fields
- `Patient.preferredName` and `Patient.organDonorStatus` (additive, nullable;
  null = not recorded, never rendered as "No"). Emergency contact and
  residential address are also editable by the patient through the same flow.
- `PATCH /api/me` accepts them for PATIENT users only; the existing profile form
  shows them for patients only.

## Migration
- `20261016123650_patient_portal_cases` — additive only: new tables
  `care_cases`, `care_case_events`, `care_case_counters`; new enums; nullable
  `case_id` columns with indexes on consultations, lab_orders, prescriptions,
  payments, facility_bookings; `preferred_name` / `organ_donor_status` on
  patients. No destructive statements; existing workspace raw-SQL tables
  untouched.
- Backfill: `scripts/backfill-cases.ts` (idempotent, `--dry-run` supported)
  creates cases for pre-existing consultations (linking their prescriptions
  and appointment payments), lab orders and facility bookings. Only recorded
  foreign-key relationships are used — nothing inferred.

## Verification
- `npm run lint`, `tsc --noEmit`, `vitest run` (276 passing incl. 14 new
  case-management tests), `next build` all clean.
- `scripts/smoke-cases.ts`: integration test on a disposable DB — case number
  format, increments, concurrency uniqueness (8 parallel), conflicting
  concurrent transitions (exactly one wins), transition validation, event
  history, prescription linkage. All passing.
- Visual QA in the running app was not possible in this environment (Clerk
  credentials not available); pages compile and typecheck — verify in a
  staging deployment.

## Deferred (blockers, not invented)
- PDF report generation & QR verification (no renderer configured).
- DICOM viewer (no imaging infrastructure).
- Malware scanning & auto-classification of uploads (no scanner service).
- Critical-result escalation policy (needs clinical approval).
- Family/caregiver proxy access, wearables, patient-facing AI summaries,
  emergency health card (P2).
- Case status notifications (would require a new NotificationType enum value;
  noted for the next migration).

## Open decisions requiring clinical/product approval
- Patient results page release policy (shows any non-REJECTED result,
  pre-existing behavior; the case views only count VERIFIED results as
  released) — needs a clinical decision on whether PENDING_AI_ANALYSIS and
  AI_ANALYSIS_COMPLETE results should be patient-visible.
- Backfill status derivation: a finalised consultation without a follow-up
  date maps its case to CLOSED. This is a mechanical mapping from recorded
  facts (no follow-up recorded = no outstanding action); review it against
  the clinical workflow.
- Emergency contact and address are now patient-editable via the profile —
  confirm this matches your data-governance policy.
