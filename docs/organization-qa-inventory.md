# Organisation and platform-control QA inventory

This inventory separates database/API acceptance from component-only visual QA. The synthetic QA harness is outside the Next.js application and does not bypass Clerk in production. Screenshots from it must not be described as authenticated production screenshots.

## Backend acceptance

- **Membership selection:** one user, independent permissions in two facilities; missing explicit selection fails; duplicate membership fails.
- **Departments:** create parent and specialty child, assign a head, reject foreign heads and cycles in both API and PostgreSQL, deactivate without deletion.
- **Hierarchy:** create a ranked vacancy, appoint an acting leader, reject overlaps and foreign staff, preserve history.
- **Invitations:** nine professional title scenarios, hashed tokens, existing-account acceptance, one-use token, verified-email binding, wrong-email rejection, expiry and rejection.
- **Patient scope:** limited users cannot list all records; assigned patient access succeeds and revocation fails closed. Unknown patient-resource IDs fail closed for limited/department users.
- **Clinical privileges:** title/appointment alone does not authorize; verified credential alone does not authorize; current separate grant succeeds; revocation denies.
- **Master control:** explicit grant, current MFA, confirmation text, revision conflict, non-admin rejection, reversible facility-targeted policy, download restriction.
- **Audit:** concurrent inserts produce a valid ordered hash chain; updates/deletes to audit and historical policies fail.
- **Recovery:** logical dump, independent restore, record counts and final audit hash comparison, chain validation after restore.

## Component functional and visual checks

Check at 390×844, 768×1024 and 1440×1000, in light and dark themes. Backend mutations are verified independently, not through the fixture-fetch adapter.

| Surface | Interaction and expected state | Evidence |
| --- | --- | --- |
| Organisation | Department/staff/hierarchy/permissions/history tabs select their own views | Visible headings and card contents |
| Workforce | Search and status filter narrow rows; page navigation works when more than 12 staff | Filtered rows and pagination |
| Department dialog | Create/edit fields, parent/head/deputy selection, operating hours and active status | Open dialog fits viewport |
| Invitation dialog | Category changes job-title suggestions; custom category becomes editable | Dialog fields at mobile width |
| Staff dialog | Manager/department/role controls and separate verified-privilege form | No title-to-clinical-privilege shortcut |
| Hierarchy | Vacancy labels, parent titles, appointment dialog, CSV export control | Structured list and dialog |
| Permission matrix | Staff selection updates settings; checkboxes enabled only in custom mode | Matrix fits viewport |
| Master control | Feature/document/security/credentials/audit tabs, policy search, revision dialog | Correct content for each tab |
| Navigation | Mobile drawer opens and closes; desktop labels collapse | No overlap or horizontal page overflow |
| Themes | All primary text, borders, forms and dialogs retain contrast | Light/dark screenshots |
| Exploratory | Empty search result and no verified credential available | Clear empty state; no privileged action possible |
| Exploratory | Closed dialog returns control to the page; long email/hash wraps | No overflow or focus obstruction |

## Not signed off by these checks

Authenticated Clerk end-to-end flows, real invitation delivery, object-store revocation, regulatory register lookups, production migrations and production recovery require their actual configured services. The tests do not establish legal compliance, a completed penetration test, universal coverage of all legacy routes, or production readiness.
