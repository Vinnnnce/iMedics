# Phase 1 foundations

This phase extends the existing Next.js App Router, TypeScript, Tailwind, Clerk, and Prisma/Postgres implementation. The Medic1905 branding, themes, typography configuration, sidebar, header, bottom navigation, and dashboard routes are retained. This is an engineering handoff, not a certification of healthcare compliance or a claim that unconfigured external services have been tested.

## Approved scope

- Target branch: `main`.
- Reuse the existing schema, providers, and migration files.
- No new database migrations, dependencies, environment variables, credentials, or deployment configuration.
- No production database operations or live patient data.
- Historical Phase 1 gate: stop after Phase 1. The user subsequently authorized implementing Phases 2–5 without further phase approvals; see `docs/PHASES_2_TO_5_HANDOFF.md`.

## Authentication and access

`src/lib/roles.ts` centralizes role labels, dashboard destinations, account readiness, soft-delete handling, and blocked-account checks. The existing persisted `LAB_SCIENTIST` role is the backward-compatible Facility portal role; it is not a newly introduced `FACILITY` enum.

| Role | Existing dashboard | Access prerequisite |
| --- | --- | --- |
| Patient | `/dashboard` | Active account, completed registration |
| Doctor | `/doctor/dashboard` | Active account, completed registration, verified professional access where enforced by existing clinical policies |
| Facility (`LAB_SCIENTIST`) | `/lab/dashboard` | Active account, completed registration, existing facility/profile scope |
| Admin | `/admin/dashboard` | Server-granted Admin role and active completed account |

Page guards reject soft-deleted, banned, and suspended accounts before considering onboarding. Mismatched roles return to their own dashboard rather than entering another portal. The profile page now uses the same guard. Navigation stays empty while the account is unresolved, and Admin navigation no longer inherits patient routes. Server authorization, not hidden links, remains the security boundary.

Authenticated API handlers reject incomplete and pending accounts by default. Only `/api/me` GET, registration POST, and professional verification-document upload/confirmation explicitly permit onboarding access. Existing Clerk components provide sign-in, sign-up, session management, and password recovery; dashboard email/password configuration must still be verified in the actual Clerk instance.

Cookie-authenticated writes reject mismatched Origin headers and explicit cross-site browser requests. Authenticated API success and error responses have `Cache-Control: private, no-store`. Non-browser callers without Origin still require authentication. Custom proxy/domain installations should verify that the application's request origin is preserved.

Administrative account updates require the corresponding doctor/facility profile before granting those professional roles. Account updates and registration submissions now persist their audit record inside their data transaction. Task updates similarly audit actual owned-state changes transactionally. Message-read access is audited before returning content. Older clinical endpoints still need an exhaustive read/write audit-coverage review.

Registration answers, including identity and health information, are no longer persisted in sessionStorage. Previous drafts are removed on mount. Refreshing registration intentionally clears unsaved answers. Signing out attempts to unsubscribe the current browser from push before revoking the session; browser cleanup errors do not prevent session revocation. API, page, audit-error, storage-delete, and changed notification error paths avoid logging raw error/provider payloads.

## Shared component library

The existing `src/components/ui` library remains the source for cards, badges, avatars, buttons, inputs, dialogs, and tabs. New shared components extend the same tokens without adding a second theme or chart dependency.

| Component | File | Behavior |
| --- | --- | --- |
| Status chip | `src/components/shared/status-chip.tsx` | Explicit textual meaning plus existing semantic color tokens |
| Data table | `src/components/shared/data-table.tsx` | Generic typed columns, controlled sorting/pagination, semantic headers, horizontal scroll region, loading/error/empty states |
| Filters | `src/components/shared/filter-bar.tsx` | Labeled search and optional date range; caller owns server filtering |
| Lightweight chart | `src/components/shared/line-chart.tsx` | Responsive SVG, title/description, equivalent data table, invalid-number filtering |
| Form field | `src/components/shared/form-field.tsx` | Stable input labels, hint/error association, aria-invalid, announcement; used in profile editing |
| Action menu | `src/components/shared/action-menu.tsx` | Existing Base UI primitive for keyboard navigation and disabled actions |
| Drawer | `src/components/shared/drawer.tsx` | Existing Radix primitive, focus trap, Escape, focus restoration; used in mobile navigation |
| Async states | `src/components/shared/async-state.tsx` | Empty, error, skeleton, dashboard loading states |
| Offline banner | `src/components/shared/offline-banner.tsx` | Online/offline transitions; never caches health records or queues writes |
| Global toast host | `src/components/shared/global-toaster.tsx` | Single themed Sonner host mounted in the root layout |

