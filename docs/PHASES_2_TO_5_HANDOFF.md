# Phases 2–5 engineering handoff

The existing Next.js App Router, React, TypeScript, Tailwind, Clerk, Prisma/Postgres, site shell, routes, themes, and Medic1905 branding are retained. This handoff records implemented code and verified engineering checks, not healthcare compliance certification or live-provider acceptance.

## Scope and implementation

- **Branch:** `main`, as explicitly authorized. The user waived subsequent phase approval gates.
- **Schema:** reuse existing Prisma models and checked-in workspace extension tables. No new model, enum, migration, dependency, environment variable, or deployment configuration was introduced.
- **Providers:** existing Clerk, Resend, Web Push, private object storage, payment integration, and optional server-side Kimi integration only. No provider was provisioned or reconfigured.
- **Design:** new role sections are appended within canonical existing dashboards, not a replacement shell. `/workspace` redirects users to their role dashboard. Shared components reuse native site tokens and Phase 1 primitives.

## Patient dashboard

- **Implemented:** greeting and existing appointment/result widgets retained; secure communication and payments widgets; task create/complete/reopen; owned case-number search; verified results and critical alerts; health timeline; document upload/download; explicit document-level, expiring clinician consent and revocation; appointment-linked intake; payment selection and reasoned disputes.
- **Files:** `src/app/dashboard/page.tsx`; `src/components/dashboard/{patient,tasks,documents,payments,common}.tsx`; `src/lib/workspace/{data,types,filters}.ts`; document/intake/report APIs and notification event additions.
- **Persistence:** existing tasks, documents, shares, intake, patients/cases, appointments, lab results, payments, conversations, and audit records. No new data model.
- **API work:** `GET /api/workspace/report` adds role-owned, filtered CSV; existing document/intake APIs gain consent and notification hardening; owned disputes use `POST /api/workspace/operations`.
- **Security:** patient ownership on search and writes; explicit future booked/confirmed appointment intake consent; verified clinician document recipient; expiry/revocation; private file delivery; no offline PHI cache or offline mutation queue.
- **Follow-ups:** real upload/download requires configured private storage and existing tables. Existing appointment, payment, and messaging routes remain the complete management screens rather than duplicated dashboard forms.

## Doctor dashboard

- **Implemented:** today's schedule plus upcoming visits; next-patient context; alerts; clinical task kinds; recent verified result trends; unread communication; shared documents; currency-separated gross earnings; availability; subscription entitlement status/pause/cancel; consultation templates; existing searchable ICD-10 selection; follow-up reminder scheduling/list/cancel.
- **Files:** `src/app/doctor/dashboard/page.tsx`; `src/components/dashboard/doctor.tsx`; `src/components/doctor/{consultation-tools,assistance-editor,icd10-picker}.tsx`; `src/components/consultation-form.tsx`; `src/lib/consultation-templates.ts`; consultations, clinical-context, followups, subscription APIs.
- **Persistence:** existing consultations, diagnoses, prescriptions, clinical tasks, intake, subscriptions, followups, audit records and professional/patient relationships.
- **API work:** `GET /api/workspace/clinical-context`; `GET` and `DELETE /api/workspace/followups`; hardened existing followup creation and consultation creation/read; `PATCH /api/workspace/subscription`.
- **Security:** verified doctor plus assigned-patient scope; explicit consent for intake context; context tagged by patient ID; patient changes clear unsaved notes after confirmation; consultation/ICD/prescription writes audit transactionally; draft consultations cannot issue active medications; self-service entitlement changes cannot activate subscriptions and explicitly do not change external billing.
- **Follow-ups:** cron must run for reminder delivery. Prescriptions/referrals still require clinicians to complete the existing clinical workflow; task completion alone issues nothing.

## Facility and admin dashboards

- **Facility implemented:** booking actions, result queue, service catalogue links, resource/staff capacity and allocation/unassignment, date-scoped workload, calendar-hour utilization, turnaround median/P90, revenue by currency/payment status.
- **Admin implemented:** existing provider verification retained; payment filtering/export and explicit refund confirmation; dispute review/resolution; entitlement management; notification configuration/backlog health; experiment aggregates; date-scoped audit exports.
- **Files:** `src/app/lab/{dashboard,orders,upload}/page.tsx`; `src/app/admin/dashboard/page.tsx`; `src/components/dashboard/{facility,admin}.tsx`; `src/lib/{facility-access,workspace/analytics}.ts`; facility analytics, operations, report/export, lab order/patient/manual result APIs.
- **Persistence:** existing facility profiles/services/bookings, workspace resources/assignments, payments/disputes/subscriptions, lab orders/results, delivery and audit records.
- **API work:** `GET /api/workspace/facility-analytics`; extended `GET/POST /api/workspace/operations`; hardened existing scoped lab endpoints and audit export.
- **Security:** verified facility, own resource and eligible booking scope; locked resource capacity checks; transactionally audited creation/allocation changes; duplicate open dispute protection under payment lock; closed disputes cannot reopen; audited administrative changes; no clinical payload in operational audit CSV.
- **Facility isolation:** legacy global lab patient/order visibility was removed. Current schema permits scope through explicit eligible facility booking or the caller's previous result upload. This is booked-patient scope, not a direct order-to-facility tenant model or full multi-staff facility membership system.
- **Analytics limits:** utilization uses calendar hours, not configured working hours or validated productivity. Turnaround is a bounded sample of owned uploaded results. Revenue is not net earnings, payout reconciliation, or a complete accounting ledger.
- **Billing limits:** subscriptions are entitlement records, not a new recurring-billing service. Refunds invoke existing payment policies/provider handling and require live sandbox verification.

## Advanced intelligence

