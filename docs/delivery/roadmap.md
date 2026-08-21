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

- Local Supabase Auth customer registration, sign-in/session integration, and idempotent
  application-account mapping.
- Production owner bootstrap command and owner/manager authorization from server-side memberships.
- Add a Flyway migration that maps Supabase subjects and makes the legacy V1 credential columns
  optional without editing V1; decide the unused refresh-session table separately.
- Resolve verified Supabase identities to active owner/manager memberships and location
  assignments in Spring.
- Add a protected staff-context endpoint as the first authenticated vertical slice.
- Ingredient and recipe-version management APIs and staff workspaces. (Implemented.)
- Menu and option management APIs. (Implemented.)
- Menu and option staff workspaces. (Implemented.)
- OpenAPI generation and typed frontend client. (Implemented.)
- First design-system tokens and form primitives. (Implemented.)
- Storybook component documentation.

## Phase 3 — Inventory and ordering

- Stock level and movement APIs. (Implemented.)
- Inventory balance, manual movement, and immutable history staff workspace. (Implemented.)
- Guest menu read APIs backed by a versioned local catalog seed. (Implemented.)
- Guest order-placement APIs with consumption snapshots and server-recalculated totals. (Implemented.)
- Guest cash checkout with idempotent retry and server-confirmed order details. (Implemented.)
- Staff order queue and completion UI. (Implemented.)
- Cash payment recording and shortage conflict UX. (Implemented.)
- End-to-end tests from order placement through inventory deduction. (Implemented.)

## Phase 4 — Operational polish

- Audit API and staff timeline workspace. (Implemented.)
- Accessibility checks.
- Observability. (Implemented.)
- Backup/restore runbook and verified logical recovery scripts. (Implemented.)
- Production container image builds. (Implemented.)
- CI gates for backend tests, frontend types/tests, OpenAPI drift, infrastructure tests, and
  container builds. (Implemented.)

## Later releases

- Customer order history, extended profiles, card payments, forecasting/alerts, supplier
  integration, dashboards, active multi-location operation, localization, and multiple currencies.
- Opt-in customer face authentication, only after customer accounts and the standard Supabase
  authentication path; see
  [`../architecture/face-authentication.md`](../architecture/face-authentication.md).
