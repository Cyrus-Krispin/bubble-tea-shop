# Bubble Tea Shop

Schema-first monorepo for a bubble tea shop management and ordering platform.

## Repository layout

- `backend/` — Spring Boot modular monolith and Flyway migrations.
- `frontend/` — React/Vite customer ordering and staff operations SPA.
- `docs/` — product, architecture, database, API, and delivery documentation.
- `infra/` — local Auth/database assets and backup/restore tooling.

## Quick start

```bash
cp .env.example .env
node infra/supabase/generate-local-auth-keys.mjs >> .env
docker compose up --build
```

This starts the official Supabase Postgres and Auth images, the Spring Boot backend, and the React
frontend in one local-only Compose network. Open the frontend at
<http://localhost:4173>; backend health is at <http://localhost:8080/actuator/health> and Auth
health is at <http://localhost:9999/health>.

The first run needs internet access to pull images and download build dependencies. Once those
artifacts are cached, `docker compose up` runs without a hosted Supabase project or other online
runtime dependency. See [`docs/development/local-docker.md`](docs/development/local-docker.md) for
configuration, health checks, and lifecycle commands, and [`docs/README.md`](docs/README.md) for
the documentation index.