The existing Tabs component now passes `orientation` to Base UI and targets the actual `data-orientation` attribute. Its previous selectors caused horizontal tabs to render as a tall side rail. Global keyboard focus outlines, a skip link, reduced-motion support, navigation landmarks, active-link indicators, and accessible icon-button labels were added.

These primitives are foundations for later dashboard phases. They are not a claim that every legacy dashboard has already been refactored to the new table/filter/chart APIs.

## Notifications

Event templates now cover appointments/bookings, results, messages, payments/refunds, tasks, and account changes. Task/account events use the existing `SYSTEM` category and its channel preferences; no enum migration is introduced. External notification bodies are generic and do not include clinical text, names, document titles, diagnosis details, or task descriptions.

All existing `queueNotification` call sites await notification persistence before responding. If the already checked-in `workspace_delivery` table exists, the in-app notification and its delivery job are written in one transaction. Only provider I/O is deferred with Next.js `after`. The existing workspace cron and after-response delivery share the same worker.

The worker leases at most 100 jobs, uses `FOR UPDATE SKIP LOCKED`, rechecks recipient status and preferences, tracks email/push separately, and retries actual failures up to five times. Missing provider setup or browser enrollment is not counted as successful delivery and does not consume retry attempts unless another channel actually fails. Resend requests have a stable per-job idempotency key and a timeout. Blocked/deleted recipients are not sent queued notifications.

Push enrollment accepts supported HTTPS browser-push providers and validates public/auth key encodings. Delivery validates stored endpoints as well, removes invalid/expired subscriptions, and uses request timeouts. Notification links and service-worker click navigation are restricted to the same origin. The service worker does not cache API responses or health records.

The notification API now supports owner-scoped `after` cursors, deterministic timestamp-and-ID ordering, bounded oldest-first polling batches, and `nextCursor`, `hasMore`, and `checkedAt` metadata. Polling pauses offline and in hidden tabs, prevents overlapping fetches, cleans up listeners, and resets on account changes. Mark-as-read only updates the UI after successful server persistence and announces failures.

### Delivery limits

- If the existing workspace migration is not installed, in-app notifications still work with best-effort external delivery. The application does not create the table automatically.
- Provider credentials, verified email sender, HTTPS, push permission/enrollment, and a running authenticated cron schedule are deployment prerequisites. None were added or changed in this phase.
- The originating appointment/payment/task write and notification creation remain separate transactions in legacy workflows. A process failure between them needs reconciliation; there is not yet an atomic business-event outbox across all modules.
- Delivery is at least once, not exactly once. Partial multi-device push failures may duplicate alerts on retry. Resend's own idempotency retention bounds apply.
- Exhausted jobs are visible through the operational endpoint but require operator investigation. No automatic retry-reset or destructive queue-management endpoint was added.
- A browser that never grants push permission cannot receive push. User consent/preferences are honored rather than overridden.
- Critical-result scans retain the existing seven-day/100-result limits. These need backlog reconciliation before relying on them as a complete clinical alerting system.
- Notification polling is not a transactional change stream. Deleted cursor anchors fall back to timestamp polling; commit-order anomalies still require reconciliation through the notification centre.

## Data and API foundations

No data models or schema enums were added, changed, or migrated. The implementation reuses these existing relationships:

| Domain | Existing persistence | Principal access rule |
| --- | --- | --- |
| Users and roles | `User`, professional/patient profiles | Self or authorized Admin; never self-assigned professional/Admin roles |
| Appointments | `Appointment` linked to patient and doctor | Participant ownership and existing verified-care scope |
| Cases | Patient case number, consultations, medical history | Patient self-access or authorized care relationship |
| Messages | `Conversation`, `Message` | Conversation participants |
| Payments | `Payment`, `PaymentAttempt`, `PaymentEvent` | Payer/payee scope and administrative operation policies |
| Results | `LabOrder`, `LabResult`, `LabResultValue` | Patient/assigned clinician/facility scope and existing review gates |
| Facilities and services | `FacilityProfile`, `FacilityService`, `FacilityBooking`, staff profile | Existing facility membership/ownership checks |
| Documents | `UserDocument`, `StoredFile`, existing `workspace_documents`/`workspace_shares` | Owner or explicit, unexpired, unrevoked consent to verified recipient |
| Notifications | `Notification`, `NotificationPreference`, `PushSubscription`, existing `workspace_delivery` | Recipient ownership; operational aggregates restricted to Admin |
| Audit | `AuditLog` | Server-written actions; existing scoped export |
| Tasks | Existing `workspace_tasks` | Owner only; task transitions idempotent and audited |

### Endpoint changes

