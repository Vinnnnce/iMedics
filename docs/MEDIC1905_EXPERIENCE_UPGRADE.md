# Medic1905 experience upgrade

This delivery changes the existing Next.js application directly and preserves Clerk, Prisma, the current account records, provider-verification workflows and clinical integrations. Nigeria is the first legal-review jurisdiction; the new legal text remains a draft and is not represented as an approved agreement.

## Existing implementation inspected

- Frontend: Next.js App Router, React, Tailwind 4, existing shadcn/Base UI and Radix components.
- Authentication: Clerk hosted identity, hash-routed SignIn/SignUp, the existing post-signup account-selection and professional-verification wizard, database-authoritative account roles and server page/API guards.
- Backend: Prisma/PostgreSQL, facility membership and permission resolution, notifications, S3 document verification and existing clinical/payment integrations.
- Experience: shared Navbar, theme provider, existing patient/doctor/facility menus and bottom navigation, public website, older legal pages and the previously unused account-specific policy content.
- Deployment: the existing `npm run build` runs `prisma migrate deploy`, `prisma generate` and `next build`, in that order. This sequence is preserved.

## Implemented in this change

| Area | Implementation | Status and boundaries |
| --- | --- | --- |
| Sign-in and sign-up | Shared responsive AuthLayout, independent mobile composition, full-width Clerk inputs/buttons, corrected inner widths, no application navbar around auth pages, callback redirection | Implemented. Identity remains Clerk; no replacement or mocked production login |
| Healthcare animation | Doctor, patient, hospital, lab, diagnostics, pharmacy, nursing and records nodes around connected intelligence; SVG heartbeat/data connections; pause control; reduced-motion and static fallback | Implemented with CSS/SVG and existing icons; no heavy animation dependency |
| Six account types | Existing patient, doctor, hospital, laboratory, diagnostic-centre and pharmacy wizard retained; account-specific policy review, country and preferred-language fields added | Implemented over existing verification flow. Professional accounts remain pending until approved |
| Minimal registration | Basic patient registration no longer requests or persists blood group, genotype, allergies, chronic conditions or emergency-contact health-history fields | Implemented. Clinical records remain in their protected workflows; old tab drafts are filtered before restoration |
| Privacy, terms and cookies | Shared policy reader, six audience schedules, master document content, contents navigation, scroll progress, draft/version/effective-date metadata, improved conditional AI/security/transfer wording | Implemented as legal drafts, not approved published policies |
| Cookie preferences | Accept all, reject optional, granular categories, save, reopen and withdraw; default denial; malformed/expired/future-storage checks; preference-gated theme/sidebar persistence | Functional. No analytics, advertising or performance tracker is installed by this upgrade |
| Policy history | Immutable version snapshots and self-scoped dated receipts; separate draft acknowledgement vs published acceptance; legacy version/date displayed honestly where exact old text was not captured | Implemented. Production requires migration; legacy exact text is not invented |
| Material-change review | Self-scoped GET/POST API, explicit acceptance, stale-version rejection, published-release review notice and acceptance history | Implemented and tested with synthetic approved-release fixtures. Disabled for the current draft |
| Onboarding tours | Public ten-step tour, real permission-filtered workspace links, patient records/appointments priority, doctor consultations/prescriptions priority, facility staff/settings priority, progress/skip/finish/restart persistence | Implemented for active completed accounts. Patient tour starts on the first dashboard after registration; professional/facility clinical tours start after verification, not while access is pending |
| Shared navbar | Workspace/facility identity, current-page context, search, real-data notifications, Help & Tour, theme toggle, profile/settings/history menu, existing secure sign-out, active links and collapsible sidebar | Implemented across routes using the shared Navbar |
| Mobile navigation | Compact top bar, accessible Sheet drawer, Escape handling, profile-menu access to search/tour, 44px primary touch controls, bottom navigation retained | Implemented and component-tested at small widths |
| Facility availability | Facility-kind and role-permission filtering; missing facility context fails closed; configured hospital enabledModules filter relevant navigation and tour steps | Implemented for presentation. Facilities without a settings record retain legacy module availability; server permissions remain the security boundary |
| Dark/light themes | Charcoal surface tokens replace the authenticated dark-blue foundation; existing light tokens and public branding retained | Implemented centrally. Not every existing clinical screen received a screenshot-level visual audit |

