#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:?Set PGHOST to the PostgreSQL host.}"
: "${PGDATABASE:?Set PGDATABASE to the target database name.}"
: "${PGUSER:?Set PGUSER to the restore role.}"
: "${RESTORE_FILE:?Set RESTORE_FILE to a custom-format backup.}"
: "${RESTORE_CONFIRM_DATABASE:?Set RESTORE_CONFIRM_DATABASE to the exact target database name.}"

PGPORT="${PGPORT:-5432}"
export PGPORT

if [[ "$RESTORE_CONFIRM_DATABASE" != "$PGDATABASE" ]]; then
  echo "Restore confirmation does not match PGDATABASE; refusing to modify the database." >&2
  exit 1
fi

if [[ ! -f "$RESTORE_FILE" ]]; then
  echo "Backup file does not exist: $RESTORE_FILE" >&2
  exit 1
fi

for tool in pg_restore psql; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Required command is unavailable: $tool" >&2
    exit 1
  }
done

checksum_path="$RESTORE_FILE.sha256"
if [[ ! -f "$checksum_path" ]]; then
  echo "Checksum file does not exist: $checksum_path" >&2
  exit 1
fi

backup_directory="$(cd "$(dirname "$RESTORE_FILE")" && pwd)"
backup_name="$(basename "$RESTORE_FILE")"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$backup_directory" && sha256sum -c "$(basename "$checksum_path")")
else
  (cd "$backup_directory" && shasum -a 256 --check "$(basename "$checksum_path")")
fi

pg_restore --list "$backup_directory/$backup_name" >/dev/null
psql --no-psqlrc --set=ON_ERROR_STOP=1 --command="SELECT current_database();" >/dev/null

restore_options=(
  --dbname="$PGDATABASE"
  --no-owner
  --no-acl
  --exit-on-error
  --single-transaction
)

has_flyway_history="$(psql --no-psqlrc --tuples-only --no-align --command="
  SELECT to_regclass('public.flyway_schema_history') IS NOT NULL;
")"

if [[ "$has_flyway_history" == "t" ]]; then
  restore_options+=(--clean --if-exists)
else
  public_relation_count="$(psql --no-psqlrc --tuples-only --no-align --command="
    SELECT count(*)
      FROM pg_class object
      JOIN pg_namespace namespace ON namespace.oid = object.relnamespace
     WHERE namespace.nspname = 'public'
       AND object.relkind IN ('r', 'p', 'v', 'm', 'S', 'f');
  ")"
  if [[ "$public_relation_count" != "0" ]]; then
    echo "Target has public relations but no Flyway history; refusing an ambiguous restore." >&2
    exit 1
  fi
  psql --no-psqlrc --set=ON_ERROR_STOP=1 --command="DROP SCHEMA IF EXISTS public CASCADE;" >/dev/null
fi

pg_restore "${restore_options[@]}" "$backup_directory/$backup_name"

psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --command="
  SELECT count(*)
    FROM public.flyway_schema_history
   WHERE success;
" >/dev/null

echo "Restore completed and Flyway history verified for database: $PGDATABASE"
