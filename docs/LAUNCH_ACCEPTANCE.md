# Launch acceptance register

Source: *Medic1905 MVP Features & Pre-Launch Strengthening Plan*, section 5 (pre-launch testing) and section 7 (measurable launch acceptance criteria).

The platform is not launch-ready until every **Critical** row is `PASS` with evidence. Use synthetic or de-identified data only. Update this file in the same change that closes a row.

Status values: `PASS` (evidence linked), `AUTOMATED` (covered by a test that runs in CI; still needs a manual spot check before sign-off), `OPEN` (not yet verified), `BLOCKED`.

| # | Check (PDF §5/§7) | Critical | Status | Evidence / how to verify | Owner | Date |
|---|---|---|---|---|---|---|
| 1 | Patient, doctor and facility registration, verification, login, logout, password recovery | Yes | OPEN | Manual run on staging with a real Clerk test instance; `npm run his:acceptance` covers facility flows | QA | |
| 2 | Each role sees only permitted pages, actions and records | Yes | AUTOMATED | `src/lib/authorization-matrix.int.test.ts` calls every `withAuth` route as each role, a signed-out caller and suspended, banned, removed and unfinished accounts (mutation-checked: removing the role gate fails 357 cases); `src/lib/api-route-inventory.test.ts`; `src/lib/navigation.test.ts` | QA | |
| 3 | Patients cannot read other patients' records or internal clinical documents | Yes | AUTOMATED | `src/lib/cross-tenant.int.test.ts`: another patient or an unrelated doctor is refused on patient record, document, consultation (including drafts), appointment, prescription, care case, payment and lab order; `src/lib/his/safety.int.test.ts`. `src/lib/cross-tenant-routes.int.test.ts` adds 36 more record types across about 70 id-taking routes (admissions, specimens, lab orders, diagnostic reports and images, medical media, medication orders, nursing, clinical documents and templates, payments, conversations, reminders, shares, histories, and more) | Tech lead | |
| 4 | Facility A cannot access Facility B's records, staff or documents | Yes | AUTOMATED | `src/lib/cross-tenant.int.test.ts` (staff access and privileges, patient package, encounters, facility-header spoofing); `src/lib/cross-tenant-routes.int.test.ts` (every other facility-owned record; each probe runs as an outsider of the same facility kind, and the rightful owner's identical request must succeed, so a refusal cannot come from a bad body or the wrong kind of facility); `src/lib/organization/organization.int.test.ts` (tenant guard triggers); `src/lib/his/safety.int.test.ts` | Tech lead | |
| 5 | Doctor completes and signs a consultation, requests investigations, reviews results | Yes | OPEN | Manual end-to-end on staging | Clinical reviewer | |
| 6 | Laboratory receives, processes, verifies and releases a result | Yes | OPEN | `npm run his:acceptance` plus manual run | Clinical reviewer | |
| 7 | Diagnostic centre uploads, reports and obtains approval | Yes | OPEN | Manual run including a malware-scan stub result | Clinical reviewer | |
| 8 | Documents: create, review, sign, amend, release, audit | Yes | AUTOMATED | `src/lib/his/safety.int.test.ts` (immutability, signing, amendments) | Clinical reviewer | |
| 9 | Patient portal shows only released results and documents | Yes | AUTOMATED | Release-rule tests; verify manually with a draft and a released document | QA | |
| 10 | Staff invitations, department assignment, role change, revocation | High | AUTOMATED | `src/lib/organization/organization.int.test.ts` | QA | |
| 11 | Super Admin controls, MFA, audit log, sensitive-action approval | Yes | AUTOMATED | `src/lib/superadmin/access.int.test.ts`; confirm MFA enrolment is enforced for every admin account | Tech lead | |
| 12 | Billing: trial, subscription, renewal, failed payment, cancellation | If charging | AUTOMATED | `src/lib/facility-subscriptions.int.test.ts` (trial, expiry, 402 write guard, exactly-once activation, renewal, cancellation, extension); `src/lib/payments/flow.int.test.ts`; see `docs/FACILITY_TRIAL.md`. Still needs: a confirmed facility plan and a live gateway payment on staging. Automatic card renewal and failed-payment retry are not built (manual monthly renewal) | Product | |
| 13 | All critical journeys on mobile, tablet, desktop | Yes | OPEN | Manual pass at 320, 768 and 1280 px | QA | |
| 14 | Backup restore of database **and** files succeeds | Yes | OPEN | Follow "Restore drill" below and record the run | Ops | |
| 15 | No critical build errors, broken routes, exposed secrets, unresolved vulnerabilities | Yes | OPEN | `npm run typecheck`, `npm test`, `npm audit --omit=dev`, `next build`, secret scan | Tech lead | |
| 16 | Support, incident response and recovery have named owners | Yes | OPEN | Fill the owner table below | Ops | |
| 17 | Clinical forms and workflows reviewed by qualified professionals | Yes | OPEN | `docs/LEGAL_REVIEW_CHECKLIST.md` and template catalogue review | Clinical reviewer | |
| 18 | Privacy, data-protection, medical-record regulations reviewed for the deployment country | Yes | OPEN | Written review by counsel | Legal | |