- **Implemented:** verified result trends, rule-based care-gap signals, clinician reviewable summaries and draft documentation, patient pre-visit questions/intake, attendance reminder-priority rules and schedule-gap suggestions, consented wearable JSON import/charts/deletion, rule-derived health insights, opt-in signed-in homepage/dashboard experiments.
- **Files:** `src/lib/workspace/{assistance,experiments,intelligence}.ts`; `src/components/dashboard/{intelligence,engagement}.tsx`; `src/components/doctor/assistance-editor.tsx`; assistance, wearables and experiments APIs; booking conversion instrumentation in appointments API; authenticated legacy summary alias.
- **API work:** `POST /api/workspace/assistance`; authenticated `POST /api/ai-summary` alias; hardened `GET/POST/DELETE /api/workspace/wearables`; hardened experiment GET/POST with owned opt-out deletion and server-only appointment conversion.
- **AI safeguards:** explicit consent/processing attestation; verified clinical relationship; bounded context and prompt; common identifiers minimized, not certified deidentification; no prompt/output logging or automatic persistence. Local extracts are explicitly not AI and do not invent assessment or examination. Optional provider calls require explicit provider opt-in and existing configuration; missing provider returns an honest error. Clinicians edit, confirm review, apply to unsaved notes, and separately save the consultation. Editing resets review confirmation.
- **Wearables:** bounded canonical JSON import, source labeling, patient-reported metrics, metric/timestamp validation, duplicate handling and own-data deletion. No Apple Health/Fitbit OAuth or continuous synchronization was implemented.
- **Risk/scheduling:** explainable rules only, not a validated predictive no-show model or calibrated probability. Suggestions do not move visits or make clinical decisions.
- **Experiments:** signed-in optional copy/CTA variants, stable per-account allocation, daily deduplicated exposure/engagement, server-recorded conversion after opted-in exposure, admin aggregates. No anonymous marketing tracking, statistical significance engine, or conversion-lift claims.

## Notifications and access controls

New sharing, intake, dispute, subscription and finalized-consultation events reuse Phase 1's generic notification templates, in-app centre, toast handling, delivery queue and consent/preferences. External content avoids patient names and clinical details. Successful provider delivery still depends on existing configuration, enrolled devices, an authenticated cron, and table availability.

Sensitive reads/writes are scoped server-side, with rate limiting and audit metadata where implemented. Raw clinical payloads are excluded from new operational logs/exports and AI audit entries. Existing Phase 1 private no-store responses, cross-origin write checks, blocked-account guards and secure upload policies continue to apply.

No encryption infrastructure was provisioned or verified. Production TLS, database/storage encryption, key management, retention, backup/restore, breach response and organization-specific legal/compliance requirements require deployment validation. Some legacy business writes and notification enqueue operations remain separate transactions; this is not a complete transactional business-event outbox. Existing critical-result scan bounds and notification recovery limitations in the Phase 1 handoff remain applicable.

## Verification

- **Static checks:** `npm run typecheck`, `npm run lint`, and `git diff --check` passed.
- **Unit tests:** 229 passed across 34 test files; 18 existing Postgres payment integration tests skipped because a real test database was not configured.
- **Production build:** passed with Node 22, including Prisma generation and 111 static pages plus dynamic routes. Non-secret placeholder environment values were used solely for build validation; this did not verify a live database or auth service.
- **Regression coverage:** authorization/consent, scoped facility operations, capacity locking, duplicate disputes, subscription ownership and confirmation, filters, clinical templates, assistance safety, experiments and submit-button semantics.
- **Browser:** 32 recorded synthetic component workflow checks plus payment-dispute submission and subscription pause; task states, document consent/revoke, intake, wearable import/delete, ICD-10 keyboard selection, reviewed draft application, followups, resources/allocations, refunds, disputes, entitlement updates, health and experiments.
- **Responsive review:** four role components checked at 320px, 375px, 768px and desktop with no page-level horizontal overflow in tested states; light/dark screenshots inspected. Offline mutation rejection and invalid document MIME were explored.
- **Browser boundary:** isolated review uses actual components and the native shell, with synthetic data, Clerk/navigation stubs and in-memory API responses. It does not exercise real server authorization, DB transactions, authentication, payments, storage, AI, email or push end to end. Latest payment form and subscription controls additionally checked at the end.

## Deployment and acceptance gates

- **Existing database:** confirm all previously checked-in migrations, particularly workspace extension and delivery tables, are already installed. No migration was run or authorized here; features fail closed or expose existing extension-unavailable states rather than creating tables.
- **Existing providers:** verify Clerk role provisioning, registration/recovery/session flows, storage MIME/size/signing policies, payment sandbox flows, Resend sender, push enrollment and cron delivery in the existing deployment. Any configuration changes require separate authorization.
- **Clinical acceptance:** test assigned/unassigned patients and all role boundaries against a real non-production database; validate code-set licensing/version requirements, consent expiry/revoke, critical alerts, audit coverage, browser accessibility and operational reconciliation.
- **Operational acceptance:** test bounded pagination/exports against expected volumes. Tables/export endpoints intentionally cap records; analytics are not unlimited historical reporting.
- **Remaining product scope:** live wearable vendor integration, calibrated predictive modeling, external recurring subscription billing, anonymous homepage experimentation and comprehensive production compliance certification remain follow-ups. The implemented alternatives are labeled explicitly rather than represented as complete integrations.

## Feature commits

- `7aef726` `feat(patient): integrate care tasks records consent and timeline into dashboard`
- `3b78b96` `feat(doctor): add clinical dashboard context templates and follow-up management`
- `4087543` `feat(operations): integrate facility analytics and audited admin workflows`
- `af2dd0a` `feat(intelligence): add reviewed assistance trends wearable imports and consented experiments`
- Final hardening and this handoff are committed separately. Git history is the authoritative final commit inventory.
