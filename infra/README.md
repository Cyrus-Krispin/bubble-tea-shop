# Infrastructure

The root `compose.yaml` is the local-development runtime. It uses pinned official Supabase images
for Postgres and Auth, plus repository-owned images for Spring Boot and the frontend workspace.
The two SQL files under `supabase/db/` are derived from the official Supabase Docker setup and
initialize only service-role passwords and database JWT settings. Flyway remains responsible for
the Bubble Tea Shop application schema.

This is not a production deployment definition. See
[`../docs/development/local-docker.md`](../docs/development/local-docker.md) for the supported local
workflow and security boundary.
