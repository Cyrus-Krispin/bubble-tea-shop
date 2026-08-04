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

- Decide the Supabase Auth/data boundary, local-development topology, identity mapping, and
  browser-to-Spring credential validation.
- Add a Flyway migration that reconciles the legacy V1 credential/session schema without editing
  V1.
- Configure Supabase managed authentication and an explicit first-owner provisioning/linking
  workflow.
- Resolve verified Supabase identities to active owner/manager memberships and location
  assignments in Spring.
- Add a protected staff-context endpoint as the first authenticated vertical slice.
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
- Opt-in customer face authentication, only after customer accounts and the standard Supabase
  authentication path; see
  [`../architecture/face-authentication.md`](../architecture/face-authentication.md).
