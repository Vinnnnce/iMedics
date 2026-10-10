# Data handling notes

Engineering notes on how Medic1905 treats personal and health data. This is not legal advice: have a qualified
adviser confirm what applies to you (for example Nigeria's NDPA and any health-sector rules) before going live
with real patients.

## What is stored, and where

| Data | Where | Notes |
|---|---|---|
| Sign-in identity (email, password, MFA) | Clerk | We store only the Clerk id, email and display name. |
| Account role, status, terms acceptance | Neon `users` | Role and status are set only by server code. |
| Patient record, histories, consultations, prescriptions, lab results, notes, chat | Neon | Patient-linked tables point at `patients`, never at accounts. |
| Lab files, verification documents | Private object storage | Random keys; never public; signed URLs expire in 60 seconds. |
| Audit trail | Neon `audit_logs` | Append-only from the app's point of view. |

Registration answers are **not** copied into Clerk metadata.

## Who can see patient data

- **Doctors:** patients assigned to them (read for any assignment, write only while admitted).
- **Patients:** their own record. AI text only after a doctor approves it; clinical notes only if shared.
- **Lab staff:** the minimum to identify a patient (name, sex, age) for orders and case-number lookups, and only results they uploaded.
- **Admins:** account data and verification documents; **no** patient records.

## Audit

Logged: patient and history views, consultation views, lab result views and file downloads, lab patient lookups,
AI requests and reviews, admin actions, registration. Not logged: chat message reads, individual list searches.

## AI and third parties

Lab analysis sends the model only age, sex, the test values and units, and a short panel label. No name, case
number or contact detail is sent. Output is stored for doctor review before any patient can see it.

## Open decisions (owner to decide before production)

1. **Retention:** how long records, chat and audit logs are kept, and how deletion requests are handled. Records are soft-deleted (`deletedAt`) today.
2. **Consent records:** terms acceptance and version are stored; there is no separate consent for AI processing or data sharing.
3. **Encryption:** data is encrypted in transit and by the hosting providers at rest; there is no application-level field encryption.
4. **Breach process:** no incident-response runbook yet.
5. **Backups:** rely on Neon's point-in-time recovery; confirm retention and region against your requirements.
