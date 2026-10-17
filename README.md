# Medic1905

Telemedicine and medical-records web app for patients, doctors and laboratory staff.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma 7 · Neon Postgres · Clerk · S3-compatible storage (Cloudflare R2 / AWS S3) · Kimi K3 (doctor-side AI assistance) · Vitest · Vercel.

> Scope: web only. A mobile app is planned for a later release.

## Roles

| Role | Can do |
|---|---|
| `PATIENT` | Own record, results, prescriptions and notes shared with them; book appointments; chat with their doctors; rate doctors. No AI features. |
| `DOCTOR` | Manage the patients in their care; consultations; lab requests; clinical notes; review AI summaries; publish availability. |
| `LAB_SCIENTIST` | Work the lab-order queue; enter results and attach files; identify patients by case number. |
| `ADMIN` | Verify professionals, moderate accounts, publish notices and ads. No access to patient records. |

Everyone registers as a patient. Doctors and lab staff stay `PENDING` until an admin verifies them and grants the role.

## First-time setup

Requires **Node 22.12 or newer**.

```bash
# 1. Install (also regenerates package-lock.json and the Prisma client)
npm install

# 2. Configure
cp .env.example .env        # fill in Clerk, Neon, S3/R2, Kimi and ADMIN_EMAILS

# 3. Create the database schema (applies every migration in prisma/migrations)
npm run db:deploy            # or `npx prisma migrate reset` to wipe and rebuild a test database

# 4. Seed reference data: lab-test catalogue and the ICD-10 code list (idempotent)
npm run db:seed

# 5. Verify
npm run typecheck && npm run lint && npm test && npm run build

# 6. Run
npm run dev
```

Sign up with an email listed in `ADMIN_EMAILS` (and verify it in Clerk) to become the first admin.

### Services you need

- **Clerk**: authentication. Create an application and copy the keys.
- **Neon**: Postgres. `DATABASE_URL` is the pooled string, `DIRECT_URL` the direct one (used for migrations).
- **S3-compatible bucket** (private): lab files and verification documents. Add a lifecycle rule that deletes objects under `lab-results/` and `verification/` that are never confirmed (abandoned uploads).
- **Kimi API key**: optional. Without it, lab flagging still works; only the AI summary is skipped.

### Deploying to Vercel

Set every variable from `.env.example`, and run `npm run db:deploy` against production before the first deploy and after each schema change.

Also add a scheduled job that calls `GET /api/cron/appointment-reminders` every 15 minutes with `Authorization: Bearer $CRON_SECRET` (Vercel Cron does this when `CRON_SECRET` is set; note Vercel's free plan limits cron frequency). It sends appointment reminders, releases slots held by unpaid bookings and retries refunds the gateway has not accepted. In the Paystack dashboard, set the webhook URL to `<your-domain>/api/payments/webhook/paystack`.

## Clinical coding, pricing, payments and notifications

- **ICD-10 diagnoses.** Doctors search by code or name (`I10`, `hypertension`) and pick several; one is primary. Codes come from the imported release recorded in `code_system_releases` (default: WHO ICD-10, 2019). Diagnoses store a snapshot of the code and wording, so updating the list never rewrites past records. See [docs/ICD10.md](docs/ICD10.md).
- **Fees.** Doctors set a standard and a reduced follow-up fee at `/doctor/fees`; laboratories, diagnostic centres and hospitals publish priced services at `/lab/services`. Patients see the price before booking, and the server recomputes it when booking.
- **Payments.** Paystack (cards, bank transfer, USSD, mobile money) behind a provider interface. Bookings hold their slot for 30 minutes while unpaid; doctors and facilities see a booking only once it is paid. Receipts live at `/payments`. See [docs/PAYMENTS_AND_NOTIFICATIONS.md](docs/PAYMENTS_AND_NOTIFICATIONS.md).
- **Notifications.** In-app (bell + pop-ups), email (Resend) and web push, with per-category preferences on the profile page. Messages never contain health details; they link back into the signed-in app.

- **Admin console.** `/admin`: overview, a verification workspace showing everything an applicant submitted (details, documents, duplicate and plausibility checks, checklist, approve or reject with reasons), user directory and account controls, payments with refunds, audit log, and notices/ads. See [docs/ADMIN.md](docs/ADMIN.md).

## Scripts

`dev` · `build` · `start` · `lint` · `typecheck` · `test` · `test:watch` · `db:migrate` · `db:deploy` · `db:seed` · `db:studio` · `icd10:import`

## How access control works

- **Roles live in our database**, never in client-writable Clerk metadata (`lib/auth.ts`).
- **Every API route** is wrapped in `withAuth(roles, handler)` (`lib/api.ts`); the middleware also blocks unauthenticated API calls. Server layouts guard each portal (`lib/guards.ts`).
- **One clinical access policy** (`lib/access.ts`): doctors reach only patients they are assigned to (assignment is created when they accept a booking or add the patient); patients reach only their own record; out-of-scope records return 404.
- **Audit log**: reads and writes of patient data are recorded (`lib/audit.ts`).
- **Files** are private; access is by short-lived signed URLs after a permission check, and uploads are verified by content, not just declared type.

## AI safety

AI output is assistive only: no diagnosis, no prescriptions, no emergency instructions. Pipeline (`lib/ai/`): rate limit → deterministic rule engine (always runs) → input check → model → schema validation → safety filter → stored as `PENDING_REVIEW`. **Nothing is shown to a patient until a doctor approves it** (`POST /api/ai-analyses/[id]/review`). Only age, sex and lab values are sent to the model.

## Project layout

```
prisma/schema.prisma   Single source of truth for the database
prisma/seed.ts         Reference data (lab-test catalogue)
src/app/               Pages and app/api route handlers
src/components/        UI (shadcn/ui), shared and per-role client components
src/lib/               auth, access policy, API helpers, AI pipeline, storage, data queries
docs/                  Specification, screen flows, data-handling notes
```

## Known gaps

- **Video consultations** are not implemented (chat and in-person only). The schema reserves `VIDEO`.
- **Notification preferences** and email/SMS delivery are not implemented; notifications are in-app only.
- **Inpatient bed/ward management** is out of scope; "care roster" means which doctors look after which patients.
- The `/patients/*` doctor pages and `/ai-assistant` are client-rendered (older code) and could be converted to server components.
- No Content-Security-Policy header yet (it needs tuning for Clerk).
- Data-retention periods are not defined; see `docs/DATA_HANDLING.md`.
