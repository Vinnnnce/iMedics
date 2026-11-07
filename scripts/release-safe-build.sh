#!/usr/bin/env bash
set -euo pipefail
# A source-code push must not silently apply a healthcare migration without
# an authorized operator's restore-tested backup and release approval.
if [[ "${MEDIC1905_ORG_RELEASE_APPROVED:-}" != "1" ]] ||
   [[ "${MEDIC1905_ORG_BACKUP_RESTORE_VERIFIED:-}" != "1" ]] ||
   [[ -z "${MEDIC1905_ORG_BACKUP_REFERENCE:-}" ]]; then
  printf '%s\n' \
    'Medic1905 release held before database migration.' \
    'An authorized operator must verify the backup/restore and complete staging acceptance.' \
    'Then set MEDIC1905_ORG_RELEASE_APPROVED=1, MEDIC1905_ORG_BACKUP_RESTORE_VERIFIED=1 and MEDIC1905_ORG_BACKUP_REFERENCE in the target deployment environment.' >&2
  exit 78
fi
npm run build
