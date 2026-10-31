# Disposable HIS Acceptance

This runbook provisions synthetic staging fixtures, not verified real hospitals or practitioner credentials. It deliberately separates local database integration, live identity/storage checks, and witnessed consent or browser signoff.

## Safety boundaries

- **Isolation:** use a separate disposable PostgreSQL database or Neon branch, Clerk development instance, private test bucket, and staging origin. A database containing patient case numbers outside the `QA-` acceptance namespace is refused.
- **Production refusal:** the CLI refuses `NODE_ENV=production`, `VERCEL_ENV=production`, the existing public production hostname, live Clerk keys, and a database URL identical to its normal `DATABASE_URL`. Host/database allowlists must match exactly.
- **Runtime preflight:** the staging acceptance endpoint requires `HIS_ACCEPTANCE_ENABLED=true`, `HIS_ACCEPTANCE_ENVIRONMENT=staging`, non-production Vercel, normal Clerk authentication, an expiring synthetic user, an unpublished synthetic facility, and administrator permissions. It never bypasses authentication.
- **Account lifetime:** app access expires after 24 hours by default, configurable between 1 and 48 hours. Clerk identities are banned explicitly by the deactivation command; they are not silently hard-deleted. Clinical/audit history is retained.
- **No external communications:** synthetic users retain in-app workflow notifications, but application email and push delivery are suppressed, including outbox retries.
- **No invented consent:** no terms acceptance, practitioner licence, patient wet-ink signature, legal approval or real-patient record is fabricated.
- **Test addresses:** Clerk documents `+clerk_test` addresses and verification code `424242`; its test mode sends no authentication emails. Never enable this on an instance serving actual customers ([Clerk test-email documentation](https://clerk.com/docs/testing/test-emails-and-phones)).
- **Secrets:** use environment configuration or an approved host-scoped credential proxy. Never commit keys, passwords, sessions, signed storage URLs or the generated manifests. The ignored manifest directory uses restrictive file permissions.

## Roster

Each run creates two independent, unpublished synthetic hospitals. Each hospital has an owner, author, independent reviewer, nurse, laboratory scientist, radiologist, records officer, insurance officer, receptionist and patient: 20 distinct users total.

Users are explicitly labelled synthetic and have no practitioner licence numbers. Facility `VERIFIED` flags exist only as isolated test fixtures to exercise the application's real RBAC; they do not represent real-world accreditation.

## Configuration

Use Node 22.12 or newer. Install dependencies and deploy the additive migrations only to the intended isolated database before provisioning.

The CLI reads `.env` when present, but keep acceptance configuration in an untracked staging-only file or secure environment. The following names describe required configuration, not secret values:

```text
HIS_ACCEPTANCE_ENABLED=true
HIS_ACCEPTANCE_ENVIRONMENT=staging
HIS_ACCEPTANCE_BASE_URL=https://YOUR-STAGING-ORIGIN
HIS_ACCEPTANCE_ALLOWED_HOST=YOUR-STAGING-HOST
HIS_ACCEPTANCE_DATABASE_URL=YOUR-DISPOSABLE-POSTGRES-URL
HIS_ACCEPTANCE_DATABASE_HOST=EXACT-DATABASE-HOST
HIS_ACCEPTANCE_DATABASE_NAME=EXACT-DATABASE-NAME
HIS_ACCEPTANCE_STORAGE_HOST=EXACT-PRIVATE-TEST-STORAGE-HOST
HIS_ACCEPTANCE_TTL_HOURS=24
HIS_ACCEPTANCE_RUN_ID=YOUR-6-TO-20-CHAR-LOWERCASE-ALPHANUMERIC-RUN-ID
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR-TEST-INSTANCE-PUBLIC-KEY
CLERK_SECRET_KEY=YOUR-TEST-INSTANCE-SECRET
```

The staging app also needs its own matching database, Clerk, private-storage and malware-scanner configuration. Do not enable acceptance flags on production.

An approved Clerk HTTP credential proxy is supported with `HIS_ACCEPTANCE_CLERK_PROXY=true` and the proxy's `HTTPS_PROXY` environment. In that mode curl receives injected host-scoped authorization; the script does not extract the saved secret. The Backend API must still confirm `environment_type=development` before creating users.

## Commands

```sh
# Read-only plan, no credentials needed and no accounts created.
npm run his:acceptance -- plan

# Only loopback app/database hosts; no Clerk users and no login capability.
npm run his:acceptance -- local

# Actual Clerk TEST users plus synthetic database fixtures.
npm run his:acceptance -- provision

# Confirm the same manifest, database, app origin and Clerk test instance.
npm run his:acceptance -- check

# Live authenticated HTTP/storage/database checks. Short-lived JWTs stay in
# memory, and sessions are revoked in finally. BLOCKED is never treated as PASS.
npm run his:acceptance -- run

# Ban only identities carrying this run's exact metadata/email namespace;
# suspend linked local users/staff and retain clinical/audit history.
npm run his:acceptance -- deactivate
```

Reuse the exact `HIS_ACCEPTANCE_RUN_ID` for check/run/deactivate. Provisioning refuses to overwrite an existing manifest. Partial failures save recovery IDs and attempt to ban every created identity; inspect `rollbackFailures` and rerun deactivation rather than deleting the manifest.

Reports contain only check names, statuses and bounded diagnostic messages, not clinical content or secrets. A report with failures, blocked checks, or incomplete preflight does not establish acceptance.

## Automated and manual coverage

The live runner maps to the PDF's 18 acceptance cases: custom templates; publication/isolation; document workflow; PDF; lab files; radiology linkage; patient release; wrong-patient denial; wrong-hospital denial; executable rejection; consent; amendments; payer history; boards; backend RBAC; image access; audit; existing flows.

Consent ceremonies and authenticated desktop/mobile browser regression remain explicit manual checks in the runner. Executable rejection alone is not a complete malware-penetration test, and protected image access is not DICOM/PACS conformance. The runner has not passed live acceptance until its actual configured results and the manual checklist are reviewed.

Local Vitest integration uses a separate `HIS_TEST_DATABASE_URL` for real PostgreSQL transactions and normal application permission guards, with Clerk identity and notification-provider mocks. It does not substitute for live authentication, object storage, scanning, clinical approval or legal review.

## FHIR scope

Finalized documents can export a FHIR R4 collection containing Patient, DocumentReference and Provenance. PDF links retain normal authentication; the source-content SHA-256 is not falsely presented as a hash of the generated PDF bytes.

This is an export adapter, not a FHIR server, SMART authorization implementation, terminology licence, HL7-v2 gateway or certification. Structure follows [FHIR R4 DocumentReference](https://hl7.org/fhir/R4/documentreference.html) and [FHIR R4 Bundle](https://hl7.org/fhir/R4/bundle.html); independent receiver/profile validation remains required.
