# Letterheads and document branding

Every facility and every doctor can design its own official letterhead: institutional
information, branding colour, logo, registration/accreditation identifiers, footers,
signature blocks and the printed verification QR code. Letterheads are an integral part
of the clinical documentation engine — documents are issued under the letterhead of the
organisation that produces them, not a detached document-management feature.

## Model

`LetterheadProfile` (`prisma/schema.prisma`) is owned either by a facility
(`facilityId`) or by an individual doctor (`userId`), never both. Key fields:

| Field | Purpose |
| --- | --- |
| `name` | Internal profile name (unique per owner) |
| `department` | Optional: letterheads can be scoped to one department |
| `isDefault` | One default per owner (per department for facilities) |
| `displayName` | Organisation name printed at the top of documents |
| `headerLines` | Up to 5 lines under the organisation name |
| `registrationInfo` | Registration / accreditation identifiers printed on the letterhead |
| `brandColor` | `#RRGGBB` hex used for the header name and rules (default `#0F766E`) |
| `footerText` | Printed in the page footer next to the document number |
| `logoUrl` | HTTPS logo URL |
| `showQr` | Print a verification QR (document number + SHA-256 content hash) on finalized documents |
| `signatureBlocks` | Up to 4 pre-printed signature lines (name, title, registration no., left/right side) |

## Resolution rules

- **Facility documents** (`src/lib/letterheads.ts` → `resolveFacilityLetterhead`):
  a department-specific letterhead wins over the facility default; if none exists the
  plain `HospitalSettings` block is used.
- **Doctor consultation reports** (`resolveDoctorLetterhead`): a doctor's personal
  letterhead is used for reports issued from an independent practice. When a doctor
  works under a hospital, the hospital's letterhead is used — a doctor can never issue
  a document under another facility's registration.
- Letterhead choice only changes the presentation; the issuing organisation recorded
  on the document itself never changes.

## APIs

| Route | Access | Purpose |
| --- | --- | --- |
| `GET/POST /api/facility/his/letterheads` | `MANAGE_HOSPITAL_SETTINGS` | List / create facility letterheads |
| `GET/PATCH/DELETE /api/facility/his/letterheads/[id]` | `MANAGE_HOSPITAL_SETTINGS` | Read / update / delete (tenant-scoped) |
| `GET/POST /api/doctors/me/letterheads` | `DOCTOR` (verified) | List / create personal letterheads |
| `GET/PATCH/DELETE /api/doctors/me/letterheads/[id]` | `DOCTOR` (verified) | Read / update / delete (owner-scoped) |

Creating the first letterhead marks it as the default; promoting another demotes the
rest. Deleting a default promotes the next letterhead for that scope. All changes are
audited (`HIS_LETTERHEAD_CREATED/UPDATED/DELETED`, `DOCTOR_LETTERHEAD_*`).

## UI

- Facility portal: **Letterheads** (`/lab/letterheads`) — designer with live header
  preview, department scoping, signature blocks and brand colour picker.
- Doctor portal: **Letterheads** (`/doctor/letterheads`) — the same designer for
  personal practice letterheads.

## PDF rendering

`src/lib/his/pdf.ts` renders, per letterhead: brand-coloured organisation name and
rules, header lines, registration info, website, address and contact, footer text in
the page footer, signature blocks after the signature section, and — when enabled and
the document is finalized — a QR code encoding
`Medic1905 verify | document <number> | SHA-256 <hash>` so any recipient can check a
printed copy against the finalized content hash.

## Preview PDF

`GET /api/facility/his/letterheads/[id]/preview` and
`GET /api/doctors/me/letterheads/[id]/preview` render a one-page sample document
under the letterhead (department-scoped letterheads such as Radiology preview with
their own department) so branding can be proofed before approval. The designer's
"Preview PDF" button opens it; the sample is clearly labelled and carries no patient
data. Tenant- and owner-scoped like the other letterhead routes.

## Forms builder

Template editing (`/lab/clinical-documents/templates/[id]`) uses a drag-and-drop
builder: drag field types from the palette into any section, drag fields between
sections or to reorder, drag section cards to reorder, and expand any field to edit
its properties (help text, unit, min/max, max length, default, translations). Locked
(legally required) fields cannot be removed, retyped or made optional; the arrow
buttons remain for keyboard editing.
