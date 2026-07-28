# Bubble Tea Shop

Schema-first monorepo for a bubble tea shop management and ordering platform.

## Repository layout

- `backend/` — Spring Boot modular monolith and Flyway migrations.
- `frontend/` — React/Vite application workspace (UI implementation follows the schema slice).
- `docs/` — product, architecture, database, API, and delivery documentation.
- `infra/` — infrastructure notes and future deployment assets.

## Quick start

```bash
cp .env.example .env
docker compose up -d db
cd backend
./mvnw verify
```

The database is exposed on `localhost:5432` by default. See
[`docs/README.md`](docs/README.md) for the documentation index.

