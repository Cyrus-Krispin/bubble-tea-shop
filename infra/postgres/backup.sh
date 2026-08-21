#!/usr/bin/env bash
set -euo pipefail

umask 077

: "${PGHOST:?Set PGHOST to the PostgreSQL host.}"
: "${PGDATABASE:?Set PGDATABASE to the database name.}"
: "${PGUSER:?Set PGUSER to the backup role.}"
: "${BACKUP_DIRECTORY:?Set BACKUP_DIRECTORY to a protected destination.}"

PGPORT="${PGPORT:-5432}"
export PGPORT

for tool in pg_dump pg_restore; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $tool" >&2
    exit 1
  }
done

mkdir -p -- "$BACKUP_DIRECTORY"

database_label="${PGDATABASE//[^A-Za-z0-9_.-]/_}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="$BACKUP_DIRECTORY/${database_label}_${timestamp}.dump"
temporary_path="$(mktemp "$BACKUP_DIRECTORY/.${database_label}_${timestamp}.XXXXXX")"

cleanup() {
  rm -f -- "$temporary_path"
}
trap cleanup EXIT

pg_dump \
  --format=custom \
  --compress=6 \
  --schema=public \
  --no-owner \
  --no-acl \
  --file="$temporary_path"

pg_restore --list "$temporary_path" >/dev/null
mv -- "$temporary_path" "$backup_path"
trap - EXIT

checksum_path="$backup_path.sha256"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$BACKUP_DIRECTORY" && sha256sum "$(basename "$backup_path")") >"$checksum_path"
else
  (cd "$BACKUP_DIRECTORY" && shasum -a 256 "$(basename "$backup_path")") >"$checksum_path"
fi

echo "Backup created: $backup_path"
echo "Checksum created: $checksum_path"
