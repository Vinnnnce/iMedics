# Organisation and control-centre verification

All database evidence below comes from disposable local PostgreSQL databases containing synthetic identities and patients. Nothing in this record establishes a production backup, real Clerk MFA enrollment, real invitation delivery or a completed security/compliance sign-off.

## Automated results

| Check | Observed result |
| --- | --- |
| Default Vitest regression suite | 1,049 passed; 95 integration cases skipped in that invocation; 131 files passed, 6 skipped |
| New PostgreSQL organization/security suite, run separately | 30 passed |
| Existing PostgreSQL admin suite, run separately | 16 passed |
| Release-gate denial tests | 4 passed; also included in default regression count |
| TypeScript | `tsc --noEmit` passed |
| Targeted lint for the new organization/policy/control implementation | Passed with no warnings/errors |
| Approved local production build path | Passed Prisma generation, migration deployment and optimized Next.js compilation/type checking |
| Vercel release gate without approval/backup attestations | Exits 78 before invoking npm or migrations |
| Existing migration-history replay plus new migration | Passed on a fresh disposable database |
| Upgrade of populated pre-change schema | 22 users, 4 patients and 8 facility profiles retained identical row-content hashes |
| Backup/operator tooling | Time-limited master grant provisioned and revoked in the disposable database; both audited |
| Independent full backup restore | Matching 8 users, 16 staff, 1 patient, 36 control-audit events and final chain hash |
| Restored audit-chain verification | 36 events; 0 invalid |
| Component viewport/theme coverage | 390×844, 768×1024, 1440×1000; light and dark; disclosed synthetic fixtures |

The 30 new and 16 existing database cases are part of the 95 skipped by the default invocation, then run separately with disposable database URLs. The remaining 49 integration cases were not run here: HIS safety (20), legal evidence (1), payment flow (18) and user registration (10). Do not describe the entire repository's integration suite as passed.

## Security cases exercised

- **Memberships:** one account in two tenants, explicit selection, different roles/permissions and duplicate rejection.
- **Tenant boundaries:** foreign department heads, foreign staff updates and appointments, immutable tenant identity, database cross-credential membership rejection.
- **Hierarchy:** department cycles, subordinate departments, ranked positions, acting appointments and overlapping appointments; suspended memberships no longer fill a current position while appointment history remains intact.
- **Invitations:** medical, nursing, laboratory, radiology, diagnostic, accountant, cashier, legal and media job titles; hashed tokens, verified account binding, single acceptance, rejection, wrong/unverified email and expiry.
- **Patient access:** unfiltered collection denial for limited staff, explicit assignment, patient-specific access and immediate revocation.
- **Clinical authority:** no authority from title, appointment or certificate alone; current verified credential plus explicit grant; grant/revoke APIs; revoked grants denied.
- **Professional review:** confirmed master credential-review API changes verification status without automatically granting a clinical privilege.
- **Privileged administration:** missing grant, stale/missing second factor, wrong confirmation, ordinary ADMIN rejection, and protected account controls on both legacy/current endpoints.
- **Policies:** facility-targeted disabling, unaffected other tenant, stale revision rejection, new enabled revision, document export/download restrictions.
- **Evidence:** concurrent hash-chain insertion, full chain recomputation and rejected audit/policy updates/deletes.

Clerk claims, notification transport and email delivery are intentionally controlled test boundaries. The authorization, database transactions, constraints, policy evaluator, privilege checks and audit triggers are real implementations in these tests.

## Recovery evidence

The full restore was made into an independent disposable database, not over the source. Its final audit hash matched the source at the time of backup:

```text
c0c049f2030a586ced93f04c7d7f9d15bf501364511919b1cd7c3163e3694af0
```

The populated-upgrade check compared ordered complete-row JSON hashes before and after migration:

```text
users:             22  41ea09f47bd5d92217798ebc9dd808186b484d84c1d66384b6dd8d2c1e45c4d9
patients:           4  2185ab677937125e2c364f4509e5988ea87fb6490977ed70e8cff83dcbaf5ee9
facility profiles:  8  23cdb9913972561f3acb58b3d239af6324627c3c499d351aec1aea6fe9c16109
```

These tests do not include a representative historical signed-clinical-record upgrade fixture. That and the transition of existing staff to explicit clinical grants remain required staging checks.

## Visual evidence and limitations

Screenshots in `docs/screenshots/organization-*` and `docs/screenshots/master-*` are component-level browser captures, not design mockups or signed-in production sessions. The existing isolated QA harness imports the real production components and reads synthetic response fixtures exported by the real database tests; it does not pretend that fixture-backed browser form submissions test real server mutations.

The screenshots visibly disclose their provenance. Backend mutations are tested separately, and authenticated Clerk flows, all production navigation, external file access, delivery and complete workflow coverage remain pending.

The production release is deliberately held by `scripts/release-safe-build.sh` until an authorized operator has supplied release approval, production restore verification and a backup reference. The source-code push must not be mistaken for deployment or for completion of the full enterprise specification.
