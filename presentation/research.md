# Talk fact check: Bubble Tea Shop

This is the evidence behind the six-slide talk mock. It distinguishes implemented local
capabilities from configuration-dependent features and documented production plans.

## Complexity numbers and identity

- **35 application tables are created by V1–V20.** Counted from `CREATE TABLE` statements in
  [`backend/src/main/resources/db/migration/`](../backend/src/main/resources/db/migration/).
  This count includes `refresh_session`, a legacy table that the current Supabase Auth integration
  does not use. It does not include Flyway's own schema-history table or Supabase Auth tables.
- **20 versioned Flyway migrations** currently exist, V1 through V20.
- **Four backend modules** own the application domain: identity, catalog, inventory, and ordering.
  See [architecture overview](../docs/architecture/overview.md).
- **Guest:** public catalog and guest order placement. **Customer or staff:** local Supabase Auth
  issues and refreshes sessions; React sends a bearer token; Spring validates its signature,
  issuer, audience, and expiry via local JWKS. Spring then resolves the current account and staff
  membership/location assignment from PostgreSQL. Customer signup never grants staff access.
  See [security](../docs/architecture/security.md) and [staff access](../docs/product/staff-access.md).

## Customer features

- Two-location selection, location-specific catalog and prices, a cart bound to one location:
  [guest browser journey](../frontend/e2e/guest-order.spec.ts),
  [catalog routes](../frontend/src/app/App.tsx).
- Custom drinks and sugar, ice, milk, and topping choices; optional single choices can be cleared:
  [catalog management](../docs/product/catalog-management.md),
  [optional-choice specification](../docs/specs/optional-drink-choice-clearing.md).
- Cash checkout with server prices, order consumption snapshots and retry safety:
  [placement contract](../docs/product/guest-order-placement.md).
- Stripe-hosted card checkout, reserved ingredients, reconciliation, guest recovery, and refunds:
  [card checkout specification](../docs/specs/stripe-card-checkout.md),
  [card browser test](../frontend/e2e/card-checkout.spec.ts). Availability depends on merchant
  configuration. Do not imply that a live Stripe account was exercised for this talk.
- Optional account sign-in, session refresh/expiry handling, private order history, receipts and
  order-again actions: [security](../docs/architecture/security.md),
  [history contract](../docs/product/customer-order-history.md),
  [session test](../frontend/e2e/session-expiry.spec.ts).
- Favorite drink and server-calculated 5% matching-drink discount:
  [favorite specification](../docs/specs/favorite-drink-discount.md),
  [browser test](../frontend/e2e/favorite-discount.spec.ts).
- Shop currencies SGD, MYR and CNY with explicit option prices and no FX conversion:
  [location currency specification](../docs/specs/location-currency-pricing.md).

## Staff and inventory features

- Ingredient, recipe version, menu, option, offering and price workspaces:
  [staff routes](../frontend/src/app/App.tsx),
  [catalog contract](../docs/product/catalog-management.md).
- Opening stock, receipts, adjustments, balances, immutable movement history and safe retry keys:
  [inventory contract](../docs/product/inventory-management.md),
  [retry specification](../docs/specs/manual-stock-retry-safety.md).
- Location-scoped order queue, atomic cash collection/completion, shortage conflicts and
  concurrent no-oversell protection: [order operations](../docs/product/staff-order-operations.md).
- Staff counter orders: [counter-order specification](../docs/specs/staff-counter-order-entry.md),
  [browser test](../frontend/e2e/counter-order.spec.ts).
- Inventory consumption forecasts, projected low-stock alerts and prioritized manual reorder
  planning: [forecast](../docs/specs/ingredient-consumption-forecast.md),
  [alerts](../docs/specs/projected-low-stock-alerts.md),
  [reorder planning](../docs/specs/ingredient-reorder-planning.md).
- Owner shop creation and manager assignment/deactivation, with actor-attributed audit history:
  [owner management](../docs/product/owner-manager-management.md),
  [audit views](../docs/product/audit-views.md).
- Collected-payment dashboard, paid-expense ledger and audited corrections:
  [cash-flow specification](../docs/specs/cash-flow-dashboard.md),
  [browser test](../frontend/e2e/cash-flow.spec.ts).

## Engineering and operations actually present

- Generated OpenAPI TypeScript client, backend contract drift check, Java and frontend verification,
  and a Compose-backed desktop/mobile browser gate:
  [CI documentation](../docs/development/continuous-integration.md),
  [workflow](../.github/workflows/ci.yml).
- Testcontainers PostgreSQL integration tests, Vitest component tests, Playwright journeys,
  axe-based accessibility checks, and Storybook component catalog:
  [technology stack](../docs/architecture/technology-stack.md),
  [accessibility](../docs/development/accessibility.md),
  [Storybook](../docs/development/storybook.md).
- Local Prometheus scrape and Grafana system overview; health probes, ECS JSON logs, request IDs,
  and optional OpenTelemetry trace export hooks:
  [observability contract](../docs/operations/observability.md). Production alert thresholds and
  additional exporters are documented plans, not a claim that a production monitor is live.
- Backup and restore scripts/drills, production image builds and deployment/incident runbooks:
  [backup/restore](../docs/operations/backup-restore.md),
  [deployment](../docs/operations/deployment.md),
  [incident response](../docs/operations/incident-response.md).

## Agent skill files represented in the workflow

The skills are instructions for Codex agents, not executable CI steps. The current deck maps:

- Specification and acceptance: `~/.codex/skills/spec-driven-development/SKILL.md`.
- Failing test, minimal passing code, refactor: `~/.codex/skills/test-driven-development/SKILL.md`.
- Small vertical slices: `~/.codex/skills/incremental-implementation/SKILL.md`.
- Interactive browser inspection: `~/.codex/skills/browser-testing-with-devtools/SKILL.md`.
  The repository's actual browser gate runs Playwright.
- Five-axis review before merge: `~/.codex/skills/code-review-and-quality/SKILL.md`.
- Git discipline and CI automation also have corresponding skill files. The repository's
  [AGENTS.md](../AGENTS.md) supplies the project-specific guardrails.
