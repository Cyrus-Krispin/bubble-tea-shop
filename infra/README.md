# Infrastructure

The root `compose.yaml` is the local-development runtime. It uses pinned official Supabase images
for Postgres and Auth, plus repository-owned images for Spring Boot and the frontend workspace.
The two SQL files under `supabase/db/` are derived from the official Supabase Docker setup and
initialize only service-role passwords and database JWT settings. Flyway remains responsible for
the Bubble Tea Shop application schema.

This is not a production deployment definition. See
[`../docs/development/local-docker.md`](../docs/development/local-docker.md) for the supported local
workflow and security boundary.

`supabase/bootstrap-local-users.mjs` is a local-only, one-shot Compose bootstrap. It creates or
reconciles the three documented development identities through the Supabase Auth Admin API,
provisions their application accounts through Spring, and grants staff access through the existing
owner bootstrap and owner-authorized manager API. The service-role key is available only to the
account-creation container and is never passed to Spring or the browser.

`postgres/backup.sh` and `postgres/restore.sh` are provider-independent logical backup helpers.
Their production safeguards and required restore-drill process are documented in
[`../docs/operations/backup-restore.md`](../docs/operations/backup-restore.md).
