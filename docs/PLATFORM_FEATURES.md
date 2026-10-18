# Platform features

End-to-end implementation notes for the platform enhancement: facility mini-websites, structured prescriptions, patient documents, medication reminders, inactivity-based welfare monitoring, the emergency learning centre and the collapsible sidebar. Every feature below includes backend logic, database migrations, validation, notifications and responsive UI — no visual-only mockups.

## Database and migrations

One new migration ships with this release: `prisma/migrations/20261018090000_platform_features/`. It adds eleven models:

| Model | Purpose |
|---|---|
| `FacilityWebsite` | Draft/published block JSON for a facility mini-website (one per facility, versioned) |
| `MedicationReference` | Local copy of the medication reference list (drug name, class, antibiotic class, spectrum tags, RxCUI) |
| `Prescription` / `PrescriptionItem` | Structured prescriptions with per-item clinical fields and safety-review snapshots |
| `PatientDocument` / `DocumentShare` | Patient medical documents in private object storage; per-recipient revocable shares |
| `MedicationReminder` / `DoseEvent` | Prescription-linked reminders and materialised dose events with explicit status transitions |
| `InactivityRule` / `WelfareAlert` / `WelfareAlertDelivery` / `TrustedContact` | Consent-gated inactivity monitoring and third-party welfare alerts |

Deploy with `npm run db:deploy` (which runs `prisma migrate deploy`), then `npm run db:seed:medications` (idempotent) to load the medication reference list. No other env vars are required beyond the existing `.env.example` set: the interaction-checking service (RxNav, see below) is free and needs no key; the two new cron routes reuse `CRON_SECRET`.

## 1. Customisable mini-websites

Facilities (hospitals, diagnostic centres, laboratories) build a one-page public website at `/hospitals/[slug]` and `/laboratories/[slug]` with a drag-and-drop block builder (`src/components/website/builder.tsx`, staff-only at `/lab/website`). Blocks: hero, about, services, doctors, hours, contact, FAQ, gallery. Drafts save without publishing (`PUT /api/facility/website`); publish flips the live view. Block payloads are validated with zod per block type (`src/lib/website/blocks.ts`) on both save and render, and the public renderer (`src/components/public/facility-website-renderer.tsx`) never trusts saved JSON. Facility staff with website permissions manage content; the backend enforces staff role and permission, not just hidden buttons.

## 2. Structured prescriptions and clinical safety

Doctors prescribe at `/doctor/prescriptions` with structured items: medication (matched against the local `MedicationReference` list), drug class, antibiotic class, antimicrobial spectrum tags, dose/route/frequency/schedule, duration, refills, food and missed-dose instructions, precautions and monitoring notes. Key rules:

