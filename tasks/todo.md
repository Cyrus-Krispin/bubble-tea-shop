# Production-Ready MVP Tasks

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

- [ ] Ingredient create/list/update/archive slice.
- [ ] Recipe draft and component editing slice.
- [ ] Immutable recipe publishing/version browsing slice.
- [ ] Product and variant management slice.
- [ ] Location offering, price, and availability slice.
- [ ] Option group, choice, default, and ingredient-effect slice.

## Phase 4 — Inventory

- [ ] Paginated stock balance and movement history reads.
- [ ] Opening movement workflow.
- [ ] Receipt movement workflow.
- [ ] Adjustment workflow with reason and audit actor.
- [ ] Staff inventory UI and conflict/error states.

## Phase 5 — Order Placement

- [ ] Contract and migration for idempotent order placement.
- [ ] Server-owned offering/option validation and total calculation.
- [ ] Immutable price, product, option, recipe, and consumption snapshots.
- [ ] Pending cash payment and stable order receipt.
- [ ] Guest checkout UI integration and retry-safe conflict handling.
- [ ] Optional authenticated customer linkage.

## Phase 6 — Staff Orders

- [ ] Authorized paginated order queue and detail endpoints.
- [ ] Pending-to-completed atomic inventory deduction endpoint.
- [ ] Cash payment recording and shortage problem details.
- [ ] Staff queue/detail/completion UI.
- [ ] End-to-end order-to-inventory concurrency coverage.

## Phase 7 — Production Readiness

- [ ] Correlation IDs, structured logs, RED metrics, traces, and safe actuator endpoints.
- [ ] Security headers, limits, gateway throttling, and dependency/security audits.
- [ ] CI for backend, frontend, OpenAPI drift, audits, and container builds.
- [ ] Hardened images/config, non-root runtime, and secret/config validation.
- [ ] Backup/restore, deployment, incident, rollback, and alert runbooks.
- [ ] Browser E2E, WCAG checks, responsive checks, and performance budgets.
- [ ] Clean-checkout release candidate verification and production-readiness review.
