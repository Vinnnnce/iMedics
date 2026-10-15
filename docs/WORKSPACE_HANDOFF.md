# iMedics additive care workspace

This change introduces a new `/workspace` portal for patients, doctors, facilities and administrators. All files present at base commit `97b4621bd0d662300fb3374c57e6694d8bf28107` are preserved; the homepage, legacy dashboards, dependency manifests, lockfile, authentication implementation and Prisma schema are not edited.

This is an implementation handoff, not a claim that all five phases or the healthcare production acceptance criteria are complete. The separate preview uses synthetic records and cannot authenticate users or perform live clinical, financial or messaging actions.

## Delivery structure

- **Authenticated portal:** `src/app/workspace/`, using the existing Clerk identity and database-role guards.
- **Shared UI:** `src/components/workspace/`, including cards, chips, tables, search/filter controls, canvas charts with accessible data tables, native modal dialogs, toasts, empty states, responsive navigation and light/dark themes.
- **Role-scoped aggregation:** `src/lib/workspace/data.ts`. Admin aggregation intentionally excludes patient histories, laboratory values and message bodies.
- **Extension endpoints:** `src/app/api/workspace/` for tasks, intake, documents and consent, wearables, disputes, resource assignments, subscriptions, follow-ups, experiments and audit exports.
- **Extension storage:** `prisma/migrations/20261015220000_workspace_extensions/migration.sql`. Twelve new tables; no destructive SQL against existing tables.
- **Notification worker:** `src/app/api/cron/workspace/` and `src/lib/workspace/notifications.ts`, with an event-deduplicated outbox, delivery leases and bounded retries.
- **Synthetic preview:** `workspace-preview/entry.tsx`, importing the same UI but a separate fixture module. Fixture data is not imported by the authenticated server path.
- **Tests:** `src/lib/workspace/*.test.ts`; browser coverage inventory in `docs/WORKSPACE_QA.md`.

## Phase coverage

| Requirement | Implementation status | Remaining integration or limitation |
|---|---|---|
| Role authentication and navigation | Reuses server-side Clerk/database authorization; role-specific portal navigation added | Existing login redirects and menus remain unchanged; visit `/workspace` explicitly |
| Shared UI foundations | Implemented | Further assistive-technology and device testing remains appropriate |
| Core appointment, patient/case, conversation, payment and result models | Reused from existing Prisma schema | No duplicate clinical models created |
| Notification centre and toast system | Implemented; polling pauses when page is hidden or offline | Poll interval is 60 seconds, not a real-time socket |
| Email and push | Existing providers/templates reused; generic account-update content; scoped push worker and durable extension outbox added | Operator must configure transports, browser permission and scheduler; end-to-end delivery not verified |
| Patient overview, appointments, results, messages, payments and tasks | Role-scoped widgets and tables implemented | Existing appointment, message, checkout and clinical detail workflows open in the original app |
| Health timeline and case search | Implemented over authorized loaded data | Snapshot limits apply; not an unrestricted global case-number lookup |
| Result tracking and critical alerts | Status widgets and critical flags added; patients see numeric trends only for verified results | Bounded background collector scans up to 100 critical results created in the last seven days; this is not a complete clinical escalation system |
| Documents and record sharing | Patient uploads, MIME/signature/size verification, immutable final object keys, per-document explicit consent, expiry and revocation | Requires private S3-compatible storage, encryption-at-rest policy, CORS and retention controls; malware scanning is not added |
| Mobile-first responsive portal | Implemented with 375px and desktop QA, reduced-motion support, conditional chart rendering and native font fallback | Independent low-bandwidth and older-device field testing remains |
| Doctor next-patient, schedule, alerts and task queue | Implemented using doctor/patient assignment scopes | Checklist completion does not itself issue prescriptions or referrals; those remain in existing clinical workflows |
| ICD-10 diagnosis workflow | Reuses the existing coded consultation workflow | Portal template export is a draft, not a signed consultation or prescription |
| Earnings, subscription and availability | Added gross-collected totals by currency, published-window count and subscription record widgets | Subscription table is an operational ledger; no recurring payment gateway integration is added |
| Consultation templates and follow-ups | SOAP and follow-up templates; authorized follow-up reminder storage and cron processing added | Clinician must approve clinical content; reminders require scheduler deployment |
| Facility booking, results, services and revenue | Facility-owned booking/service queries, own-upload result queue, revenue totals and turnaround summaries added | Legacy results have no facility ownership field; queue deliberately shows only the calling uploader's results |
| Staff, rooms and workload | Resource creation, capacity-aware assignment with transaction/row locks, assignment counts and booked-hour summaries | Workload is based on explicitly assigned intervals, not payroll or time-attendance data |
| Admin verification, payments, refunds, disputes and subscriptions | Operational screens and extension endpoints added; provider verification links reuse legacy screens; refund request reuses payment service | No real refunds were submitted; production authorization and gateway reconciliation must be tested |
| Audit export and platform reporting | Admin-only CSV with formula protection and PHI-minimized columns; aggregate experiment and delivery-health endpoints | Reporting is bounded; no external SIEM, full observability stack or compliance certification |
| Result trends and care gaps | Verified, same-unit result grouping and charts; intake, historical follow-up and result-review reminders | Follow-up reminder rule cannot infer clinical resolution; clinician review is required |
| AI patient summaries and consultation documentation | Links to existing verified-doctor AI tools; documentation templates and intake added | No new patient-wide AI summarizer, AI documentation model pipeline or external processing consent system is implemented |
| No-show prediction and schedule optimization | Transparent reminder-priority heuristic and same-day appointment-gap suggestions | Not a trained or validated predictive model; no automatic overbooking, cancellation or access denial |
| Wearable integration and personal insights | Consent-based JSON import, bounded metric validation, private readings and display | No Apple Health, Health Connect, Fitbit or other vendor OAuth/live sync is implemented; no diagnostic interpretation |
| A/B testing | Deterministic A/B assignment and authenticated event/report endpoints added | Existing homepage and dashboard variants are not instrumented or activated; no experiment is running |

