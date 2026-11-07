# Medic1905 workforce and platform-control implementation report

This change extends the existing Medic1905 application rather than creating a replacement application. It implements and tests substantial organisational and security foundations, but it does not complete the entire enterprise specification or establish production readiness. The remaining work and integration dependencies below are release gates, not optional omissions.

Repository: [Vinnnnce/iMedics](https://github.com/Vinnnnce/iMedics/tree/main). Existing website: [Medic1905](https://i-medics.vercel.app/).

## Existing implementation

**Status: inspected; existing workflows retained with documented security changes.**

The application uses Next.js App Router, React, Prisma/PostgreSQL, Clerk and the existing shadcn/Radix UI stack. Existing modules include patient records, doctor and facility portals, facility staff, credentials, departments, clinical documents, investigations, nursing, admissions, medication administration, payments and an administrative console.

Important pre-existing limitations identified during inspection:

- **Membership uniqueness:** a globally unique staff user ID prevented one professional having independent memberships at multiple facilities.
- **Permissions:** some portal guards used role defaults rather than access-level overrides; custom overrides were only one part of the permission architecture.
- **Department integrity:** leadership IDs were not consistently tenant-validated and there was no department tree.
- **Clinical authority:** department-head defaults included clinical actions unrelated to verified professional privileges.
- **Patient linkage:** a generic patient-assignment query could establish facility linkage without matching the facility.
- **Invitations:** plaintext tokens, incomplete resend/cancellation behaviour and insufficient verified-email checks needed tightening.
- **Administration:** ordinary ADMIN access was not distinguished from a fresh-MFA, explicitly granted master-control session.

## Staff categories

**Status: fully implemented and tested for the catalogue and custom professional titles; custom authorization-role creation is not implemented.**

The catalogue covers medical, nursing, laboratory, radiology/diagnostic, pharmacy, finance, legal/compliance, communications/media and administration/operations professions. Facilities choose relevant titles rather than automatically acquiring every category. Custom category labels, professional titles, specialties and engagement types are supported.

Professional category, job title, organizational rank and authorization role remain separate concepts. The existing safe authorization-role catalogue is reused; a cashier can be titled as a cashier under the existing billing authorization role and narrowed with permission overrides. A custom legal or media job title does not itself grant access to patient records.

The authoritative catalogue is `src/lib/organization/catalogue.ts`. The workforce UI uses the same existing authorization-role and permission constants as the server.

## Departments and subdepartments

**Status: fully implemented and tested for CRUD, tree integrity, leadership validation and non-destructive deactivation; advanced departmental performance is partially implemented.**

The existing department model now supports codes, parent departments, heads, deputies, active state and image URL metadata. API and PostgreSQL safeguards reject foreign-facility references and department cycles. The UI supports custom names, suggested names, operating hours, parent selection and leadership selection.

Existing services and staff are counted against departments. The new screen does not provide a complete department service editor, secured logo-upload pipeline, outcomes dashboard or all requested departmental performance analytics.

## Professional hierarchy and ranking

**Status: fully implemented and tested for positions, parent relationships, ranks, appointments, effective dates, vacancies and appointment history; visual charting is partially implemented.**

Facilities can create positions and reporting relationships, assign substantive/acting/deputy appointments and record effective/end dates and appointment reasons. Tenant checks, cycle checks, interval validation and same-kind appointment-overlap checks are enforced. Staff reporting managers can be changed independently of professional qualifications.

The UI provides a structured hierarchy list, vacancy indicators, appointments/history and CSV export with spreadsheet-formula protection. A graphical organizational-chart editor and visual chart export are not implemented. Department head/deputy pointers and generic position appointments are related to the same tenant/staff structure, but are not automatically synchronized by inferred job titles.

## Staff invitation workflow

**Status: fully implemented and tested for the core invitation lifecycle; external delivery and some requested recruitment states remain partial.**

Invitations support category, specialty, department, title, engagement type and expiry. Tokens are cryptographically generated, hashed at rest, consumed once, bound to the invited account email and checked against Clerk's verified email addresses on redemption. Existing accounts are reused; redemption creates a facility relationship, not a duplicate user.

Resend rotates the token and attempts actual email delivery. Failed initial delivery is reported as a saved invitation requiring retry rather than falsely reported as sent. Invitations can be cancelled or rejected; expired invitations cannot be redeemed. Re-engagement clears historical patient/clinical grants and resets credential verification rather than inheriting old authority.

An existing-user recruitment search, draft invitation editor, separate persistent “sent” versus “pending acceptance” records and scheduled expiry processing are not implemented. Actual email delivery requires the configured email provider and was not exercised against real recipients.

## Professional credential verification

**Status: partially implemented, with the new verification and clinical-grant boundaries tested.**

The existing credential model is reused. Master control includes a pending-review queue and a fresh-MFA, confirmed verification/rejection endpoint. Self-verification is rejected in the new master-control workflow. A verified uploaded certificate alone does not confer a clinical privilege.

Editing credential evidence resets verification and revokes associated current clinical grants. Credential removal is now a recorded revocation, not deletion of historical evidence. Facility owners can explicitly grant time-limited clinical privileges against currently verified, non-lapsed credentials; grant and revocation have a separate API and UI.

Regulatory-register integrations, profession/specialty-specific automated qualification matching, malware scanning and a complete private evidence-upload/viewing experience require further work. Independent verification of evidence remains the authorized reviewer's responsibility.

## Facility-level permissions

**Status: partially implemented; central enforcement and the new management workflows are tested.**

The existing permission catalogue now supports NONE, READ_ONLY, LIMITED, STANDARD, EXTENDED, DEPARTMENT, FULL and CUSTOM access configurations. Effective/access-expiry dates and overrides are enforced. The permissions matrix supports staff selection, custom additions/removals, department restrictions, expiry and patient assignment/revocation.

Managers cannot delegate permissions they do not hold. The accountable facility owner can configure base permissions without personally being clinically qualified, but executing a regulated action still requires the staff member's separate clinical privilege. Department-head defaults no longer automatically include prescribing, laboratory verification or clinical signing.

Custom role identities/templates, configurable inheritance between custom roles, review-reminder delivery and generalized configurable approval-rule engines are not implemented. Existing workflow-specific approval rules remain in place.

This is a deliberate breaking access-policy change, despite preserving the records themselves. Existing facility staff receive no automatically invented clinical privileges; affected regulated actions return an authorization error until credentials and explicit grants are prepared. Review and provision those grants under an approved maintenance/staging plan before opening clinical workflows after release.

## Patient-level access controls

**Status: partially implemented, with important denial and revocation cases tested against PostgreSQL.**

The existing patient-access and break-glass structures are reused. Facility linkage no longer accepts unrelated patient assignments. Department-based ward matching uses the department's own wards rather than any ward in the facility. Explicit care-team, department and temporary grants are tenant-validated, reasoned and audited.

A common facility request boundary resolves supported patient-resource identifiers and enforces patient scope. LIMITED/DEPARTMENT users cannot silently fall back to unfiltered clinical collections or unsupported resource identifiers; they must select an authorized patient. Clinical document detail and print pages additionally check patient scope before building document content.

This is not a signed-off patient-confidentiality review of every legacy route. Fully usable assigned-patient collection views, all ward/consultation/investigation assignment variants, approval for exceptional global clinical-record access and a complete break-glass compliance workflow remain incomplete. Some limited-access operations intentionally fail closed rather than returning an unfiltered list.

## Super Administrator dashboard

**Status: partially implemented; the new master-control section is backend-connected and tested.**

`/admin/control` extends the existing admin console. It provides live database counts, policy search and pagination, feature/document policy editors, credential reviews, grant/security visibility and a tamper-evident audit feed. Existing administrative user, provider, payment, refund and verification screens remain in the application.

Master control requires an active, non-deleted ADMIN account plus an explicit, current `SuperAdminGrant` and fresh Clerk primary/secondary authentication. A normal ADMIN role does not satisfy that grant. Account-role/status changes on both account-control endpoints now require fresh MFA, a written reason and typed confirmation; those changes are transactionally audited.

The full requested nineteen-area control-centre expansion is not complete. Infrastructure/API health probes, object-storage usage, a new integration manager, global subscription-plan editor, comprehensive AI service administration and critical-action alert delivery are not implemented. Unavailable storage monitoring is labelled unconfigured rather than presented as a fabricated statistic.

## Global feature restrictions

**Status: fully implemented and tested for the registered module-policy engine; universal legacy and future-route coverage is partially implemented.**

Policies support enabled, disabled, read-only and restricted modes. Selectors/conditions support account type, facility type/ID, role, country, subscription plan and effective/expiry dates. Multiple applicable policies intersect; a facility cannot override a global denial.

Policies are append-only, versioned and protected against stale concurrent edits. API checks run at the shared authenticated-request boundary and, for facility operations, with the resolved facility context. Navigation and the root server layout also use feature policy checks. A doctor's personal subscription is never assumed to entitle a facility.

Coverage is explicitly registered in `src/lib/platform/policy.ts`. Unmapped legacy/new endpoints require mapping and security tests before being considered controlled. Existing account/facility-type enums are retained; a generalized facility-subtype configuration UI has not been added.

## Global document restrictions

**Status: partially implemented, with denial of application-controlled viewing/download/print operations tested.**

Document policies use the same versioned engine and support VIEW, CREATE, EDIT, APPROVE, SIGN, DOWNLOAD and PRINT restrictions. Clinical documents are checked using their template code. Mapped legacy document/file endpoints lacking a template identity fail closed when an applicable restriction could otherwise leak through a collection, export or alternate file path.

Signed clinical records are not edited or deleted by policy changes. Template codes and existing document history are retained. Existing tenant, patient-release, ownership, workflow and clinical-privilege checks continue to apply.

Universal stored-file policy coverage, facility-specific policies for all patient/doctor alternate paths, subscription entitlements for every facility type and a generalized per-template jurisdiction/approval workflow are incomplete. Already delivered content or previously issued external storage URLs cannot be recalled by a browser policy. Application-controlled print restrictions are not DRM and cannot prevent screenshots or operating-system capture of authorized content.

## Database schema changes

**Status: migration implemented and tested on disposable PostgreSQL databases; production migration not executed from this session.**

The additive migration is `prisma/migrations/20261112120000_organization_platform_control/migration.sql`. It:

- **Memberships:** replaces global staff-user uniqueness with `(facility_id, user_id)` uniqueness while retaining facility/email uniqueness.
- **Staff:** adds reporting links, access windows and invitation-state metadata.
- **Departments:** adds tree/leadership/code/active/image metadata and validation.
- **New structures:** creates organizational positions, appointments, clinical privileges, explicit super-admin grants, append-only platform policies and control-audit events.
- **Database guards:** adds tenant-reference/cycle checks, appointment checks and audit/policy mutation rejection.
- **Audit chain:** serializes hash-chain insertion and allocates sequence order under the chain lock, including concurrent operations.

No patient, signed-document, facility or user table is dropped, truncated or rewritten by the migration. The index replacement is non-row-destructive but changes rollback semantics after multiple memberships exist. Handwritten triggers/constraints must be preserved during future Prisma migration work.

The inspected source baseline was commit `e77f143`. The disposable upgrade-preservation check verified identical row-content hashes for 22 existing users, 4 patients and 8 facility profiles before and after the new migration; no production data was used. A representative signed-record upgrade fixture and complete historical-staff privilege transition still require staging validation.

The existing schema and migration history have pre-existing drift; automated schema diff is not a substitute for reviewing a future migration. New tenant-reference constraints do not constitute database read-side row-level security. RLS or an equivalent verified database-session isolation design remains a separate production-hardening task.

## APIs created or modified

**Status: implemented; specific new paths covered by integration tests.**

| Path | Change |
| --- | --- |
| `GET/POST /api/facility/organization` | Tenant-scoped organization data, positions and appointment actions |
| `GET/POST /api/admin/control` | Explicit-grant/MFA checks, live counts, policy revision and credential review |
| `GET/POST/DELETE /api/facility/staff/[id]/privileges` | Separate verified clinical grants and revocation |
| `GET/PATCH/POST /api/facility/staff/[id]/access` | Validated access configuration and patient grants/revocation |
| `/api/facility/departments` and `/[id]` | Parent/code/leadership fields, tenant/cycle checks, non-destructive deactivation |
| `/api/facility/staff` and `/[id]` | Metadata, role/status/manager changes, hashed resend/cancellation |
| `/api/facility-invitations/redeem` | Verified-email, one-use acceptance/rejection |
| `/api/facility/credentials/[id]` | Evidence-change review reset and non-destructive revocation |
| `/api/admin/users` and `/[id]` | Fresh-MFA, typed confirmation, audit and account/role safeguards |
| Shared authenticated APIs | Registered feature/document checks and private/no-store responses |
| Facility clinical-document loaders/pages | Additional patient/template-policy boundaries |

## Desktop and mobile changes

**Status: real production components implemented; component-level responsive QA performed; authenticated production screenshots not available.**

The admin navigation now has a mobile drawer and a desktop label-collapse control. Content columns use shrink-safe grid sizing. New workforce and control screens use responsive cards, wrapping actions, accessible labels, scrolling dialogs and touch-sized controls rather than scaling down a fixed desktop layout.

The original staff screen remains available. Its access-level selector includes the new values, and its grant/revoke controls collect the justification required by the strengthened backend instead of issuing incompatible requests.

The local harness imports the real production components and loads response snapshots exported from the real PostgreSQL acceptance tests. It does not bypass Clerk, does not establish authenticated end-to-end success and does not simulate successful production mutations. Screenshots visibly disclose this provenance.

Selected screenshots:

- **Facility desktop:** `docs/screenshots/organization-desktop-light.png`.
- **Facility mobile:** `docs/screenshots/organization-mobile-light.png`.
- **Master control desktop:** `docs/screenshots/master-control-desktop-light.png`.
- **Master control mobile:** `docs/screenshots/master-control-mobile-light.png`.
- **Theme/size variants:** corresponding `dark` and `tablet` screenshots in the same folder.

## Security and audit implementation

**Status: fully implemented and tested for the new transaction boundaries; platform-wide privileged-operation migration is partial.**

New organization, access, privilege and policy operations commit their control-audit event in the same transaction as the change. Audit failure rolls back the change. PostgreSQL rejects modification/deletion/truncation of control-audit and historical policy rows. A SHA-256 chain covers event contents and previous-event linkage, with a verification script provided.

Security safeguards include same-origin writes, explicit tenant selection for multiple memberships, active membership/access windows, scope checks, separate clinical authorization, verified-email invitations, hashed tokens, fresh MFA and typed confirmation for the protected high-risk controls.

The chain is tamper-evident under normal application database privileges, not immutable against a database owner who can disable triggers and rebuild evidence. A separately controlled database role and external append-only audit anchoring are required for stronger guarantees. Legacy best-effort audit paths and other privileged administration endpoints have not all been converted to atomic control events or step-up MFA.

## Functional testing results

Status: see [the verification record](organization-verification.md) committed with this report. It separates regression tests, database integration, component QA and unresolved production dependencies.

The verification covers the default regression suite, new real-PostgreSQL organization/security acceptance suite, existing real-PostgreSQL admin suite, production compilation, targeted lint, migration replay/deploy and independent backup/restore. Legacy workflow unit tests explicitly isolate the new security boundaries where their mocked database does not provide policy models; the independent PostgreSQL acceptance suite exercises those boundaries without mocking them.

Clerk identity claims and external mail transport are controlled test doubles in database acceptance tests. Those tests do not establish real Clerk MFA enrollment, real email delivery or production object-store access. Component screenshots and viewport interactions are separately identified in `docs/organization-qa-inventory.md`.

## Known limitations and completion classification

**Overall status: partially implemented; not ready for an unqualified enterprise production sign-off.**

| Capability | Classification |
| --- | --- |
| Multi-facility membership uniqueness and tenant-safe organization writes | Fully implemented and tested |
| Professional-title catalogue and custom titles/categories | Fully implemented and tested |
| Department tree, leadership validation and deactivation | Fully implemented and tested |
| Position/rank/appointment history and overlap checks | Fully implemented and tested |
| Hashed invitation acceptance/rejection and verified-email binding | Fully implemented and tested with identity doubles |
| Separate verified clinical grants/revocation | Fully implemented and tested for covered permissions |
| Registered policy engine, revision conflicts and reversible restrictions | Fully implemented and tested for covered paths |
| Explicit master grant and fresh-MFA enforcement | Fully implemented and tested with Clerk claim doubles |
| New hash-chained atomic audit operations | Fully implemented and tested |
| Workforce permissions and patient assignment interface | Partially implemented |
| Overall patient confidentiality and legacy-route coverage | Partially implemented |
| Full Super Administrator specification | Partially implemented |
| Overall document/file/subscription policy coverage | Partially implemented |
| Organization chart and export | Partially implemented: list/CSV, not graphical chart |
| Responsive screens | Partially implemented: component QA, not authenticated production E2E |
| Email delivery, regulatory lookups, storage hardening and critical alerts | Dependent on external integration |
| Infrastructure health/storage monitoring and full integration/AI configuration | Not implemented |
| Custom role-template inheritance, approval-rule designer and reminders | Not implemented |
| Existing-user recruitment search and draft/sent recruitment-state editor | Not implemented |
| Exceptional global clinical-record access procedure | Not implemented; no new master-control clinical bypass |
| Database read-side RLS | Not implemented |
| Authenticated production dashboard screenshots | Not implemented in this session |
| UI-only production dashboard features | None deliberately presented as complete; the separate QA harness uses disclosed fixtures |

## External integrations required

- **Clerk:** production publishable/secret settings, MFA enrollment and real step-up/session-claim verification.
- **Database:** production backup/restore proof, least-privilege runtime role, migration authorization and production monitoring.
- **Email:** configured sender/provider, delivery/bounce handling and real invitation tests.
- **Private object storage:** private evidence/files, scanning, policy-aware retrieval and bounded external URL lifetime.
- **Professional registers:** jurisdiction-specific medical, nursing, laboratory, pharmacy and other regulated verification sources where available.
- **Entitlements/payments:** facility subscriptions and plan entitlements beyond existing independent-doctor subscriptions.
- **Security operations:** privileged-action notifications, external audit anchoring, incident response and database/session hardening.
- **Deployment:** connected Vercel project access to review build configuration, deployment status and production readiness.

## Deployment instructions

Use Node 22.12 or newer and the repository's locked dependencies. Do not provision production master access by editing a browser payload, metadata claim or ordinary staff role.

```bash
npm ci
npx prisma validate
npx prisma generate
npx vitest run
npx tsc --noEmit
```

Before production, create and restore-test a secured backup, inspect the target's migration history and review the SQL. The existing `npm run build` includes `prisma migrate deploy`. The new `vercel.json` overrides Vercel's build command with `scripts/release-safe-build.sh`, which exits before npm/migrations unless an authorized operator supplies the three release attestations below, using Vercel's documented [build-command override](https://vercel.com/docs/project-configuration#buildcommand).

- **MEDIC1905_ORG_RELEASE_APPROVED=1:** approved staging/security review and intentional release authorization.
- **MEDIC1905_ORG_BACKUP_RESTORE_VERIFIED=1:** the target's actual production backup has been independently restored and verified.
- **MEDIC1905_ORG_BACKUP_REFERENCE:** an opaque backup/change-control reference, not a password or database URL.

These settings are operator attestations, not automatic proof of backup integrity. Until they are configured, a Git push to main holds/fails the new Vercel build before it can migrate the database; it does not intentionally replace the previous working deployment.

```bash
# DATABASE_URL/DIRECT_URL must be supplied through secure environment settings.
bash scripts/backup-organization.sh
npx prisma migrate status
# After approved staging tests and the three release attestations:
bash scripts/release-safe-build.sh
```

For disposable database acceptance only:

```bash
ORG_TEST_DATABASE_URL=... npx vitest run src/lib/organization/organization.int.test.ts
TEST_DATABASE_URL=... npx vitest run src/lib/admin/admin.int.test.ts
```

The organization test refuses a database name not ending in `_test`. Never point either suite at production. The existing admin suite must also be given a dedicated disposable database.

Provision a short-lived master grant only for an existing active ADMIN, through an authorized database operator:

```bash
node scripts/provision-super-admin.mts \
  --user-id=EXISTING_ADMIN_UUID \
  --operator="AUTHORIZED_OPERATOR_LABEL" \
  --reason="Approved change record and business justification" \
  --hours=24 \
  --confirmation="PROVISION SUPER ADMIN"
```

The script records operator attribution, expires the grant and still requires fresh Clerk MFA for web actions. It does not promote an ordinary account or enroll MFA. Use `--revoke=true --confirmation="REVOKE SUPER ADMIN"` to revoke an existing grant.

Verify deployed health, both authenticated portals, invitation delivery, patient/document denial paths, dark/light mobile dialogs and audit evidence against staging before production sign-off. No production database migration or successful Vercel deployment is claimed by this report; the source push is deliberately separate from release authorization.

## Backup and rollback instructions

Set `BACKUP_DIR` to an access-controlled encrypted location. The backup script uses the direct database URL when configured, creates a custom-format logical dump, verifies that its archive listing can be read and writes a SHA-256 checksum. Listing verification alone is not a restore test.

```bash
bash scripts/backup-organization.sh
sha256sum --check /SECURED_BACKUP_DIRECTORY/medic1905-TIMESTAMP.dump.sha256
createdb medic1905_restore_test
pg_restore --exit-on-error --no-owner --no-acl \
  --dbname=medic1905_restore_test \
  /SECURED_BACKUP_DIRECTORY/medic1905-TIMESTAMP.dump
DATABASE_URL=RESTORE_TEST_URL node scripts/verify-control-audit.mts
```

Compare critical row counts and the final audit hash between the backup source and restored database. Retain the dump, checksum, restore evidence and application commit ID under the organization's retention policy.

Feature/document restrictions are reversed by publishing a new enabled policy revision, never by deleting policy history. Staff access is restored only after authorized review; clinical privileges are separately reconsidered.

Do not blindly run a destructive down migration. Once users have multiple memberships, reverting to the old global-unique assumption can produce ambiguous facility access. Prefer a forward fix or an explicitly reviewed compatibility release while preserving the new membership model. A full database restore is disaster recovery, requires downtime and reconciliation of all post-backup records, and must not silently discard new signed clinical information. No production backup or production restore was performed here.