| Endpoint | Change |
| --- | --- |
| `GET /api/admin/notification-health` | New Admin-only aggregate health endpoint; audit on read; provider configuration booleans and pending/exhausted counts; no recipient or payload data |
| `GET /api/notifications` | Stable owner-scoped continuation cursor and bounded polling metadata |
| `POST /api/notifications/push-subscription` | Known-provider HTTPS and cryptographic key validation |
| `GET /api/me` | Explicit onboarding access; guarded account response remains available to registration |
| `POST /api/users/register` | Explicit onboarding access, transactional audit, patient account-ready notification |
| `POST /api/me/documents`, `POST /api/me/documents/confirm` | Explicit onboarding permission for professional verification |
| `PATCH /api/admin/users` | Profile prerequisites, transactional audit, activation/update notification |
| `GET /api/conversations/:id/messages` | Audit before returning messages |
| `POST/PATCH /api/workspace/tasks` | Task notifications, transactional/idempotent owned updates |
| Existing appointment, booking, AI-review, message, payment paths | Await notification persistence; no changed request schema |
| All `withAuth` endpoints | Default completed-active account policy, same-origin write checks, private no-store responses |

Existing APIs for documents, consent sharing/revocation, clinical records, payments, services, and audit export are reused, not replaced.

## Security and deployment gates

Do not introduce real PHI until the deployment's controls have been verified. TLS for public traffic and storage/database connections, encryption at rest for database volumes, backups and private object storage, key rotation, production Clerk settings, recovery/MFA policy, malware scanning, retention/deletion policy, incident response, provider contracts, and jurisdictional compliance are infrastructure/operational requirements, not proven by a successful build.

The existing storage code signs short-lived private download/upload URLs and validates uploaded content. Bucket encryption and database encryption have not been inspected or changed. No new application-level encryption layer or encryption-key configuration is claimed in this phase.

Live authenticated role smoke tests, database-backed transaction/concurrency tests, email delivery, actual browser Web Push, and production deployment remain pending access to the user's approved test infrastructure. A built client or isolated component preview is not a replacement for those tests.

## Verification and review

The baseline was 81 passing unit tests and 18 skipped database integration tests. New regression coverage includes account states/soft deletes, role navigation routes, request origins, API cache/authorization policy, push SSRF prevention, privacy-safe emails, notification persistence, delivery retries/preferences, and pagination.

The production build uses Node 22 and the repository CI's dummy Clerk/database values. No external account or database is authenticated by these build placeholders. The isolated component-review harness lives outside this repository and uses synthetic fixtures and stubbed authentication; it must never be deployed as the production healthcare platform.

### Browser QA inventory

- Role selector: exercise all four existing navigation sets and ensure Admin does not inherit patient routes.
- Responsive shell: inspect desktop and mobile, then resize through small phone, tablet, and desktop.
- Shared filters/table: search to empty state and back, sorting ARIA, previous/next controls, date input labels.
- Shared forms: required-field error, aria-invalid and description association, recovery.
- Chart: SVG rendering and accessible data-table disclosure.
- Dialog/drawer/menu: mouse selection, Escape, tab containment, focus restoration, disabled actions.
- Toast: global host and dismiss behavior.
- Async states: empty, loading, error, retry.
- Connectivity: offline banner and reconnect recovery; no offline health-record cache.
- Theme/reduced motion: inspect both existing themes and visible focus states.
- Off-happy-path exploration: unknown search, empty required input, blocked UI actions, offline transition, repeated open/close and viewport changes.

### Results

- Node 22 production build: passed using CI placeholder values, with 105 statically generated pages plus dynamic routes.
- TypeScript: passed.
- ESLint: passed with zero errors or warnings.
- Unit/route/render tests: 177 passed across 24 files. The 18 existing Postgres integration tests remain skipped because no approved disposable database is configured.
- Isolated Chromium review: 27 interaction/responsive checks passed with no uncaught runtime errors. Inspected desktop and 375px mobile screenshots in existing light/dark themes, plus mobile drawer and error states. Additional layout checks passed at 320px and 768px, including a desktop/mobile/desktop resize cycle.
- Verified keyboard focus containment in drawer and modal, Escape dismissal, and drawer trigger focus restoration. Tested table search/sorting/pagination, chart disclosure, form validation, menu selection/disabled state, toast display, retry, and offline/reconnect transitions.
- Existing muted-text token contrast: 6.65:1 on the dark card, 5.07:1 on the light card, and 4.66:1 on the light background. This is a targeted token check, not an exhaustive accessibility audit of every existing page.
- No horizontal page overflow was observed at the checked widths. No drawer/modal focus escape, broken SVG, or clipped new component controls was observed in the reviewed states.
- Not verified: real Clerk login/reset/session revocation, actual database transactions under concurrency, live email/Web Push, physical assistive technology, production transport/storage encryption, or deployment health.

### Feature-group commits

