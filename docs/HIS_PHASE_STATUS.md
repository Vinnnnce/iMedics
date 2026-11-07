# HIS Implementation Phase Status

This matrix follows the implementation phases in the user-supplied Medic1905-update.pdf. It distinguishes implemented code, verified local behavior, external acceptance prerequisites, and substantial functionality still to build; it is not a claim that the complete 56-page specification is finished.

## Phase delivery matrix

| Phase | Implemented or advanced | Still required |
|---|---|---|
| Existing-system audit | Reviewed Next.js, Clerk, Prisma/PostgreSQL, private storage, clinical modules, catalogue, workflows and PDF requirements; recorded boundaries and acceptance checks. | Clinical and legal approval of operational policies and specialty content. |
| Hospital foundation | Settings/revisions, A–P catalogue/versioning, independent publication, RBAC and patient linkage. Added DB write guards for tenant/patient/template links, immutable identities and expiring synthetic accounts. | Separate database roles/RLS or equivalent tenant-read enforcement, complete department policy and deployed bucket-policy validation. Write triggers are not RLS. |
| Clinical documentation | Save/review/sign/finalize/release/amend/void and PDF; version/hash signatures. Added transactional audit/outbox, finalized-content database immutability and CLEAN-only attachment submission/finalization. Added the nursing workstream (structured observations with registry-fixed units and clinical timestamps, care-task lifecycle, shift handovers) and the pharmacy medication-order workflow (draft → submitted → reviewed → dispensed → completed, prescriber/pharmacy permission gates, allergy visibility). Added MAR-style administration recording (attributed, append-only GIVEN/REFUSED/HELD/NOT_GIVEN entries per order), the facility formulary, hospital-configured advisory interaction/allergy alerts on order creation, and the e-prescribing outbox (delivery only with a configured endpoint). | Complete field-by-field forms across generic groups, approved escalation protocols, cross-hospital grants/caregiver delegation and witnessed consent. |
| Medical files | Private upload/confirm, checksum/format inspection, scanning, verification/release. Added two-file concurrency, patient/metadata snapshots, retry/stale-list protection and CLEAN-only content access. Resumable multipart sessions now transfer files at/above the configured threshold with server-verified part lists, retry-resume, facility storage quotas and expired-session cleanup. | Very-large-study performance at scale, production scanner/storage tests, DICOM/PACS and diagnostic viewer integration. |
| Payer and encounters | Categories/history, verification, encounter payer snapshots, emergency/planned boards, filters and triage settings. Added historical payer immutability, registration serialization and clinical-only race-safe critical acknowledgements. | Payer eligibility/authorization/claims integrations, operational load acceptance and approved triage/escalation protocols. |
| Specialty/interoperability | All 18 specialty defaults now have specialty-specific fields and independent review. Added protected FHIR R4 Patient/DocumentReference/Provenance export; retained existing analytics and lab-critical escalation. | Clinical approval, receiver/profile FHIR validation, FHIR/SMART server features, HL7 v2/PACS integration and licensed terminology governance. No certification asserted. |
| Verification and release | Two-hospital/20-user fixtures, isolated live runner, real-PostgreSQL HIS suite and CI PostgreSQL services. The existing 44 integration tests now run rather than skip. | Connected Clerk TEST/staging DB/storage/scanner, actual live checks, manual consent/browser signoff, backup restore/rollback drill and security/clinical release approval. |

## PDF acceptance cases

- **Custom templates and publication:** real-DB create, independent approve/publish and cross-hospital denial pass; live Clerk run remains pending.
- **Clinical workflow and PDF:** save/submit/review/sign/finalize and real PDF bytes pass integration; self-review/unsigned finalization are denied.
- **Laboratory and radiology uploads:** format/scanner unit checks and DB patient/namespace guards pass. Actual private bucket/scanner acceptance remains blocked.
- **Released patient records:** correct-patient release/download and other-patient/other-hospital denial pass integration with mocked identity.
- **Unsafe upload:** format, scanner-error, quarantine and CLEAN requirements are tested. Executable rejection is not a complete live malware-penetration test.
- **Consent:** authenticated synthetic-author account, exact template version, timestamp and hash are checked. Witnessed patient/guardian/legal consent is not fabricated and remains manual.
- **Amendment:** original content/hash are preserved and direct finalized-content overwrite is rejected in SQL.
- **Insurance history:** used coverage cannot be edited, verification/end remain possible, and encounter payer snapshots are immutable.
- **Boards and RBAC:** real-DB emergency/planned filtering and receptionist denial for authoring/critical acknowledgements pass.
- **Images/video:** namespace and patient/facility linkage are checked. Real playback, large-file transfer and private storage remain pending.
- **Nursing and pharmacy:** observation recording with registry-fixed units, guarded care-task transitions, handover task attachment, and the medication-order workflow (submit/review/dispense permission gates, prescriber-only cancel, invalid transitions denied) pass route and domain tests. MAR administration recording (append-only attributed entries, receptionist denial), advisory interaction/allergy alerts and formulary matching on order creation, formulary/rule management, and the e-prescribing outbox (PENDING without an endpoint, endpointConfigured honesty) pass route tests. Alerts are advisory and rules are hospital-configured; no dosing recommendation, clinical rule invention or external e-prescribing transmission is implemented or claimed; live authenticated acceptance remains pending.
- **Existing features:** all automated suites, including registration/admin/payment integration, run. Authenticated desktop/mobile regression remains separate.

## Boundaries

The deployed application change is [f2a7dbf](https://github.com/Vinnnnce/iMedics/commit/f2a7dbf1b9f3e69edd970ebf48e582f26611ee0c), with [successful CI](https://github.com/Vinnnnce/iMedics/actions/runs/41131021704) and Vercel rollout. Expanded local verification passed 969 tests across 118 files, including real-PostgreSQL integration, 29 navigation regressions, 42 existing JSX checks newly included by the corrected collection pattern, the 29-test nursing/pharmacy domain and route suite, and the 24-test MAR/formulary/interaction-alerts/outbox suite. The nursing/pharmacy workstream (additive migration `20261101000000_his_nursing_pharmacy`) and the MAR/formulary/interaction-checking/e-prescribing workstream (additive migration `20261101010000_his_mar_formulary_eprescribing`) are implemented and locally verified; the nursing/pharmacy workstream is pushed, and the MAR workstream follows in this repository update — neither is yet verified deployed to production. Live anonymous homepage checks no longer reproduce the protected-link prefetch CORS issue; protected links reach sign-in through document navigation. Clerk-origin CSP console messages remain on authentication pages, and no authenticated live acceptance pass is claimed.

Database-only fixtures cannot authenticate to Clerk and are not live disposable accounts. Privileged SQL read access is not tenant-isolated by these write triggers.

NOT_SCANNED is not CLEAN. Enabling a scanner later does not retroactively certify prior objects without a rescan; unscanned content remains quarantined.

No treatment thresholds, drug doses, legal certification or practitioner credentials are invented. The FHIR export is not a complete server, HL7/PACS gateway or certification.

Connection-dependent checks and the remaining code areas above prevent full-PDF signoff. Use [Disposable HIS Acceptance](HIS_ACCEPTANCE.md) for the next isolated live run.
