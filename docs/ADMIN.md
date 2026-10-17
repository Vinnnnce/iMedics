# Admin console

Everything lives under `/admin` and is available only to accounts with the `ADMIN` role (the first admins come from `ADMIN_EMAILS`). All admin APIs are under `/api/admin` and require the same role.

## Pages

| Page | What it is for |
|---|---|
| **Overview** `/admin` | "Needs attention" queue (applications waiting, refunds stuck over a day, failed payments, restricted accounts), key figures, 30-day trends (registrations, appointments, payments), payments by status, recent administrator activity. |
| **Verifications** `/admin/verifications` | The review queue: tabs for awaiting review, changes requested, verified, all; search; filter by doctor or facility; oldest first. |
| **Review** `/admin/verifications/[userId]` | The full file on an applicant (see below) and the decision panel. |
| **Users** `/admin/users` | Searchable, filterable, sortable, paginated directory with CSV export. |
| **Account** `/admin/users/[id]` | Everything about one account plus controls: suspend, ban, restore, grant or remove administrator access. |
| **Payments** `/admin/payments` | Every transaction with filters (status, type, dates, text), totals per currency, CSV export; detail page with timeline and **refund**. |
| **Activity log** `/admin/activity` | The audit trail with category, role and date filters, expandable details and CSV export. |
| **Notices and ads** `/admin/content` | Create, edit, switch on/off and delete notices and advertisements. |

## Reviewing a doctor or facility

The review page shows everything the applicant submitted:

- **Doctors:** full name including middle name, date of birth and age, gender, email, phone, location, MDCN registration number, practising licence number, year of registration, years of experience, specialty, affiliation, biography.
- **Facilities:** organisation name and type, CAC registration number, facility licence number, address, city, state, and the registered representative's name, email and phone.
- **Documents:** each uploaded file is listed with its type, name, size and upload date, and can be previewed in place (PDF or image), opened in a new tab or downloaded. Links are signed and short-lived, and **every open is audit-logged**.
- **Automatic checks:** missing documents and fields, **duplicate** MDCN/licence/CAC/phone numbers or organisation names used by another account (with a link to it), and implausible details (for example registered before age 21, or more years of experience than years since registration).
- **Decision:** approving requires every verification check to be ticked and all required documents present. Requesting changes requires a written reason (preset reasons help). The applicant sees the reason, can fix their documents and resubmit, and the application returns to the queue. Each decision is stored (who, when, reason, checklist) and shown in the review history.
- Applicants and administrators are notified automatically. Notification text stays generic; the reason is only visible after signing in.

Applicants upload their documents during registration (they are sent to private storage once the account exists) and can add, remove and resubmit from the "pending" screen at any time.

## Account controls

- Suspending or banning needs a written reason. It is stored on the account, written to the audit log and shown to the user, who is notified by email and in-app.
- You cannot change your own status or administrator access, and the last active administrator cannot be removed or suspended.
- Doctor and facility roles are granted only through verification. Administrator access is the only role an admin can grant by hand; removing it returns the person to their verified professional role (or patient).

## Privacy

Administrators have **no access to patients' clinical records**: the account page for a patient shows identity, status and activity counts only. Opening an account or a verification file is audit-logged, and so are exports and every change.

## Operations

- Exports (`users`, `payments`, `audit`) respect the filters on the page they came from, cap at 5,000 rows, neutralise spreadsheet formulas, and are themselves audited.
- Admin refunds refund the full amount through the payment gateway and cancel an upcoming appointment or booking paid for. A reason is required.
- The older `/admin/dashboard` URL redirects to `/admin`. The former "AI insights" tab, which showed canned text rather than analysis, was removed; the overview shows real figures instead.
