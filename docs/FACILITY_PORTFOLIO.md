# Facility Mini-Portfolios and Facility Dashboards

Status: shipped (P0 + selected P1). This document describes the facility portfolio feature set, the staff/RBAC model, the booking workflow, split payments, and follow-up work.

## What was added

### Public facility websites (no sign-in required)

- `/hospitals`, `/laboratories`, `/diagnostic-centres` — public directories of verified facilities.
- `/hospitals/[slug]`, `/laboratories/[slug]`, `/diagnostic-centres/[slug]` — facility mini-portfolio pages with:
  - header (logo, name, type, verified badge, tagline, location, contact, hours, CTAs)
  - about (overview, mission, vision, ownership, capacity, languages, payment methods)
  - branches with branch-specific hours and phones
  - searchable service catalogue with prices, turnaround, preparation instructions, referral indicator, home-collection and urgent flags
  - departments and units with equipment and lead staff
  - consent-controlled team directory (see privacy rules below)
  - accreditations (with platform-verified badges) and patient information sections
  - SEO metadata and JSON-LD `MedicalClinic` structured data

A facility appears publicly only when **all** of these hold: `isPublished = true`, `verificationStatus = "VERIFIED"`, owner user active, and a slug is set (a slug alone never publishes). Publication is a deliberate switch in the dashboard.

### Facility portal (dashboard)

- `/lab/dashboard` — operational command centre: today's bookings, pending tasks, staff status, revenue (gross / commission / net), result queue, referral inbox, service performance (turnaround, cancellations), credential alerts.
- `/lab/staff` — staff management: invite by work email, assign role, suspend/reactivate/terminate, directory visibility and booking eligibility.
- `/lab/credentials` — credential records with expiry states and renewal tracking.
- `/lab/referrals` — referral inbox (accept / decline / fulfil).
- `/lab/me` — each staff member's own profile, with their own public-directory consent toggle.
- `/lab/bookings` — booking management with the operational workflow controls.
- `/lab/services` — service catalogue extended with preparation instructions, referral-required, home-collection and urgent flags, plus the facility profile/publication form.

### Staff accounts and RBAC

- `FacilityStaff` links a user to a facility with a facility-level role (Owner, Facility manager, Doctor, Laboratory scientist/technician/assistant, Phlebotomist, Nurse, Radiographer, Receptionist, Accountant, Compliance officer) and a status (Invited, Active, Suspended, On leave, Terminated).
- Invitations are single-use, 7-day tokens sent to a work email. The invitee redeems with their **own** Clerk account; the account's email must match the invited address exactly. The system never creates accounts or sets passwords — identity, password policy, forced first-login password change, 2FA and session expiry remain Clerk's verified flows.
- Permissions are role-based, least-privilege, and enforced server-side on every request (`src/lib/facility-staff.ts`, `src/lib/facility-auth.ts`). The global platform role is never changed by joining a facility.
- Suspension/termination takes effect immediately (membership is re-read on every request).
- The legacy owner (`LAB_SCIENTIST` role with `LabStaffProfile`) keeps working; a backfilled `OWNER` membership unifies the code path.

### Booking workflow

`FacilityBooking.workflowStage` (separate from the existing status) walks:

- Laboratory: Booked → Checked in → Sample collected → Sample received → Processing → Result entered → Verified → Approved (where required) → Released
- Diagnostic: Booked → Checked in → Procedure completed → Images uploaded → Report drafted → Reviewed → Released
- Released → Amended → Released → Archived

Transitions are validated server-side (`src/lib/facility-workflow.ts`), permission-gated per step, applied with a compare-and-set guard against concurrent updates, audited, and the patient is notified on release. A service flagged `referralRequired` cannot advance past check-in without a referral on file.

### Split payments

