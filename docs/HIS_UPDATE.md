# Medic1905-update implementation handoff

This update implements an incremental clinical-document and diagnostic-media workstream from the supplied 56-page Medic1905-update.pdf. It is not a claim that the entire multi-hospital specification is production-complete. The existing Next.js, Clerk, Prisma/Postgres, facility permissions, audit, private S3 and notification architecture is retained.

## Changes in this update

- **Patient-linked attachments and images:** template fields now select actual diagnostic-media UUIDs instead of displaying a placeholder. Draft save, submission and finalization verify hospital, patient, deletion state, infection state, MIME compatibility and sensitivity. Required references must be present. Lab, imaging and endoscopy catalogue defaults include supporting-file fields; persisted hospital versions are unchanged. PDF/print exports identify the reference, explicitly state the file is not embedded, and do not disclose storage keys or signed URLs. File access and patient release remain separate.
- **Surgical catalogue completion:** four missing Group E entries are appended: Anesthesia consent, Surgical consent, Procedure-specific informed consent, and Biopsy request and consent. Appending preserves the source codes of existing entries. They use the consent structure with locked disclosure fields, patient/representative and consenting-clinician signatories. Wording and emergency/incapacity handling still require local clinical and legal validation.
- **Protected-record access:** worklists, API searches and patient portfolios exclude other authors' specially protected documents unless the staff member has review permission. Media lists exclude specially protected files for non-reviewers. Workflow actions and package export now enforce the same document-read restriction as direct reads. Media mutation also enforces protected-file access.
- **Template integrity:** both source and hospital-specific locks survive editing. Mandatory fields cannot gain hiding conditions, lose bounds/columns or broaden allowed choices. Mandatory signature alternatives cannot be broadened; locked independent review cannot be disabled. Duplicate section identifiers and inverted numeric bounds are rejected.
- **Concurrency:** template lifecycle actions and draft saves use guarded parent/version writes inside one transaction. A stale save cannot rewrite a submitted/published version. Document autosave is serialized with explicit save/submit, and completing an old save no longer clears the dirty state of newer edits.
- **Diagnostic verification and release:** upload confirmation requires review permission to mark a result VERIFIED/AMENDED. Reviewers can verify an existing preliminary result from the media page. Release supports VERIFIED and AMENDED reports; revocation is available. Returning a report to UNREPORTED/PRELIMINARY automatically revokes patient release. Media updates use hospital-scoped optimistic writes to reject a concurrent delete or status change.
- **Upload safety:** a configured malware scanner must explicitly return CLEAN or INFECTED. Pending, unknown, malformed and unsuccessful results fail closed; requests time out after 30 seconds. No scanner still means NOT_SCANNED, never CLEAN. Failed checksum/scanning or metadata persistence triggers deletion of the unregistered final object. Infected objects cannot be viewed or released. Storage deletion itself can fail and requires operational monitoring.
- **Validation:** numeric fields reject booleans, date-only fields reject calendar-invalid dates, required text cannot be whitespace-only, and tables enforce column counts and reject wholly empty required rows.
- **Dependency maintenance:** compatible transitive security updates are recorded in package-lock.json. No framework major upgrade or schema migration was introduced.

## Deployment and configuration

Deploy the existing project through its normal GitHub/Vercel integration. This patch needs no new database migration or environment variables; it assumes the existing HIS migrations have already been deployed. Do not run database commands against production without reviewing the current schema and backups.

The existing environment must supply Clerk configuration, Postgres URLs and private S3-compatible storage. Configure bucket CORS for presigned uploads and enforce private access, encryption, lifecycle/retention policy and operational logging. The existing optional MALWARE_SCAN_URL integration must return JSON `{"result":"CLEAN"}` or `{"result":"INFECTED"}`; MALWARE_SCAN_TOKEN supplies its configured authentication. When scanning is a hospital requirement, enabling and validating that service is a release gate.

Adopt the newly appended consent templates through the hospital template library. Existing versions do not silently acquire new fields. To add a supporting-file field to an existing published hospital template, create a new version, edit, submit, independently approve if required, and publish. Existing signed records continue pointing to their original version.

## Verification and remaining acceptance work

Local checks on 2026-10-30 used Node 22. Prisma schema validation, TypeScript, ESLint, the optimized Next.js production build and `git diff --check` passed. The full test suite passed 703 tests across 95 files; 44 integration tests in three files were skipped and are not counted as verified. `npm audit` reported zero vulnerabilities after the compatible lockfile updates.

The actual document-editor component was exercised in an isolated Playwright harness at 1440px and 375px using the generated application stylesheet. Attachment selection/save worked; image choices excluded non-images, protected files were excluded from a standard document, and neither viewport had horizontal overflow or browser errors. Identity and API calls in that harness were mocked. The existing live homepage, emergency page and login/signup entry points were checked; directory and hospital routes redirected to authentication. Authenticated clinical journeys and real external services were not verified.

Regression tests cover hospital scoping, protected metadata/actions, mandatory rules, reference validation, scanner failures/cleanup, template lifecycle conflicts, verification/release permissions and autosave sequencing. Component tests use synthetic patients/files and mocked API calls. They do not prove live authentication, real storage uploads, scanner operation or database transaction isolation.

Before clinical use, run the following with synthetic data and separate accounts in a configured staging environment:

- **Tenant isolation:** hospitals A/B cannot list, search, link, download, export or mutate one another's records or staging objects. Repeat with guessed identifiers, patient/caregiver accounts and records/billing staff.
- **Template lifecycle:** independent approve/publish; concurrently submit while saving; concurrently publish/retire; verify prior signed records remain unchanged.
- **Clinical workflow:** mandatory fields/attachments, independent review, authenticated signatures, wet-ink attestation, finalize, export, release, amendment and entered-in-error.
- **Media lifecycle:** real presigned upload, checksum and file signature verification, CLEAN/INFECTED/timeout/unknown scanner responses, verification, release/revoke and deletion conflicts. Review storage logs for cleanup failures.
- **Patient access:** only separately released files and finalized released documents appear; revocation removes access after any already-issued short-lived URL expires.

## Specification boundaries

The repository already contains broad A–P catalogue scaffolds, encounters/admissions, coverage/payer categories, settings, portfolio, audit and operational analytics. Many specialty document types still share generic structures and require field-by-field clinical review. This patch does not introduce full specialty-specific nursing/medication workflows, comprehensive observation/escalation protocols, cross-hospital grants, patient/caregiver delegation, appointment scheduling integrations or complete department-specific permission policy.

Tenant checks are application-level and storage-key-level, not a PostgreSQL row-level-security implementation. A database role with unrestricted SQL access bypasses application checks. Database RLS, composite tenant foreign keys and private-bucket policies require a separate reviewed infrastructure/schema rollout and integration tests; do not describe database-enforced tenant isolation as complete.

HL7/FHIR file acceptance is not an operational interoperability gateway; DICOM upload is not PACS/RIS integration. Device interfaces, accredited/qualified e-signatures, certificate revocation/timestamps, durable queue delivery guarantees, disaster recovery, retention enforcement, independent security review and jurisdiction-specific consent/legal sign-off remain deployment work. Audit writes currently use the existing best-effort logging mechanism, not a transactional tamper-evident clinical audit ledger.

Attachment references are not automatically embedded into exported PDFs or records packages, are not automatically released to patients, and are not a medical-image viewer. The selector shows the latest 200 eligible patient media records. Archived/unavailable references remain visible as identifiers and cannot be newly submitted/finalized until corrected.
