# Super Admin Control Centre (Medic1905)

The Super Admin Dashboard (`/super-admin`) is the central command centre for the whole Medic1905 platform. It provides global control **without automatically granting every administrator unrestricted access to patients' confidential medical records**: clinical-record access stays in the existing facility-level `ClinicalPrivilege` / `StaffPatientAccess` models, separately authorised, justified and audited.

## Access model

Console access is granted by exactly two paths, both requiring `user.role = ADMIN` and `status = ACTIVE`:

1. **SuperAdminGrant** — the platform owner path. Carries the full permission catalog, and every non-VIEW action additionally requires fresh multi-factor authentication (the Clerk `fva` session claim).
2. **Active AdminMembership** — a membership in an admin department, with zero or more `AdminRoleAssignment` records providing the actual permissions.

Everything is enforced server-side:

- Permission keys are `SECTION:VERB` strings (26 sections × up to 15 verbs: VIEW, CREATE, EDIT, DELETE, APPROVE, REJECT, SIGN, RELEASE, DOWNLOAD, PRINT, EXPORT, ASSIGN, CONFIGURE, MANAGE, AUDIT).
- `resolvePermissions()` merges role permissions with per-user `AdminPermissionOverride` rows; **DENY always wins**, and memberships/assignments expire on schedule (`startsAt`/`endsAt`, checked per request).
- `requireAdminPermission()` / `requireConsolePage()` / `requireSectionPage()` guard every API route and page, so a disabled module is unreachable even by direct URL.
- Seniority is never implied by job title — permissions are explicitly assigned and audited. Roles never confer clinical privileges: a technical administrator cannot prescribe, approve lab results or sign clinical reports, because clinical actions are gated by the separate clinical privilege models.

## Control layers

| Layer | Sections |
|---|---|
| Master Governance | Overview Dashboard, Global User Management, Platform Settings, Module & Feature Control, Notifications |
| Team & Workforce Management | Admin Team Management, Roles & Permissions, Approval Workflows |
| Healthcare Network Management | Facility Management, Departments & Specialties, Doctor Management, Patient Account Management, Nursing, Laboratory, Radiology & Diagnostics, Pharmacy |
| Clinical & Content | Clinical Governance, Medical Documents & Templates, AI Management |
| Security & Operations | Security Centre, Audit Logs, Data Governance, Analytics & Reports, Integrations & API Management, Subscription & Billing, System Health |

## Roles and departments

The migration seeds 11 departments (Executive Leadership, Platform Administration, Technical Support, User & Facility Management, Clinical Governance, Finance & Subscriptions, Security & Compliance, Data & Analytics, Training, Quality Assurance, Integrations) and 17 roles, including Super Admin, Deputy Super Admin, CTO, Platform Administrator, Technical Support Officer, Finance Administrator, Data Protection Officer and Compliance Officer. Role permissions are stored as explicit `AdminRolePermission` rows (324 seeded), so every role can be customised or replaced from the Roles & Permissions screen.

## Privileged changes and dual approval

Assigning a privileged role (any role holding `*:MANAGE`, `SETTINGS:CONFIGURE`, `APPROVALS:APPROVE`/`APPROVALS:REJECT`) requires either a Super Admin actor or an approved `ASSIGN_PRIVILEGED_ROLE` approval request.

Approval workflows (`ApprovalWorkflow`, seeded with 8) support dual approval: `approverRoleKey` plus an optional `secondApproverRoleKey`. The requester can never decide their own request, and when two approvals are required they must come from two distinct people. Every privileged change is written to a hash-chained `ControlAuditEvent` (via the database trigger) and the regular `AuditLog`.

## Audit and privacy

- Every console write goes through `controlAudit()`: who, what, before/after, request id, IP and user agent, with tamper-evident hash chaining.
- The platform owner has no invisible route around patient privacy: SuperAdminGrant activity is audited like everything else, and clinical record access remains governed by the clinical privilege system.
- Subscriptions expiring never deletes clinical records; data governance tooling operates on copies, not destructive deletes.

## Code map

- `prisma/migrations/20261107000000_super_admin_control_centre/` — 13 new models + idempotent seeds.
- `src/lib/superadmin/permissions.ts` — section/verb catalog, `resolvePermissions`, default roles, departments, approval workflows.
- `src/lib/superadmin/access.ts` — `getAdminAccess`, `requireAdminPermission`, page guards, navigation visibility.
- `src/app/super-admin/**` — layout + 26 pages in the five control layers.
- `src/app/api/admin/{team,roles,approvals,security-incidents,specialties,settings}/route.ts` — server-enforced APIs.
- `src/lib/superadmin/{windows,policy-view,sections}.ts` — shared helpers and navigation config.
- Tests: `src/lib/superadmin/permissions.test.ts` (unit) and `src/lib/superadmin/access.int.test.ts` (acceptance tests from spec §22, run against a disposable `*_test` PostgreSQL via `SA_TEST_DATABASE_URL`).