## Supporting controls now in the codebase

| Control | Where | Notes |
|---|---|---|
| Public marketing pages reachable before sign-in | `src/proxy.ts`, `src/lib/public-navigation.ts` | /about, /pricing, /contact, /help |
| Contact form and support tickets with SLA | `src/lib/support*.ts`, `/contact`, `/admin/support` | Urgent security and patient-safety reports; first-response deadlines; acknowledgement email without message content |
| Request rate limiting | `src/lib/rate-limit.ts` | Public form 5 per 10 min per address; uploads, downloads, search, payments per user |
| Error and cron-failure reporting | `src/lib/monitoring.ts`, `src/instrumentation.ts` | Only failure kind and route; optional `ALERT_WEBHOOK_URL` |
| Health probe | `GET /api/health` | Point an external uptime monitor at it |
| Content-Security-Policy | `src/lib/csp.ts`, `CSP_MODE` | Starts in report-only; switch to `enforce` after reviewing the browser console on staging |
| Facility row-level security | `src/lib/rls*.ts`, `src/lib/db-pool.ts`, migration `20261113120000_facility_row_level_security` | Database refuses cross-facility access on 20 clinical tables; off until `FACILITY_RLS_CONTEXT=on` and a restricted DB role (`docs/ROW_LEVEL_SECURITY.md`) |
| Facility free trial and plans | `src/lib/facility-subscriptions.ts`, `/lab/subscription`, `/api/admin/facility-*` | 30-day trial at verification, notices, 7-day grace, then read-only for new records with safety work and export always allowed; `docs/FACILITY_TRIAL.md` |
| Route protection inventory | `src/lib/api-route-inventory.test.ts` | Fails CI if a new API route is not wrapped in `withAuth` or reviewed |

## Restore drill (acceptance row 14)

1. Take a database backup (Neon branch or `scripts/backup-organization.sh`) and note its reference.
2. Take or confirm an S3 object backup (bucket versioning plus a copy in a second bucket).
3. Restore both into a **staging** environment.
4. Sign in as a test patient and doctor; open an existing signed document and a diagnostic file; confirm checksums and PDF rendering.
5. Record date, backup references, who ran it, time taken (this is the measured RTO) and data age (RPO).

## Owners (acceptance row 16)

| Responsibility | Named owner | Backup |
|---|---|---|
| Support inbox (`/admin/support`) and first response within SLA | | |
| Security incidents (`/super-admin/security`) | | |
| Patient-safety reports (ticket type CLINICAL_SAFETY) | | |
| Backup and restore | | |
| On-call for alerts from `ALERT_WEBHOOK_URL` | | |

## Design notes found while testing

- **Unassigned lab orders can be claimed by any laboratory.** `PATCH /api/facility/lab-orders/[id]` lets any laboratory act on an order whose performing lab is empty ("legacy" orders) and assigns it to the first lab that does. Assigned orders are protected. If new orders are always created with a lab, consider removing this path once legacy data is gone.
- **Row-level security and diagnostic reports.** Hospitals read reports sent to them by another facility, so that table has a wider policy. Watch specimens, inter-facility admission transfers and shared clinical documents when you first enable it on staging.

## Open engineering items (not closed by this change)

- Cross-tenant coverage is table-driven: add a row to `cross-tenant-routes.int.test.ts` for any new id-taking route. Not covered: public profile reads (public by design), admin-only routes (covered by the role matrix), and a few multi-party routes such as doctor portfolio and service editing. Writes that call object storage or a payment gateway are checked up to that dependency (marked `ownerMayFail`, each with its reason).
- Switch row-level security on: create the restricted database role, run staging with `FACILITY_RLS_CONTEXT=on`, fix any legitimate cross-facility read it flags (`docs/ROW_LEVEL_SECURITY.md`). Server-rendered pages do not carry the context yet.
- Automatic card renewal and failed-payment retry for facility plans (renewal is manual each month today), plan-based module entitlements, and invoices with tax lines.
- SMS channel and a per-facility critical-result escalation chain.
- Controlled duplicate-patient merge; patient data export.
- Hard MFA check on every admin route, not only master control.
- Backups: scheduled database dumps, S3 versioning and replication.
