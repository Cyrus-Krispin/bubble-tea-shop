# Project Agent Guide

This file applies to the entire repository.

## Project context

Bubble Tea Shop is a schema-first monorepo for a bubble tea ordering and shop-management platform.
The current implementation is the database foundation for a future Spring Boot modular monolith
and React single-page application.

The MVP supports one active location, guest cash orders, recipe and menu management, inventory
movements, and safe order completion without overselling stock. The schema is organization- and
location-aware so customer accounts, multiple locations, card payments, and other later features
can be added without redesigning ownership boundaries.

Current delivery status:

- Phase 1 schema foundation is implemented.
- Phase 2 staff authentication, authorization, catalog APIs, and frontend foundations are next.
- Customer accounts and opt-in face authentication are later features.

Read `docs/README.md` before making architecture or product changes. In particular:

- `docs/product/mvp.md` defines current product scope.
- `docs/architecture/overview.md` defines module boundaries.
- `docs/architecture/security.md` defines authentication and authorization rules.
- `docs/architecture/face-authentication.md` defines the deferred biometric/JWT design.
- `docs/database/erd.md`, `data-dictionary.md`, and `invariants.md` describe the schema.
- `docs/delivery/roadmap.md` describes delivery order.

## Repository structure

- `backend/`: Java 21, Spring Boot, JPA, Flyway, PostgreSQL, and Testcontainers.
- `frontend/`: future React/TypeScript/Vite SPA; currently only the workspace placeholder exists.
- `docs/`: product, architecture, API, database, and delivery documentation.
- `infra/`: infrastructure notes and future deployment assets.
- `compose.yaml`: local Supabase Postgres/Auth, Spring backend, and frontend services.

## Architecture rules

- Keep the backend a modular monolith. Spring is the only application backend.
- Preserve module ownership: `identity`, `catalog`, `inventory`, and `ordering`.
- Use application services for cross-module workflows; controllers must not write another
  module's tables directly.
- Do not return JPA entities through HTTP APIs.
- PostgreSQL owns relational integrity; Spring owns workflows and authorization.
- Treat Flyway migrations as immutable once committed. Add a new versioned migration for every
  later schema change.
- Update the ERD, data dictionary, invariants, and affected architecture docs alongside schema or
  behavior changes.
- Never trust client-supplied organization, location, role, price, inventory, biometric match, or
  authorization data without resolving it on the server.
- Preserve historical records through deactivation or archival unless the documented lifecycle
  explicitly permits deletion.
- Never commit secrets, production credentials, raw tokens, biometric templates, or local `.env`
  files.

## Verification

Use the smallest relevant checks while iterating, then run the full affected suite before
completion.

Backend verification:

```bash
cd backend
./mvnw verify
```

The backend integration tests require Docker because they use PostgreSQL through Testcontainers.

Local application stack:

```bash
cp .env.example .env
docker compose up --build
```

For documentation-only work, at minimum run `git diff --check` and verify that added relative links
resolve. Add frontend lint, typecheck, test, and build commands here when the frontend is
implemented.

## Git delivery rule

For every completed incremental feature or coherent user-requested implementation:

1. Review the diff and exclude unrelated or pre-existing user changes.
2. Run the relevant verification checks.
3. Create a focused commit with an imperative message that describes the increment.
4. Push the commit to the configured remote branch.
5. Report the commit hash, push result, and verification performed.

Do not bundle unrelated features into one commit. Do not rewrite published history, force-push, or
discard user changes unless the user explicitly requests it. If committing or pushing is blocked
by failing checks, missing credentials, conflicts, or remote rejection, preserve the work and
report the blocker instead of claiming completion.
