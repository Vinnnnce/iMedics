# Medic1905 doctor profile and portfolio — phase handoff

Enhancement of the existing Medic1905 platform per the Medic1905 doctor specification. This is an
additive change: no routes were removed, no data modelled concept was replaced, and the doctor-level
pricing and booking flows keep working exactly as before when a doctor has no service catalogue.

## What changed

### Doctor profile (public, auth-gated as before)

- Hero: photo (when the account has one), name, professional title, qualifications, specialty and
  sub-specialty, affiliation and location, years of experience, languages, consultation modes,
  verification badge, rating with count, starting fee (cheapest active service, else the standard
  consultation fee), and the real next available slot computed from published availability
  (clinic time, all windows per day considered, taken slots skipped).
- Actions: Book (existing booking panel, now with service selection), Save doctor (existing like,
  now with toast feedback), Share profile (clipboard + toast), LinkedIn link (only when the doctor
  published it with recorded consent), Download CV (short-lived signed link when a CV is attached).
- About: biography with read-more, patient-care philosophy, consultation approach, plain-language
  "when to book" guidance, chips for conditions, procedures, clinical interests and languages.
- Credentials and verification: licensing authority, licence expiry (with expired/valid state),
  professional memberships, hospital affiliations, awards, and separate identity / licence /
  qualification verification statuses with the dates they were checked, and the licence number when the doctor opted into
  public display. An expired licence is never shown as verified.
- Services and pricing: active services with kind, duration, modes, price, follow-up price and
  eligibility window, ICD-10 code chips, cancellation/refund terms, includes and add-ons.
- Portfolio: published items grouped with a type filter; case studies only appear with recorded
  GRANTED consent; attachments download through a permission-checked endpoint.
- Reviews: category averages (communication, professionalism, punctuality, explanation), sorting
  (recent/highest/lowest), moderation status respected, and the doctor's public replies.
- FAQ: accordion (existing Collapsible component) covering booking, follow-ups, uploads, duration,
  prescriptions, cancellation, confidentiality, referrals, languages and joining a video visit,
  describing the platform's actual implemented behaviour.

### Booking