## Security and data integrity

- Authentication and role/record authorisation still use existing server-side guards. Changing a client account type does not grant doctor or administrator permissions.
- New tour and policy APIs derive identity from `requireUser`, not request parameters. Same-origin write protection remains in place.
- Registration and its legal receipt are recorded in one database transaction. New users are never silently marked as accepting a published agreement while the release is a draft.
- PostgreSQL triggers reject UPDATE and DELETE on policy snapshots and receipts. Unique keys de-duplicate version receipts and per-workspace tour state. Foreign keys preserve evidence ownership.
- Historical policy text cannot be overwritten under an existing version. New text requires a new version identifier.
- No real patient information is included in screenshots, tour examples or local integration fixtures. The application contains no testing authentication bypass.
- Sign-out retains the existing Clerk session termination, push-subscription cleanup and public-home redirect.
- Existing users receive no guessed country value from the additive migration. Country remains nullable until supplied.
- Append-only evidence requires an operator-approved retention/anonymisation procedure. Do not bypass evidence triggers casually to satisfy a deletion request.

## Database changes

Migration: `prisma/migrations/20261111090000_experience_policy_tours/migration.sql`.

- `users.country`: nullable new account metadata.
- `lab_staff_profiles.country`: nullable facility-country metadata; registration also records the supplied country on the existing patient profile field.
- `policy_snapshots`: version, publication status, effective date, exact JSON content and creation timestamp.
- `policy_receipts`: user, version, account type, kind and server timestamp; kinds distinguish `ACCEPTANCE` from `DRAFT_ACKNOWLEDGEMENT`.
- `product_tours`: user/workspace key, NOT_STARTED/IN_PROGRESS/COMPLETED/SKIPPED status, step and update timestamp.
- New indexes, unique constraints, foreign keys, value checks and append-only legal-evidence triggers.

The migration is additive and does not delete or rewrite clinical data. All migration testing used disposable local PostgreSQL, not the production database.

Use a fresh disposable test database after editing draft policy text. Reusing a database that already stored different text under the same version correctly triggers the immutable-version guard; do not disable that protection or overwrite snapshots.

## Components and files

- New: `components/auth/auth-layout.tsx`, `components/auth/healthcare-animation.tsx`.
- New: `components/legal/policy-reader.tsx`, `cookie-preferences.tsx`, `policy-consent-notice.tsx`; `app/legal/history/page.tsx`.
- New: `components/onboarding/website-tour.tsx`; `lib/tour.ts`, `lib/cookie-consent.ts`, `lib/navigation-features.ts`.
- New: `lib/legal/release.ts`, `lib/legal/record.ts`; `api/me/policies` and `api/me/tour`.
- Updated: auth pages, registration wizard and API, shared Navbar, notification control, root layout, globals/experience CSS, theme provider, sidebar persistence, Me identity projection and public directory matchers.
- Updated: legal master content and legal/registration tests; new consent, evidence, identity-isolation, published-release, tour and feature-availability tests.
- Context: `PRODUCT.md`, `DESIGN.md`, `FLOWS.md` and this delivery document.

No project dependencies were added or removed. Temporary browser, font and disposable PostgreSQL tools used for QA are not application dependencies and are not shipped.

## Testing and screenshots

The final verified results and screenshot inventory are recorded in `docs/MEDIC1905_QA.md`. Screenshots render implemented source components, but the dashboard captures use synthetic identity/API fixtures and are explicitly labelled as component QA, not live authenticated production dashboards.

