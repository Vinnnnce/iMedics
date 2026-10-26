# Hospital Information System (HIS)

Extends the facility portal (`/lab`) into a configurable multi-hospital HIS. Everything reuses the existing Clerk auth, facility membership/permission model (`src/lib/facility-auth.ts`, `src/lib/facility-staff.ts`), audit log, notifications and private S3 storage.

## What is implemented

| Area | Where | Notes |
|---|---|---|
| Hospital settings (branding, letterhead, numbering prefix, language, date format, page size, terminology, optional modules, triage protocol, overdue threshold, retention category) | `/lab/hospital-settings`, `GET/PUT /api/facility/his/settings` | Per facility; every change snapshotted in `hospital_settings_revisions`. |
| System template catalogue, groups A–P (~300 document types) | `src/lib/his/catalogue.ts` | Read-only defaults. Consent (F), lab (G), imaging (H), physiological (I), endoscopy (J), discharge (O), operative (E) have specific structures; others use generic/SOAP scaffolds. Specialty packs (N) carry a "clinical review required" notice. |
| Hospital template library + builder | `/lab/clinical-documents`, `/lab/clinical-documents/templates/[id]`, `/api/facility/his/templates/**` | Adopt (clone) from catalogue, custom, clone, import/export JSON. Section/field builder (text, textarea, number+unit, date, datetime, select, multiselect, checkbox, table, signature/image/attachment placeholders), required flags, conditional sections, translations, signature rules, review requirement, sensitivity, page size, preview. Lifecycle DRAFT → IN_REVIEW → APPROVED → PUBLISHED → RETIRED; published versions are immutable; publishing retires the previous version. Locked (legally required) fields/signatures from the source template cannot be removed or made optional. Optional independent approval. |
| Clinical documents | `/lab/clinical-documents/[id]`, `/api/facility/his/documents/**` | Facility-numbered (`PREFIX-YYYY-NNNNNN`), linked to patient and optionally encounter/admission. Autosaved drafts (author only), submit (required-field validation), clinical review (independent reviewer if configured), signatures, finalize (all required signatures bound to the SHA-256 of the content), amendment (new linked revision; original becomes AMENDED only when the amendment is finalized), release to patient, entered-in-error. Every step in `clinical_document_events` and the audit log. Optimistic concurrency on every transition. |
| Signatures | `document_signatures` | Staff sign as themselves (authenticated electronic). Patient/representative/witness/interpreter wet-ink signatures are recorded as *handwritten, attested by* the staff member who witnessed them. Department-head signature requires `APPROVE_DOCUMENTS`; nobody is shown as head/approver unless they signed. Returning to draft revokes signatures. |
| Print and PDF | `/lab/clinical-documents/[id]/print`, `GET /api/facility/his/documents/[id]/pdf` | pdf-lib + embedded DejaVu Sans (Unicode), letterhead, patient/encounter header, tables, page numbers, document id, signature block with only real signatures, "NOT SIGNED" for unmet ones, watermark on draft/preliminary/superseded/void. |
| Records package | `POST /api/facility/his/patients/[id]/package` | Selected FINAL documents in one PDF with index + SHA-256 manifest; needs `RELEASE_DOCUMENTS` and a patient authorization reference. |
| Patient portfolio | `/lab/patients/[id]` | Demographics, encounters/admissions, documents by group, media, insurance (insurance staff), timeline, access history (`VIEW_AUDIT`). Shows only this facility's records. |
| Identity verification | `POST /api/facility/his/patients/identify` | Exact case number **and** date of birth. No fuzzy name matching; no automatic merges. |
| Diagnostic media | `/lab/media`, `/api/facility/his/media/**` | Format registry (`src/lib/his/media-formats.ts`): PDF, DOC/DOCX, XLS/XLSX, CSV/TXT, JPEG, PNG, TIFF, DICOM, MP4/MOV, WAV/MP3, SCP-ECG, HL7 v2, FHIR JSON/XML; extension + MIME + magic bytes must agree; ZIP/executables refused; per-format size limits. Browser SHA-256 → presigned PUT to a patient-scoped staging key → server re-checks signature, copies to a server-only key, re-hashes and compares, optional malware scan → metadata row. Duplicate detection by checksum. 24 diagnostic categories; therapy records flagged separately. 60-second signed URLs; inline preview only for safe formats. Release to patient only for VERIFIED results. |
| Encounters & queues | `/lab/encounters`, `/api/facility/his/encounters/**` (hospitals) | Care priority (emergency…elective) separate from encounter type and from triage. 17 workflow statuses with guarded transitions and history. Triage categories only from the hospital's configured approved protocol. Dashboards: emergency, urgent, planned, elective, inpatient, outpatient, waiting, all; filters by department, clinician, triage category, payer, status, dates; priority sorting, time since registration/update, overdue flag; auto-refresh. |
| Payer classification | `/lab/insurance`, `/api/facility/his/coverage/**` | 10 payer categories, primary/secondary, provider, masked member number, coverage dates, eligibility + verification history, referral/preauth, authorization number/expiry, claim status, billing responsibility, co-pay/out-of-pocket. Classifications are ended, never overwritten; encounters snapshot the payer that applied. |
| Analytics | `/lab/his-analytics` (`VIEW_ANALYTICS`) | Aggregates only: volumes by department/type/priority, admissions/discharges, document status/group, unsigned documents, creation→finalization time, payer mix, media categories, template usage. |
| Patient portal | `/patient/documents`, `/api/patient/clinical-documents/**`, `/api/patient/media/[id]` | Only FINAL/AMENDED documents explicitly released, and released media; PDF download; audited. |
| Notifications | `CLINICAL_DOCUMENT` type | Documents awaiting review/signature (staff) and released documents (patient). Messages contain no clinical detail. |