## Staging setup

Use Node.js 22.12 or newer, as required by the original repository.

```sh
npm ci
npm run build
npm run typecheck
npm test
```

Configure existing `.env.example` variables in the deployment platform rather than committing credentials:

- **Identity/database:** Clerk keys, `DATABASE_URL`, `DIRECT_URL`, and an appropriately bootstrapped administrator.
- **Storage:** Private S3-compatible bucket, least-privilege credentials, TLS, default encryption at rest, and PUT CORS for the authenticated app origin.
- **Notifications:** Resend sender configuration, application URL, VAPID keys/subject, and `CRON_SECRET`.
- **Clinical AI/payment services:** Existing provider credentials and policies, only when those original workflows are enabled.

Review the new SQL migration and take a staging backup before applying it with the existing `npm run db:deploy`. Do not apply this change to production without reviewing data retention, access, encryption, incident response, and clinical escalation requirements.

The existing `schema.prisma` intentionally does not declare the extension tables, because changing existing files was prohibited. Extension access uses parameterized SQL. A later `prisma migrate dev` may propose dropping these unmodeled tables; do not accept that diff. Obtain approval to declare the extension models in the Prisma schema before routine schema evolution resumes.

Schedule `GET /api/cron/workspace` with `Authorization: Bearer <CRON_SECRET>` on the deployment platform. A five-minute interval is a suggested staging starting point, not a clinical notification SLA. The worker deduplicates event creation and has five attempts for failing transports, but provider timeouts can still produce duplicate external deliveries. Jobs without configured transports or an enrolled push browser remain queued and do not consume the retry budget; inspect `workspace_delivery` and the admin operations response for failures.

For higher-volume or regulated use, replace the bounded critical-result scan with transactional event capture and monitored escalation. This change does not prove that every critical event reaches every channel, and it must not be the only emergency communication mechanism.

### Standalone preview

```sh
node scripts/build-workspace-preview.mjs
```

Serve `workspace-preview/dist` with any static HTTP server. The preview reuses React and build tools already present in the lockfile. Its role picker exists only in the synthetic entry point; client-selected roles are never accepted by the authenticated data endpoints.

Uploaded preview files are represented by name, MIME type and size only. Preview task/consent/intake state is temporary and is discarded on reload or role change. A preview success message is not evidence of a live upload, signed clinical record, payment, message, notification delivery, or completed account verification.

## Verification performed

- **Production compilation:** Next.js 16.3.5 webpack build completed using Node 22.23.3 and build-only placeholder service configuration. This validates compilation and static generation, not live authentication or provider access.
- **TypeScript:** `npm run typecheck` passed.
- **Lint:** Targeted ESLint checks of all new application code passed.
- **Unit/security tests:** 81 tests passed, including 21 new workspace tests; 18 pre-existing payment integration tests were skipped because their external/database prerequisites were not configured.
- **SQL:** The full existing migration chain plus the additive migration applied in a local PostgreSQL-compatible PGlite test engine; task ownership queries, resource capacity checks, wearable inserts, leased outbox claims and advisory-lock syntax were exercised.
- **Browser:** Synthetic preview exercised across all four roles, desktop and 375px layouts, both themes, task add/complete/reopen, notifications, intake, upload/share/revoke, case/status filtering, chart switching and modal Escape behavior.
- **Accessibility:** Final axe WCAG A/AA overview checks reported no violations for all four roles and the patient dark theme; the native dialog's explicit keyboard focus loop passed repeated Tab testing. This is not a comprehensive accessibility certification.
- **Dependencies:** The unchanged lockfile's audit reported 17 vulnerabilities: 3 critical, 12 high and 2 moderate. Direct packages named in critical advisories include Next.js and Vitest; upgrading them requires permission to edit existing manifests/lockfiles and must precede production rollout.

No live database migration, payment/refund, email, push delivery, patient data upload, external AI request or production deployment was performed. No GitHub push is complete until the repository owner reconnects GitHub and write access is verified.

## Next approval

Reconnect GitHub to push the prepared additive branch. Preserve `main` and review the feature branch before merging; separately approve any existing-file changes needed for homepage links, login redirects, Prisma model declarations, dependency upgrades and active experiment instrumentation.
