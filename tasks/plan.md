# Implementation Plan: Production-Ready MVP

## Overview

Deliver the complete MVP defined in `docs/product/mvp.md`: optional customer accounts, secure
owner/manager access, catalog and recipe management, inventory operations, guest or signed-in cash
orders, atomic completion without overselling stock, and operational production readiness. Items
explicitly listed as deferred in the product document remain outside this release; implementing
them now would change the approved product and security scope.

## Architecture Decisions

- Keep Spring Boot as the only application backend and preserve the `identity`, `catalog`,
  `inventory`, and `ordering` module boundaries.
- Use local Supabase Auth only as the identity/session issuer. Resolve roles, organizations, and
  locations from Spring-owned PostgreSQL records for every protected operation.
- Deliver contract-first vertical slices. Spring DTOs and generated OpenAPI define the frontend
  boundary; the browser never owns authoritative price, stock, role, or location data.
- Use additive Flyway migrations only and update database documentation in the same increment.
- Require idempotency and server-side price/recipe snapshots for order placement; use database
  locking and transactions for completion.
- Make each production path observable through correlated structured logs, bounded metrics, health
  checks, and documented operational runbooks.

## Dependency Graph

```text
Customer identity mapping
  -> staff context and owner bootstrap
    -> staff catalog management
      -> inventory management
        -> order placement snapshots
          -> staff queue and atomic completion
            -> end-to-end verification and launch hardening
```

## Delivery Phases

### Phase 0: Stabilize Current Customer Account Slice

- Finish the existing registration, sign-in, session, account, logout, and local-auth configuration
  work without broadening customer privileges.
- Verify frontend tests and the Compose-backed Spring integration path.
- Review, commit, and push the coherent customer-account increment.

### Phase 1: Staff Identity and Authorization

- Add a production-safe, idempotent owner bootstrap command that never accepts browser-supplied
  authority.
- Resolve authenticated accounts to active memberships and manager location assignments.
- Expose a protected staff-context endpoint with stable RFC 9457 error semantics.
- Add authorization tests for inactive accounts, inactive memberships, wrong organizations, and
  unassigned locations.

### Phase 2: Contract and Staff UI Foundation

- Publish OpenAPI for implemented endpoints and generate a typed frontend client with drift checks.
- Add guarded staff routing, accessible layout/navigation, reusable form/table/dialog primitives,
  loading/error/empty states, and a staff-context boundary.
- Add Storybook only where it provides an executable design-system contract.

### Phase 3: Catalog and Recipe Management

- Implement ingredient create/list/update/archive APIs and staff UI.
- Implement recipe draft, component editing, immutable publish, and version browsing.
- Implement products, variants, location offerings/prices, option groups/choices, and availability.
- Enforce organization/location ownership and preserve historical references through deactivation.

### Phase 4: Inventory Operations

- Implement balance and movement-history reads with bounded pagination.
- Implement opening, receipt, and adjustment workflows with server-derived acting account and
  location authorization.
- Add staff stock screens, validation/conflict UX, and audit detail.

### Phase 5: Customer Order Placement

- Define idempotent guest/account order contracts and add any required schema indexes/constraints.
- Recalculate prices and availability on the server and snapshot products, options, recipes,
  consumption, and totals atomically.
- Record pending cash payment state and return a stable order number/receipt.
- Connect the cart checkout, handle conflicts without losing the cart, and support signed-in account
  linkage without requiring authentication for guests.

### Phase 6: Staff Order Operations

- Implement authorized order queue/detail endpoints and UI.
- Complete pending orders transactionally, deducting snapshotted consumption exactly once.
- Record cash payment and expose actionable shortage conflicts.
- Add end-to-end coverage from order placement through inventory deduction and idempotent retry.

### Phase 7: Production Hardening and Release

- Add correlation IDs, structured business/security logs, bounded RED metrics, traces, and safe
  actuator exposure without logging tokens or PII.
- Add security headers, request-size limits, narrowly scoped CORS, authentication throttling at the
  gateway, dependency audits, and threat-model/abuse-case tests.
- Add CI gates for backend verification, frontend verification, OpenAPI drift, dependency audits,
  and container builds.
- Produce hardened production images/configuration, backup/restore and rollback runbooks, SLOs,
  alerts, accessibility/browser verification, and a release checklist.

## Checkpoints

- Identity checkpoint: customer and staff identities remain separate; self-signup grants no role.
- Management checkpoint: an owner/manager can operate only within server-resolved scope.
- Ordering checkpoint: a guest can place a cash order and staff can complete it without overselling.
- Production checkpoint: all suites, audits, images, docs, restore drill, and critical browser flows
  are verified from a clean checkout.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing uncommitted customer work is lost or mixed | High | Preserve it, inspect every diff, and stage only coherent files. |
| Authorization crosses tenant/location boundaries | Critical | Central server-side resolver plus deny-by-default integration tests. |
| Duplicate checkout creates duplicate orders | Critical | Required idempotency key backed by a unique database constraint. |
| Price or stock is trusted from the browser | Critical | Resolve offerings/recipes and calculate snapshots inside one transaction. |
| Concurrent completion oversells inventory | Critical | Lock balances in deterministic order and test true concurrent transactions. |
| Production failures are opaque | High | Correlated logs, RED metrics, traces, SLOs, and runbooks before release. |
| Local environment cannot run integration tests | Medium | Start/repair Docker when available; never claim backend completion without it. |

## Explicitly Deferred

- Card providers, refunds, tax, promotions, discounts, favorites, extended profiles, and customer
  cancellation/history UI.
- Forecasting, supplier ordering, expiry/FIFO lots, cash-flow dashboards, and detailed cost
  accounting.
- Multiple active currencies/locales/locations and opt-in face authentication.