## Roles and permissions

New facility roles: `RADIOLOGIST`, `DIAGNOSTIC_SPECIALIST`, `PHARMACIST`, `SURGEON`, `DEPARTMENT_HEAD`, `MEDICAL_RECORDS_OFFICER`, `BILLING_OFFICER`, `INSURANCE_OFFICER`. New permissions: `AUTHOR_DOCUMENTS`, `REVIEW_DOCUMENTS`, `SIGN_DOCUMENTS`, `APPROVE_DOCUMENTS`, `RELEASE_DOCUMENTS`, `MANAGE_HOSPITAL_SETTINGS`, `MANAGE_ENCOUNTERS`, `MANAGE_INSURANCE`, `UPLOAD_MEDIA`, `VIEW_ANALYTICS` (mapping in `src/lib/facility-staff.ts`). All enforcement is server-side (`requireHisAccess`); pages only shape navigation. Template groups are limited by organization type (labs: G/F; diagnostic centres: F/H/I/J; hospitals: all). Specially protected documents are visible only to their author and reviewers.

**Tenant isolation:** every query filters by the caller's facility; patient-level actions require an existing care relationship (`assertPatientLinked`); foreign ids return 404. Storage keys are facility+patient scoped and never exposed.

## Database

Migration `prisma/migrations/20261026120000_his_foundations` (additive: new enums/tables, new enum values on `FacilityStaffRole` and `NotificationType`). Apply with `npm run db:deploy`. Rollback: the migration only adds objects; to roll back the app, redeploy the previous commit (new tables are ignored). To remove the schema, drop the new tables/types manually after exporting data — enum values added to existing types cannot be dropped in Postgres without recreating the type.

## Configuration

- `MALWARE_SCAN_URL` / `MALWARE_SCAN_TOKEN` (optional): scanner webhook; otherwise uploads are recorded `NOT_SCANNED`.
- Existing S3 variables are required for media uploads. Add a lifecycle rule deleting objects under `medical-media/staging/` older than 1 day.
- Fonts in `assets/fonts` are bundled for PDF rendering (`outputFileTracingIncludes` in `next.config.ts`).

## How to use

**Hospital administrators:** set branding, prefix and triage protocol in *Hospital settings* → in *Medical documents* adopt catalogue templates (or create/import) → edit sections/fields/signatures → Submit → a second authorized person Approves (if independent approval is on) → Publish. To change a published template, click *New version*. Retire obsolete templates; historical documents stay intact.

**Doctors, nurses, lab scientists, radiologists:** register or find the encounter → *New document* → choose a published template → fill the draft (autosaves) → Submit → reviewer *Verify* (if required) → each required signatory records a signature (patients/witnesses: record their wet-ink signature with the attestation) → *Finalize*. Corrections: *Amend* (reason required). Upload images/videos/reports in *Diagnostic media* and set report status; release verified items to the patient.

**Patients:** open *Hospital documents* in the patient menu to view and download released reports and files.

## Pending / not implemented

- DICOM viewer, PACS, modality worklists (DICOM files are stored and downloadable; viewer integration requires a PACS/viewer service).
- Resumable multipart uploads for very large studies (current single PUT, per-format limits up to 500 MB).
- HL7 v2 / FHIR APIs, LOINC/SNOMED CT/UCUM terminology services (fields for LOINC codes and UCUM units exist in lab templates; ICD-10 already exists platform-wide).
- Qualified/advanced electronic signatures (PKI); patient self-signing in the portal.
- Formularies, interaction checking and pharmacy integration; clinical scores; escalation rules for overdue observations; insurance eligibility/claims APIs.
- Database-level row security (isolation is enforced in the application layer); retention-driven deletion workflows; breach-investigation export tooling.
- Catalogue wording has not been clinically or legally reviewed — templates must be reviewed by each hospital before operational use. No legal-compliance claim is made.
