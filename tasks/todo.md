# Production-Ready MVP Tasks

## Active increment — Customer order history and last-order suggestion

- [ ] Specify the customer-owned history, immutable receipt, pagination, storefront placement, and
  explicit reorder boundary.
- [ ] Add the customer-history index and ownership-scoped list/detail API using test-first backend
  integration slices.
- [ ] Generate and review OpenAPI plus immutable frontend types; update database, API, security,
  product, and roadmap documentation.
- [ ] Add a runtime-validating customer-order client with focused request, response, and error tests.
- [ ] Add signed-in account history and receipt pages with loading, empty, error, pagination, and
  accessibility coverage.
- [ ] Add a non-blocking `Last ordered` storefront section that is hidden for guests and empty
  histories, with focused tests.
- [ ] Verify account-linked checkout through storefront suggestion, history, and receipt in desktop
  and mobile browsers; confirm clean console/network output and accessibility.
- [ ] Run all backend/frontend/contract/security checks, complete the five-axis review, update the
  checklist, commit, and push.

Each task is a small verified increment. Behavioral work follows RED-GREEN-REFACTOR, then the
relevant full suite, focused commit, and push.

## Phase 0 — Current Customer Account Slice

- [x] Audit existing uncommitted customer-auth work for security, accessibility, and race failures.
- [x] Add/fix tests first for identified behavior gaps.
- [x] Verify frontend suite and Compose-backed customer provisioning.
- [x] Review, commit, and push the customer-account increment.

## Phase 1 — Staff Access

- [x] Specify and implement idempotent owner bootstrap.
- [x] Resolve active staff membership and assignments from the authenticated subject.
- [x] Expose `GET /api/v1/staff/context` with deny-by-default authorization.
- [x] Add frontend staff session/context guard and navigation.

## Phase 2 — API and Design-System Contracts

- [x] Generate OpenAPI and a typed frontend client; fail verification on drift.
- [x] Add reusable accessible field, button, table, dialog, pagination, and problem-state primitives.
- [x] Cover primitive interaction and accessibility contracts in Vitest; defer Storybook until
  isolated visual review is needed beyond the smaller executable component suite.

## Phase 3 — Catalog Management

- [x] Ingredient create/list/update/archive slice.
- [x] Recipe draft and component editing slice.
- [x] Immutable recipe publishing/version browsing slice.
- [x] Product and variant management slice.
- [x] Location offering, price, and availability slice.
- [x] Option group, choice, default, and ingredient-effect slice.

## Phase 4 — Inventory

- [x] Paginated stock balance and movement history reads.
- [x] Opening movement workflow.
- [x] Receipt movement workflow.
- [x] Adjustment workflow with reason and audit actor.
- [x] Staff inventory UI and conflict/error states.

## Phase 5 — Order Placement

- [x] Contract and migration for idempotent order placement.
- [x] Server-owned offering/option validation and total calculation.
- [x] Immutable price, product, option, recipe, and consumption snapshots.
- [x] Pending cash payment and stable order receipt.
- [x] Guest checkout UI integration and retry-safe conflict handling.
- [x] Optional authenticated customer linkage.

## Phase 6 — Staff Orders

- [x] Authorized paginated order queue and detail endpoints.
- [x] Pending-to-completed atomic inventory deduction endpoint.
- [x] Cash payment recording and shortage problem details.
- [x] Staff queue/detail/completion UI.
- [x] End-to-end order-to-inventory concurrency coverage.

## Phase 7 — Production Readiness

- [x] Correlation IDs, structured logs, RED metrics, traces, and safe actuator endpoints.
- [x] Security headers, limits, gateway throttling, and dependency/security audits.
- [x] CI for backend, frontend, OpenAPI drift, audits, and container builds.
- [x] Hardened images/config, non-root runtime, and secret/config validation.
- [x] Backup/restore, deployment, incident, rollback, and alert runbooks.
- [x] Browser E2E, WCAG checks, responsive checks, and performance budgets.
- [x] Clean-checkout release candidate verification and production-readiness review.
