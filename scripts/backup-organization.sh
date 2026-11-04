#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_URL:?Provide the database connection through the secure environment}"
: "${BACKUP_DIR:?Choose an access-controlled, encrypted backup directory}"
mkdir -p "$BACKUP_DIR"
name="$BACKUP_DIR/medic1905-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --dbname="${DIRECT_URL:-$DATABASE_URL}" --format=custom --no-owner --no-acl --file="$name"
pg_restore --list "$name" >/dev/null
sha256sum "$name" > "$name.sha256"
printf 'Backup created and archive listing verified: %s\n' "$name"
printf 'A listing check is not a restore test. Restore into an isolated *_restore_test database before release.\n'