- `Payment` stores a commission snapshot (`commissionBps`, `commissionAmount`, `netAmount`, `settlementMode`, `subaccountCode`) computed server-side when a facility booking is paid: the facility receives the service fee minus the Medic1905 commission; Medic1905 receives only its commission.
- With a facility Paystack subaccount configured, `initialize` charges via `subaccount` with `transaction_charge` = flat commission, so the gateway splits settlement at charge time.
- Without a subaccount, `settlementMode = PLATFORM_HELD`: the platform collects and owes the facility its net — shown explicitly in the dashboard rather than claimed as a split.
- Refunds zero the commission snapshot so revenue reports never count refunded charges.
- The commission rate is platform configuration (`MEDIC_COMMISSION_BPS` env default; per-facility override set by the platform, never editable from the public profile form).

### Credentials

- `StaffCredential` records type/number/authority/dates/verification/restrictions/renewal status.
- Expiry reminders at 90/60/30/7 days and an expired notice are dispatched by `POST /api/cron/credential-reminders` (secured by the `x-cron-secret` header matching `CRON_SECRET`); the platform scheduler must call it daily. Reminder state is stored per credential, so re-runs never duplicate notifications.

### Audit and privacy

- `AuditLog` gains `facilityId`, `patientId` and `outcome` ("SUCCESS"/"FAILURE"). The migration installs a database trigger that blocks `UPDATE`/`DELETE` on `audit_logs` — the log is append-only.
- Public staff profiles require BOTH the facility's visibility switch and the staff member's own consent (`profileConsent`, revocable at any time from `/lab/me`). Contact details, private documents and credential images are never published; LinkedIn links only with an explicit opt-in.

## Key files

| Area | Files |
|---|---|
| Schema | `prisma/schema.prisma`, `prisma/migrations/20261016234824_facility_portfolio_staff_split/` |
| RBAC | `src/lib/facility-staff.ts`, `src/lib/facility-auth.ts`, `src/lib/guards.ts` |
| Workflow | `src/lib/facility-workflow.ts` |
| Invitations | `src/lib/facility-invitations.ts` |
| Public site | `src/lib/public-facilities.ts`, `src/components/public/*`, `src/app/{hospitals,laboratories,diagnostic-centres}/*` |
| Portal | `src/app/lab/*`, `src/components/lab/*` |
| Payments | `src/lib/payments/config.ts`, `src/lib/payments/provider.ts`, `src/lib/payments/service.ts` |
| API | `src/app/api/facility/*`, `src/app/api/facility-bookings/*`, `src/app/api/referrals/*`, `src/app/api/facility-invitations/redeem`, `src/app/api/cron/credential-reminders` |

## API endpoints (new or extended)

- `GET/PUT /api/facility/profile` — extended with portfolio fields, slug and publication.
- `GET/POST /api/facility/staff`, `PATCH /api/facility/staff/[id]` — staff and invitations.
- `GET/PATCH /api/facility/staff/me` — own profile and consent.
- `GET/POST /api/facility/credentials`, `PATCH/DELETE /api/facility/credentials/[id]`.
- `GET /api/facility/referrals`, `PATCH /api/facility/referrals/[id]`.
- `GET/POST /api/facility/departments`, `PATCH/DELETE /api/facility/departments/[id]` (same for branches and accreditations).
- `POST /api/facility-invitations/redeem` — invitation acceptance.
- `POST /api/referrals` — doctor sends a referral to a facility.
- `GET/PATCH /api/facility-bookings(/[id])` — extended with `?scope=facility`, workflow stages, staff assignment.
- `POST /api/cron/credential-reminders` — scheduled reminder dispatcher.

## Tests

Unit tests cover the permission matrix (least privilege per role), workflow transitions (paths, skips, reversals, per-step permissions), commission split math (rounding, platform-held fallback, refunds), credential expiry thresholds, slug validation and consent-safe public profiles. Integration tests (`flow.int.test.ts`) run against a real database when `DATABASE_URL` is set (CI).

## Follow-up work

- Paystack subaccount onboarding UI for owners (bank details + document upload; the provider call `createSubaccount` is implemented).
- Patient referral upload at booking for referral-required services (schema field exists; the upload UI for booking referrals is pending).
- Doctor-side referral form UI (API is ready).
- Report document upload/signed-URL delivery for released bookings.
- P2: multi-branch selection in the portal header, bulk service import, insurance workflow, AI report summarization with human review, quality dashboard, telemedicine integration.
- P3: emergency-capacity indicators.
