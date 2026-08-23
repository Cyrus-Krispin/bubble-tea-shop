# PostgreSQL Backup and Restore

Use the database provider's point-in-time recovery and automated backup service for production.
The scripts in `infra/postgres/` provide an additional encrypted-off-host logical backup of the
Spring-owned `public` schema and a repeatable restore procedure. Supabase Auth and platform schemas
remain covered by the database provider's native backup and point-in-time recovery. A backup is not
considered usable until both layers have a documented recovery path and a restore drill succeeds.

## Recovery objectives

Choose and record the production recovery point objective (RPO) and recovery time objective (RTO)
before launch. The initial operating target is:

- RPO: no more than 24 hours of data loss, with provider point-in-time recovery preferred.
- RTO: restore service within four hours of declaring a database recovery incident.
- Retention: 7 daily, 4 weekly, and 12 monthly logical backups, subject to applicable privacy and
  financial-record retention requirements.

These are operating targets, not guarantees. Revisit them after measuring real backup size and
restore duration.

## Credentials and storage

Use a dedicated PostgreSQL backup role with the minimum read access required. Supply credentials
through `PGPASSWORD` or a protected PostgreSQL password file; never place a password in a command,
script, repository file, or backup filename. The destination must be encrypted, access-controlled,
versioned or object-locked, and outside the primary database failure domain.

Required environment variables are `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and
`BACKUP_DIRECTORY`. `PGPASSWORD` may also be required by the server.

## Create a logical backup

```bash
export PGHOST=db.example.internal
export PGPORT=5432
export PGDATABASE=bubble_tea
export PGUSER=bubble_tea_backup
export BACKUP_DIRECTORY=/secure/off-host/bubble-tea

infra/postgres/backup.sh
```

The script writes the `public` application schema as a PostgreSQL custom-format dump with mode
`0600`-compatible permissions, validates its archive catalog, and creates a SHA-256 checksum.
Transfer both files together. Alert if backup creation, checksum validation, transfer, retention
enforcement, or age monitoring fails.

## Restore drill

Restore only into an isolated database first. Match the PostgreSQL major version used in
production, stop application writers, and ensure no other sessions can write to the target. The
restore is destructive when the target contains an existing application schema: it cleans archived
objects in the named database before recreating them. A new drill database is restored directly.

```bash
export PGHOST=restore-db.example.internal
export PGPORT=5432
export PGDATABASE=bubble_tea_restore_drill
export PGUSER=bubble_tea_restore
export RESTORE_FILE=/secure/off-host/bubble-tea/bubble_tea_20260822T000000Z.dump
export RESTORE_CONFIRM_DATABASE="$PGDATABASE"

infra/postgres/restore.sh
```

The exact-name confirmation prevents accidental use against a differently named target. The script
requires and validates the adjacent `.sha256` file, checks the archive, restores in one transaction,
and verifies that successful Flyway history exists.

After the script succeeds:

1. Start one backend instance with migrations enabled and confirm readiness.
2. Verify staff sign-in, catalog counts, recent orders, payment state, inventory balances, immutable
   movements, and order history against the incident checkpoint.
3. Run a guest read and a non-production test order through completion.
4. Record backup timestamp, restore duration, row-count checks, operator, and discrepancies.
5. Destroy the drill environment and its temporary credentials according to the provider policy.

Run a restore drill at least quarterly and after any material database, authentication, or migration
change. A production recovery requires an incident lead, a documented target timestamp, application
downtime or write fencing, and a rollback decision before traffic is restored.