Full production acceptance still requires real test accounts and the operator's Clerk, database, email, storage and deployment configuration. Do not infer that SMS verification, MFA enforcement, security alerts or account recovery delivery were tested merely because their provider UI is present.

## Legal release procedure

- Keep `POLICY_RELEASE.status` as `DRAFT` and `effectiveDate` null during review. The current release is `2026-11.1-draft`.
- Qualified Nigerian legal counsel must confirm the operator entity/address, privacy contact, actual controller/processor roles, provider contracts, retention schedules, national healthcare/professional rules, consumer terms, children/guardian procedures and actual countries/vendors.
- Review the [Nigeria Data Protection Act 2023](https://ndpc.gov.ng/document/nigeria-data-protection-act-2023/) and applicable national obligations. Assess GDPR only where its scope applies, including lawful bases, special-category conditions, rights and transfers under the [official GDPR text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).
- Use a NEW version for any approved release. Resolve operator placeholders, set PUBLISHED and a real effective date only after documented legal approval. Never relabel an existing stored draft snapshot as approved.
- The next published version will request explicit review for accounts without an ACCEPTANCE receipt. The notice does not interrupt existing care; a legally required hard gate would need separate product/legal approval.
- Add jurisdictions and translations only after relevant review. A language preference is currently saved metadata, not a promise of a translated interface.

## Deployment and rollback

Use Node 22.12 or newer, the existing `.env.example` contract and the operator's securely managed environment variables. Do not paste Clerk, database, S3 or GitHub secrets into source code or chat.

```sh
npm ci
npm run lint
npm run typecheck
# Point these only at disposable test databases:
TEST_DATABASE_URL=... HIS_TEST_DATABASE_URL=... npm test
# On an approved staging environment, then production:
npm run build
```

The existing build applies all pending Prisma migrations before generating the client and building Next.js. Before deploying, back up PostgreSQL, inspect `prisma migrate status`, rehearse on staging, ensure the database role can create the new tables/functions/triggers, and keep existing runtime secret values unchanged. A successful Git push is not proof of a successful Vercel build or live migration.

After deployment, test real patient registration, verification email, login/recovery, doctor/facility pending approval, staff permissions, correct redirects, tour completion/restart, policy history, cookie withdrawal, theme persistence and sign-out. Confirm no non-essential external integration loads before consent. Review real-device keyboard behaviour and portrait/landscape layouts.

For application rollback, redeploy the previous application commit while leaving the additive tables and legal evidence intact. Do not drop immutable evidence tables or rewrite acceptance history as a rollback shortcut. Any database rollback must be reviewed against recorded legal evidence and current clinical operations.

## Remaining limitations

- This is not an implementation of a new identity provider. Phone/username sign-in, SMS verification, password policy, bot protection, session duration, MFA enrolment/enforcement, provider lockouts, suspicious-login alerts and device/recovery capabilities depend on the existing Clerk instance settings and plan. They were not enabled or verified against the operator's identity administration.
- Existing staff invitations, subscriptions, billing and provider-document verification are reused, not rebuilt. No claim is made that every external workflow was exercised end to end.
- Country metadata is captured for the account, patient profile and facility profile, but the existing address/state and professional-verification flows remain Nigeria-oriented. This is not a completed international registration or localisation rollout.
- Professional and facility clinical onboarding cannot run before verification without showing inaccessible modules. Pending applicants retain the existing verification screen; the role-specific workspace tour begins after activation.
- Tour spotlighting applies to links currently present and visible. Mobile users can open the contextual real-module link without exposing unauthorised features; hidden drawer links are not forcibly opened under a modal focus trap.
- Module visibility is not subscription enforcement. Existing server permissions and clinical record guards remain mandatory; this upgrade does not introduce a universal subscription/paywall authorisation engine.
- All eight dashboard families inherit shared theme/navigation changes, but a complete device-by-device audit of every existing table, dialog, chart, nursing and administration screen remains outstanding.
- The policies require qualified legal approval and verified operational facts. They are deliberately not universally compliant, final or legally approved documents.