- `POST /api/appointments` accepts an optional `serviceId`. All booking decisions — the doctor's
  bookability and accepted modes, the service (ownership, active state, supported modes, currency
  still matching the doctor's account), the slot fit, the follow-up eligibility and the price —
  are (re)taken inside the Serializable booking transaction, so a stale client cannot book an
  unavailable slot, service or price. A service visit lasts the service's duration and the whole
  visit must fit inside the doctor's published window.
- Follow-ups must reference the same doctor's own COMPLETED appointment.
- Rescheduling keeps the duration the appointment was booked with (service bookings included).
- The availability endpoint accepts the same `serviceId` and only offers slots the whole service
  visit fits into.
- The doctor's `consultationModes` (when set) restrict which modes may be booked.
- The booking panel re-fetches a fresh payment whenever the slot, service or mode changes, so a
  pending payment is never reused for different booking details.

### Doctor management (existing dashboard, new screens)

- `/doctor/profile` — professional profile fields, CV upload, LinkedIn URL + consent-controlled
  publishing, optional public display of the licence number. The save is a partial update
  (omitted fields keep their value). Changing qualifications or licensing details sends the
  related verification dimension back to PENDING for an administrator to re-check.
- `/doctor/services` — service catalogue with create, edit, activate/deactivate and remove; ICD-10
  codes are picked with a searchable picker and validated against the platform's code set;
  services referenced by appointments are deactivated, never deleted.
- `/doctor/portfolio` — portfolio items with create, edit, publish/unpublish and remove; case
  studies cannot be published without recorded consent.
- Doctor dashboard now shows the doctor's reviews with a public reply form.

### Admin (existing dashboard, new tabs)

- Verification tab: per-doctor identity / licence / qualification decisions, timestamps recorded
  server-side, doctor notified, everything audited. Evidence documents remain admin-only.
- Review moderation tab: approve/hide reviews; hidden reviews are excluded from averages. Doctors
  cannot moderate or delete reviews of themselves.

## Models and migration

Single additive migration `20261016120000_doctor_profile_portfolio`:

- `DoctorProfile`: ~20 new optional columns (title, qualifications, about text, chips arrays,
  consultation modes, LinkedIn + consent, CV file, licensing, per-dimension verification,
  memberships/awards/affiliations). All default empty/null; existing rows unchanged.
- New `DoctorService`, `DoctorPortfolioItem`, `DoctorFile` tables.
- `DoctorReview`: nullable category ratings, `moderationStatus` (default APPROVED so existing
  reviews stay visible), doctor response fields. Averages are recomputed from APPROVED reviews
  inside the same (Serializable) transaction as a moderation decision.
- `Appointment.serviceId` + `serviceName` snapshot.
- The migration SQL was generated with `prisma migrate diff` (old schema → new schema). Apply with
  the project's normal `prisma migrate deploy` flow; no data is rewritten or deleted.

## Files changed

- Routes added: `api/doctors/me/profile`, `api/doctors/me/services[...]`, `api/doctors/me/portfolio[...]`,
  `api/doctors/me/files[/confirm]`, `api/doctors/[id]/services|portfolio|cv`, `api/doctor-files/[id]`,
  `api/doctor-reviews/[id]/respond`, `api/admin/verification`, `api/admin/reviews`,
  `api/admin/doctors/verification`.
- Routes modified: `api/appointments` (+serviceId, mode and follow-up validation),
  `api/appointments/[id]/reschedule` (service duration), `api/doctors/[id]/pricing` (serviceId),
  `api/doctors/[id]/reviews` (category ratings, APPROVED aggregates, doctor notification).
- Libs: `lib/doctor-profile.ts` (new), `lib/availability.ts` (new), `lib/pricing.ts`,
  `lib/booking.ts`, `lib/data/doctors.ts`, `lib/notifications/events.ts`, `lib/navigation.ts`.
- Pages/components: `doctors/[id]` profile page, `doctor/{profile,services,portfolio}` (new),
  `doctor/dashboard`, `admin/dashboard`, `components/doctor/*`, `components/shared/booking-panel`,
  `components/shared/doctor-feedback`, `components/shared/doctor-profile-extras` (new),
  `components/dashboard/{verification,review-moderation}` (new).

## Configuration

No new environment variables. File uploads reuse the existing S3-compatible storage configuration;
CV/portfolio uploads and downloads fail cleanly until that is configured. Email/push notifications
reuse the existing providers and their health flags; the new events render as in-app
notifications regardless.

## Verification limits

- The migration SQL is generated by `prisma migrate diff` from the committed schema change, but it
  has not been executed against a live database in this environment (no database credentials);
  apply it through the project's normal `prisma migrate deploy` flow and the standard post-deploy
  smoke checks.
- All automated checks run green here: `tsc --noEmit`, `eslint --max-warnings 0`, the vitest suite
  (262 passed, 18 pre-existing skips) and `next build`.

## Tests

- `src/lib/doctor-profile.test.ts` — portfolio consent/visibility rules, profile and service
  schemas, serializers.
- `src/app/api/doctors/me/services/route.test.ts` — currency and ICD-10 validation, ownership, auth.
- `src/app/api/admin/verification/route.test.ts` — per-dimension decisions, notification, audit.
- `src/app/api/doctor-reviews/[id]/respond/route.test.ts` — doctor-own replies only.
- Full suite: 261 passed, 18 skipped (pre-existing skips), 0 failed. `tsc --noEmit` and
  `eslint --max-warnings 0` clean. `next build` succeeds.

## Deliberately deferred (per the specification's priorities)

- P1/P2/P3 items (pre-visit forms, smart follow-ups, multilingual profiles, doctor matching,
  analytics, referrals, insurance) are not implemented in this phase.
- LinkedIn: an external styled link only — no scraping, no embedding, no content import; consent
  is recorded server-side when the doctor enables it.
- The profile pages remain behind authentication (existing platform behaviour), so no public SEO
  metadata or structured data was added; nothing was fabricated to satisfy the SEO section.
- AI assistance remains gated behind the existing `aiToolsEnabled` entitlement; no new AI
  integration was added.