- **No invented clinical data.** Class and spectrum come from the local reference list, seeded by an operator, and interactions are checked against [RxNav](https://rxnav.nlm.nih.gov/REST/) (RxNorm APIs from the U.S. National Library of Medicine — free, no API key, no signup). When interaction or antimicrobial information is unavailable, the UI says so explicitly rather than guessing.
- **Class ≠ coverage.** Antibiotic class and bacterial coverage are separate fields. A drug's class never implies Gram-positive/Gram-negative coverage; coverage tags are recorded per drug.
- **Safety checks are advisory.** `src/lib/prescriptions/safety.ts` runs server-side on every create: allergy match, duplicate therapy, RxNav interactions (allergy, duplicate-therapy and drug-drug interaction sources), renal/geriatric/pregnancy considerations. High-severity alerts must be acknowledged before issuance; the server re-runs the checks regardless of what the client computed. Alerts assist clinicians and never replace professional judgment — the UI states this.
- Patients see the same structured data at `/patient/prescriptions` with a print view.

## 3. Patient documents

Patients upload and manage their medical records at `/patient/records` (PDF and standard images, ≤ 20 MB, magic-byte sniffed via `looksLikeDeclaredType`). Files live under a private `patient-documents/` prefix and are served only through short-lived presigned URLs issued after an access check. Doctors can attach documents for assigned patients (`/doctor/records`) and share a document read-only with another clinician (revocable, audited). Access control (`findAccessibleDocument`): patients see only their own documents; doctors see documents of patients assigned to them or explicitly shared documents; out-of-scope requests return 404, never 403 — no existence leaks. Private reports are never exposed through public URLs, and every access is written to the audit log.

## 4. Medication reminders

Reminders are created automatically when a prescription with a dosing schedule is issued (`ensureReminderForPrescriptionItem`, idempotent per item) and can be managed at `/patient/reminders`. Dose events are materialised per reminder + scheduled instant (idempotent under overlapping cron runs). Status transitions are explicit: `SCHEDULED → ACKNOWLEDGED` (patient saw the nudge) `→ TAKEN / SKIPPED` (recorded by patient or clinician) or `MISSED` (scheduler, only after the 2-hour grace window has fully passed). **Opening a notification never marks a dose taken.** Reminder notifications contain no clinical details — just a gentle nudge linking into the app. Adherence summaries feed the patient dashboard.

## 5. Inactivity monitoring and welfare alerts

Patients opt in at `/patient/safety` by naming trusted contacts and explicitly consenting to third-party alerts (consent timestamp and text stored on the `InactivityRule`). The scheduler (`GET /api/cron/inactivity-checks`, `Authorization: Bearer $CRON_SECRET`, every 15–30 minutes) checks `user.lastActiveAt` (tracked on authenticated requests in `lib/auth.ts`) against the rule. After 48 hours without a check-in it alerts the trusted contacts and the care team, escalating after a further 6 hours if no one acknowledges. Critical limitations, enforced in the UI wording and alert text:

- **Lack of website activity does not prove a patient missed medication, is unconscious, or is unwell.** Inactivity alerts are kept completely separate from medication-adherence alerts (different notification kinds, different pages, different wording).
- The alert says: "This patient has not checked in on the platform within the last 48 hours. Please follow the agreed welfare-check procedure."
- The feature is **not** an emergency-response service and is never presented as one.

## 6. Emergency life-support and CPR learning centre

Public (no sign-in) at `/emergency`: sixteen modules covering adult CPR, AED use, choking (adult/child), recovery position, bleeding control, and awareness-level BLS/ALS tracks, with search, quizzes and per-user progress stored locally. Content is aligned to the [AHA 2025 Guidelines for CPR and ECC](https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines) and the [ERC Guidelines 2025](https://www.erc.edu/guidelines), and each page states the guideline source and last review date. Every page repeats that the centre is educational and that bystanders must call local emergency services first.

## 7. Collapsible sidebar and UI

The desktop sidebar collapses to an icon rail with tooltips (`src/components/layout/navbar.tsx`); the preference persists in `localStorage` under `medic1905.sidebar.collapsed`. The layout is responsive down to mobile, where the sidebar becomes the existing drawer. All new pages follow the existing shadcn/ui conventions and the clinic's design tokens.

## Security, privacy and compliance notes

- Permissions are enforced on the backend: every route is wrapped in `withAuth(roles, ...)`, facility website writes check staff permissions, and document/record access goes through the central access policy — hiding buttons is never the only barrier.
- Notifications (email, SMS, push) never carry diagnoses, prescriptions or other health details; they link back into the signed-in app.
- Welfare alerts require explicit, recorded patient consent before any third party is contacted.
- Health-data handling follows the existing GDPR-aligned practices in [docs/DATA_HANDLING.md](docs/DATA_HANDLING.md): role-based access, audit logging of reads and writes, private object storage with signed URLs, and data minimisation in notifications.

## Testing

Unit tests cover the website block validation (`src/lib/website/blocks.test.ts`), welfare monitoring (`src/lib/welfare.test.ts`), prescription validation schemas (`src/lib/prescriptions/validation.test.ts`), document access control and type sniffing (`src/lib/documents.test.ts`), and medication reminder status rules including "acknowledged is not taken" (`src/lib/medication-reminders.test.ts`). CI runs `prisma validate`, lint, typecheck, tests and the production build.