- `c54548a`: `fix(auth): enforce account readiness and role-aware navigation`
- `0ab7899`: `feat(ui): add accessible shared dashboard foundations`
- `a3ee60c`: `feat(notifications): persist multichannel delivery and harden push security`
- `c129268`: `fix(security): revoke browser push enrollment on sign-out`
- `409607e`: `fix(auth): keep secure sign-out available for blocked accounts`

### Next approval gate

Review this handoff and approve or revise the outstanding deployment/security verification work. Phase 2 is not started. Before using real PHI, validate the infrastructure controls above and address business-event/notification atomicity and critical-result backlog reconciliation.

### Changed files

| Change | File |
| --- | --- |
| Added | `docs/PHASE_1_FOUNDATIONS.md` |
| Modified | `public/sw.js` |
| Added | `src/app/api/admin/notification-health/route.ts` |
| Modified | `src/app/api/admin/users/route.ts` |
| Modified | `src/app/api/ai-analyses/[id]/review/route.ts` |
| Modified | `src/app/api/appointments/[id]/reschedule/route.ts` |
| Modified | `src/app/api/appointments/[id]/route.ts` |
| Modified | `src/app/api/appointments/route.ts` |
| Modified | `src/app/api/conversations/[id]/messages/route.ts` |
| Modified | `src/app/api/facility-bookings/[id]/route.ts` |
| Modified | `src/app/api/facility-bookings/route.ts` |
| Modified | `src/app/api/me/documents/confirm/route.ts` |
| Modified | `src/app/api/me/documents/route.ts` |
| Modified | `src/app/api/me/route.ts` |
| Modified | `src/app/api/notifications/push-subscription/route.ts` |
| Modified | `src/app/api/notifications/route.ts` |
| Modified | `src/app/api/users/register/route.ts` |
| Modified | `src/app/api/workspace/tasks/route.ts` |
| Modified | `src/app/error.tsx` |
| Modified | `src/app/globals.css` |
| Modified | `src/app/layout.tsx` |
| Modified | `src/app/loading.tsx` |
| Modified | `src/app/page.tsx` |
| Modified | `src/app/profile/page.tsx` |
| Modified | `src/components/layout/navbar.tsx` |
| Modified | `src/components/post-signup-redirect.tsx` |
| Modified | `src/components/profile-form.tsx` |
| Added | `src/components/shared/action-menu.tsx` |
| Added | `src/components/shared/async-state.tsx` |
| Added | `src/components/shared/data-table.tsx` |
| Added | `src/components/shared/drawer.tsx` |
| Added | `src/components/shared/filter-bar.tsx` |
| Added | `src/components/shared/form-field.tsx` |
| Added | `src/components/shared/foundations.test.ts` |
| Added | `src/components/shared/global-toaster.tsx` |
| Added | `src/components/shared/line-chart.tsx` |
| Modified | `src/components/shared/notification-center.tsx` |
| Modified | `src/components/shared/notification-list.tsx` |
| Modified | `src/components/shared/notification-preferences.tsx` |
| Added | `src/components/shared/offline-banner.tsx` |
| Added | `src/components/shared/sign-out-button.tsx` |
| Added | `src/components/shared/status-chip.tsx` |
| Modified | `src/components/ui/tabs.tsx` |
| Added | `src/lib/api.test.ts` |
| Modified | `src/lib/api.ts` |
| Modified | `src/lib/audit.ts` |
| Modified | `src/lib/auth.ts` |
| Modified | `src/lib/errors.ts` |
| Modified | `src/lib/guards.ts` |
| Added | `src/lib/navigation.test.ts` |
| Added | `src/lib/navigation.ts` |
| Added | `src/lib/notifications/device.test.ts` |
| Added | `src/lib/notifications/device.ts` |
| Added | `src/lib/notifications/email.test.ts` |
| Modified | `src/lib/notifications/email.ts` |
| Modified | `src/lib/notifications/events.ts` |
| Added | `src/lib/notifications/outbox.test.ts` |
| Added | `src/lib/notifications/outbox.ts` |
| Added | `src/lib/notifications/push-validation.test.ts` |
| Added | `src/lib/notifications/push-validation.ts` |
| Modified | `src/lib/notifications/push.ts` |
| Added | `src/lib/notifications/routes.test.ts` |
| Added | `src/lib/notifications/safe-href.ts` |
| Added | `src/lib/notifications/service.test.ts` |
| Modified | `src/lib/notifications/service.ts` |
| Modified | `src/lib/payments/service.ts` |
| Added | `src/lib/request-security.test.ts` |
| Added | `src/lib/request-security.ts` |
| Added | `src/lib/roles.test.ts` |
| Added | `src/lib/roles.ts` |
| Modified | `src/lib/storage.ts` |
| Modified | `src/lib/use-me.ts` |
| Modified | `src/lib/workspace/notifications.ts` |
