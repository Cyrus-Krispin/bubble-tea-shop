# Delivery Roadmap

## Phase 1 — Schema foundation

- Monorepo and documentation structure.
- PostgreSQL 18 Compose service.
- Flyway MVP migration and JPA mappings.
- Manual inventory movement and order-completion transaction services.
- Testcontainers migration, integrity, idempotency, and concurrency tests.

Acceptance: `./mvnw verify` succeeds against PostgreSQL 18 and `docker compose up -d db` reports a
healthy database.

## Phase 2 — Staff access and catalog

- Production owner bootstrap command.
- Login, refresh rotation, logout, and owner/manager authorization.
- Ingredient, recipe-version, menu, and option management APIs.
- OpenAPI generation and typed frontend client.
- First design-system tokens, form primitives, and Storybook.

## Phase 3 — Inventory and ordering

- Stock level and movement APIs.
- Guest menu and order-placement APIs with consumption snapshots.
- Staff order queue and completion UI.
- Cash payment recording and shortage conflict UX.
- End-to-end tests from order placement through inventory deduction.

## Phase 4 — Operational polish

- Audit views, accessibility checks, observability, backup/restore runbook, and production images.
- CI gates for backend tests, frontend types/tests, OpenAPI drift, and container builds.

## Later releases

- Customer accounts/history, card payments, forecasting/alerts, supplier integration, dashboards,
  active multi-location operation, localization, and multiple currencies.
- Opt-in customer face authentication, only after customer accounts and the standard JWT session
  flow; see [`../architecture/face-authentication.md`](../architecture/face-authentication.md).
