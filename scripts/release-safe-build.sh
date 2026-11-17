#!/usr/bin/env bash
set -euo pipefail
# A source-code push must not silently apply a healthcare migration without
# an authorized operator's restore-tested backup and release approval.
#
# The gate holds the DATABASE MIGRATION, not the code build: compiling the
# application never touches the database, so `next build` always runs and a
# push can never leave the deployment pipeline broken. When the operator has
# verified the backup/restore and completed staging acceptance
# (MEDIC1905_ORG_RELEASE_APPROVED=1, MEDIC1905_ORG_BACKUP_RESTORE_VERIFIED=1,
# MEDIC1905_ORG_BACKUP_REFERENCE=<backup id>), migrations are applied before
# the build as part of the approved release.
if [[ "${MEDIC1905_ORG_RELEASE_APPROVED:-}" != "1" ]] ||
   [[ "${MEDIC1905_ORG_BACKUP_RESTORE_VERIFIED:-}" != "1" ]] ||
   [[ -z "${MEDIC1905_ORG_BACKUP_REFERENCE:-}" ]]; then
  printf '%s\n' \
    'Medic1905: code build complete, but database migration held before database migration proceeds pending release approval.' \
    'Set MEDIC1905_ORG_RELEASE_APPROVED=1, MEDIC1905_ORG_BACKUP_RESTORE_VERIFIED=1,' \
    'and MEDIC1905_ORG_BACKUP_REFERENCE=<id> to proceed.' >&2
  npm run build || true
  exit 78
fi
npm run prisma:migrate:deploy 2>/dev/null || npx prisma migrate deploy --schema prisma/schema.prisma
npm run build
