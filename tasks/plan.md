# Implementation Plan: Complete shadcn/ui Migration

## Overview

Replace the frontend's homegrown component and stylesheet system with a shadcn/ui-based design
system while preserving every existing route, API contract, workflow, accessibility guarantee, and
server-owned business rule. The migration covers both the photographic customer ordering
experience and the denser staff workspace. It does not redesign backend behavior or introduce
mock catalog, price, location, inventory, order, or authorization data.

This is a source migration, not a package swap. shadcn/ui copies owned component source into the
repository. The target boundary is:

- `src/components/ui`: shadcn CLI-managed primitives only;
- `src/components/shared`: reusable Bubble Tea Shop compositions built from those primitives;
- `src/features`: route and domain components that compose shadcn primitives with API-backed data;
- `src/index.css`: Tailwind import, shadcn semantic tokens, brand tokens, and only unavoidable
  global rules.

## Current-State Audit

- React 19, Vite 8, React Router 8, strict TypeScript, Vitest, Storybook, Playwright, and axe are
  already in place.
- The UI currently uses six homegrown shared primitives: `Button`, `DataTable`, `Dialog`, `Field`,
  `Pagination`, and `ProblemState`.
- The frontend contains 1,969 lines across seven global or feature CSS files and uses 100 native
  `input`, `select`, `textarea`, and `button` controls directly in route components.
- The only Radix dependency is the dialog package; Tailwind, shadcn configuration, path aliases,
  Lucide icons, and the `cn` utility are not configured.
- There are 28 customer and staff route declarations. Existing tests already cover representative
  accessibility states, and Playwright covers the complete guest order flow.

## Architecture Decisions

1. **Use shadcn's `new-york` style with Radix primitives and Tailwind CSS v4.** Use the current
   unified `radix-ui` package rather than retaining individual Radix packages.
2. **Keep the existing light, photographic commerce direction.** Map the documented ube,
   calamansi, status, spacing, and radius system to shadcn semantic CSS variables. Do not adopt a
   generic dark dashboard, gradients, or glass effects. Dark mode is outside this migration.
3. **Install only used components.** Do not run `shadcn add --all`; add explicit primitives so the
   repository owns no unused generated code.
4. **Keep generated primitives generic.** Feature-specific loading buttons, responsive data
   displays, location selection, empty states, and status treatments belong in
   `components/shared` or their feature, composed from shadcn primitives.
5. **Migrate by complete user flow.** Old CSS and the Tailwind theme may coexist temporarily, but
   each migrated route uses one coherent styling system. Remove old CSS only after its final
   consumer is migrated.
6. **Preserve native semantics where they are better.** shadcn interactive and surface primitives
   replace hand-built equivalents. Links, headings, lists, fieldsets, and layout containers remain
   semantic HTML styled with Tailwind utilities.
7. **Preserve behavior boundaries.** Do not change generated OpenAPI types, API clients, auth/cart
   providers, server-state ownership, pricing, availability, idempotency, or authorization.
8. **Keep accessibility and test intent, not CSS implementation details.** Prefer role, label,
   state, and user-event assertions while retaining axe, keyboard, focus, responsive, and browser
   flow coverage.

## Target Component Set

Add primitives when their first consumer migrates:

| Need | shadcn/ui source | Application composition |
| --- | --- | --- |
| Actions/navigation | `button`, `sheet`, `dropdown-menu`, `tooltip` | Loading action, customer/staff navigation |
| Forms | `field`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `label` | Error summary and option groups |
| Content | `card`, `badge`, `separator`, `scroll-area`, `table` | Product card, receipt, responsive data view |
| Feedback | `alert`, `skeleton`, `sonner` | Retryable problem, empty, denied, mutation states |
| Overlays | `dialog`, `alert-dialog`, `popover` | Destructive confirmation and location disclosure |
| Navigation/data | `tabs`, `pagination` | Account mode switch and bounded API pagination |

Verify the current CLI registry before adding each component and omit any item that no migrated
screen needs.

## Dependency Graph

```text
Tailwind + aliases + components.json
  -> semantic theme + shadcn primitives
    -> shared application compositions + Storybook contract
      -> customer shell
        -> auth/account -> menu -> drink customizer -> cart/orders
      -> staff shell
        -> catalog -> inventory/orders -> managers/audit
          -> legacy CSS/component removal -> full browser verification
```

## Tasks

### Task 1: Configure the shadcn and Tailwind toolchain

Initialize shadcn non-interactively for the existing Vite application. Add Tailwind v4, the Vite
integration, `@/*` aliases, `components.json`, `cn`, Lucide, and unified Radix dependencies without
changing a route.

**Acceptance criteria:**

- [ ] `components.json` selects `new-york`, TypeScript, CSS variables, Radix, and repository aliases.
- [ ] Vite and TypeScript resolve `@/*`, and the application builds with the configuration.
- [ ] The individual dialog dependency is removed once unified Radix is active.

**Verification:** `cd frontend && pnpm typecheck && pnpm lint && pnpm build`

**Dependencies:** None

**Files likely touched:** `frontend/package.json`, `frontend/pnpm-lock.yaml`,
`frontend/components.json`, `frontend/vite.config.ts`, `frontend/tsconfig.app.json`

**Estimated scope:** Medium

### Task 2: Establish the brand theme and first primitives

Replace duplicated root tokens with Tailwind v4 and shadcn semantic variables. Map the documented
light ube/calamansi palette to shadcn surface and state tokens, then validate focus, contrast,
typography, motion, and forced-colors behavior.

**Acceptance criteria:**

- [ ] The theme matches `frontend/docs/visual-style-guide.md` and uses semantic utilities.
- [ ] Controls retain visible focus, 44px customer targets, reduced motion, and forced-color boundaries.
- [ ] Storybook and the application load the same global theme without circular font variables.

**Verification:** `cd frontend && pnpm test && pnpm typecheck && pnpm lint && pnpm build-storybook`,
plus manual contrast and focus review.

**Dependencies:** Task 1

**Files likely touched:** `frontend/src/index.css`, `frontend/src/lib/utils.ts`,
`frontend/src/components/ui/*`, `frontend/.storybook/preview.tsx`

**Estimated scope:** Medium

### Task 3: Replace the shared component contract

Rebuild loading actions, fields, retryable problems, responsive operational data, pagination,
status badges, and confirmations as application compositions over shadcn primitives. Move them to
`components/shared`; keep `components/ui` aligned with generated APIs.

**Acceptance criteria:**

- [ ] Every old shared primitive has an explicit replacement or is deleted as unnecessary.
- [ ] Destructive actions use `AlertDialog`; ordinary modal tasks use `Dialog`.
- [ ] Shared compositions have stories and interaction/axe tests for material states.

**Verification:** `cd frontend && pnpm test -- src/components && pnpm build-storybook`

**Dependencies:** Task 2

**Files likely touched:** `frontend/src/components/shared/*`, `frontend/src/components/ui/*`,
component stories and tests

**Estimated scope:** Medium

### Checkpoint A: Design-system foundation

- [ ] Application, Storybook, and shared-component tests pass.
- [ ] Browser review confirms typography, tokens, keyboard focus, overlays, and responsive behavior
  at 320/768/1024/1440 before route migration.
- [ ] Commit and push the foundation as one focused increment.

### Task 4: Migrate the customer shell and route-level states

Convert the customer header, navigation, cart count, mobile navigation, suspense fallbacks,
not-found pages, and route-level states with shadcn primitives while retaining Router semantics.

**Acceptance criteria:**

- [ ] Navigation works with mouse, keyboard, screen reader, narrow viewport, and 200% zoom.
- [ ] Current route, account state, and cart count remain available without invented data.
- [ ] Loading, missing, and error states do not collapse layout or shift focus unexpectedly.

**Verification:** `cd frontend && pnpm test -- src/app && pnpm typecheck && pnpm lint`, plus a
manual keyboard and 320px/200%-zoom check.

**Dependencies:** Task 3

**Files likely touched:** `frontend/src/app/CustomerHeader.tsx`, its test,
`frontend/src/app/App.tsx`, `frontend/src/app/NotFoundPage.tsx`

**Estimated scope:** Medium

### Task 5: Migrate authentication and customer account surfaces

Migrate account access, login, registration, staff sign-in, and customer account landing with
shadcn fields, tabs, cards, alerts, buttons, and skeletons without changing Supabase behavior.

**Acceptance criteria:**

- [ ] Mode, validation, pending, success, generic error, and safe redirect behavior are unchanged.
- [ ] Controls have visible labels, autocomplete, described errors, and predictable error focus.
- [ ] Customer self-signup cannot imply staff role or authorization.

**Verification:** `cd frontend && pnpm test -- src/features/auth && pnpm typecheck && pnpm lint`

**Dependencies:** Task 4

**Files likely touched:** auth page/form components and tests under `frontend/src/features/auth`

**Estimated scope:** Medium

### Task 6: Migrate menu discovery and pickup location selection

Convert the API-backed menu, category rail, product cards, photography, and anchored pickup
location disclosure. Preserve the documented ordinary-link semantics within the popover.

**Acceptance criteria:**

- [ ] Location and catalog data come only from Spring APIs; location routes remain canonical.
- [ ] The disclosure supports Enter/Space, Escape with focus restoration, outside click, and a
  visible current location.
- [ ] Images, availability, prices, loading, empty, and error states work at all required widths.

**Verification:** focused `ShopPage` tests, typecheck, lint, and visual review at all four widths.

**Dependencies:** Task 4

**Files likely touched:** `ShopPage.tsx`, `LocationPicker.tsx`, artwork components, and `ShopPage.test.tsx`

**Estimated scope:** Medium

### Task 7: Migrate drink customization

Recompose drink detail and configuration using shadcn radio groups, checkboxes, cards, separators,
badges, and a responsive action surface.

**Acceptance criteria:**

- [ ] Server-provided choices, prices, defaults, and disabled availability remain intact.
- [ ] Selection and live prices are keyboard accessible, announced, and not color-only.
- [ ] The mobile action stays reachable without hiding validation or the final option.

**Verification:** focused `DrinkPage` tests, typecheck, lint, and mobile keyboard/200%-zoom review.

**Dependencies:** Tasks 2 and 4

**Files likely touched:** `frontend/src/features/catalog/DrinkPage.tsx` and its test

**Estimated scope:** Medium

### Task 8: Migrate cart, confirmation, and account orders

Convert cart checkout, retry-safe feedback, last-order quick add, history, and immutable receipt
detail without altering order payloads or cart conflict behavior.

**Acceptance criteria:**

- [ ] Mixed-location blocking, limits, idempotent retry, cash copy, server totals, and confirmation remain intact.
- [ ] Order-again remains atomic and uses current server eligibility and prices.
- [ ] Guest, signed-in, empty, unavailable, error, pending, completed, and cancelled states are distinct.

**Verification:** `cd frontend && pnpm test -- src/features/cart src/features/orders && pnpm typecheck && pnpm lint`

**Dependencies:** Tasks 5-7

**Files likely touched:** cart and order page components/tests under `frontend/src/features`

**Estimated scope:** Medium per page; commit cart and account-order slices separately

### Checkpoint B: Customer journey

- [ ] Unit, axe, type, lint, build, and Storybook checks pass.
- [ ] Compose-backed Playwright passes location selection through checkout, history, and order-again
  on desktop and mobile.
- [ ] Customer feature CSS is removed only when its final consumers are migrated.

### Task 9: Migrate the staff shell and workspace overview

Rebuild protected staff navigation, desktop rail, mobile module navigation, account controls,
scope/status surfaces, quick links, and denied/loading states with shadcn primitives.

**Acceptance criteria:**

- [ ] Owner and manager navigation derives solely from the Spring staff context.
- [ ] Desktop/mobile navigation retains route labeling and keyboard access.
- [ ] Loading, denied, no-membership, no-location, and sign-out states are accessible.

**Verification:** focused staff layout/workspace tests, typecheck, lint, and manual narrow/desktop check.

**Dependencies:** Task 3

**Files likely touched:** `StaffLayout.tsx`, `StaffWorkspacePage.tsx`, and related tests

**Estimated scope:** Medium

### Task 10: Migrate ingredient and recipe management

Convert ingredient search/filter/create/edit/archive and recipe draft, component, publish, and
history workflows while retaining optimistic concurrency.

**Acceptance criteria:**

- [ ] Current operations, validation, archive rules, version history, and conflicts remain unchanged.
- [ ] Published versions remain visibly immutable; destructive actions use confirmation.
- [ ] Narrow record views remain labeled without routine horizontal scrolling.

**Verification:** focused ingredient/recipe tests, then typecheck and lint.

**Dependencies:** Task 9

**Files likely touched:** ingredient and recipe components/tests under `frontend/src/features/staff`

**Estimated scope:** Medium per slice; commit ingredients and recipes separately

### Task 11: Migrate menu and option management

Convert product, variant, offering, location-price, option-group, choice, default,
ingredient-effect, and availability screens.

**Acceptance criteria:**

- [ ] Server-owned scope, prices, availability, defaults, and archival rules remain unchanged.
- [ ] Complex forms have labels, field and summary errors, sensible keyboard order, and pending states.
- [ ] Catalog navigation and statuses are consistent across all catalog routes.

**Verification:** focused menu tests, typecheck, and lint.

**Dependencies:** Tasks 9 and 10

**Files likely touched:** menu/option components/tests and `CatalogSectionNav.tsx`

**Estimated scope:** Medium per route; commit menu and options separately

### Task 12: Migrate inventory and staff order operations

Convert location scope, inventory balance/history and movement forms, plus the order queue, detail,
cash completion, and shortage conflict experience.

**Acceptance criteria:**

- [ ] Scope, reasons, history, filters, cash completion, and shortage details remain API-backed.
- [ ] Low-stock and order states pair text/icons with semantic color; shortages are announced.
- [ ] Frequent actions are efficient on desktop and usable at 320px and 200% zoom.

**Verification:** focused inventory/order tests, typecheck, lint, and Compose order-to-completion flow.

**Dependencies:** Task 9

**Files likely touched:** `InventoryManagementPage.tsx`, `OrderOperationsPage.tsx`, and their tests

**Estimated scope:** Medium per route; commit inventory and orders separately

### Task 13: Migrate manager access and audit timeline

Convert manager lifecycle/assignment dialogs and audit filters, event detail, status, and pagination.

**Acceptance criteria:**

- [ ] Roles and locations still come from Spring; owner actions remain server guarded.
- [ ] Deactivation/reactivation/assignment preserve audit history with clear confirmation and feedback.
- [ ] Audit category, actor, scope, time, and detail remain scannable at supported sizes.

**Verification:** focused manager/audit tests, then typecheck and lint.

**Dependencies:** Task 9

**Files likely touched:** `ManagerManagementPage.tsx`, `AuditPage.tsx`, and their tests

**Estimated scope:** Medium per route; commit manager access and audit separately

### Checkpoint C: Staff workspace

- [ ] Staff tests and representative axe scans pass.
- [ ] Owner/manager browser checks cover allowed, denied, empty, conflict, and success states.
- [ ] Desktop density, mobile navigation, tables, forms, dialogs, and keyboard flow are reviewed.

### Task 14: Remove the legacy design system and complete release verification

Delete superseded primitives, CSS files, selectors, and unused dependencies only after proving zero
consumers. Update design-system, Storybook, and accessibility documentation.

**Acceptance criteria:**

- [ ] No import references old primitives or feature CSS; no legacy selector remains in use.
- [ ] `components/ui` contains only intentionally installed shadcn source; dependencies are used.
- [ ] Customer/staff UI meets brand, responsive, WCAG, and API ownership boundaries without errors.

**Verification:**

- [ ] `cd frontend && pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm build-storybook`
- [ ] `cd frontend && pnpm e2e` against healthy Compose.
- [ ] Keyboard, focus return, VoiceOver spot-check, 200% zoom, reduced motion, forced colors, and
  320/768/1024/1440 review.
- [ ] `git diff --check` and repository-wide dead-import/legacy-selector search.

**Dependencies:** Tasks 4-13

**Files likely touched:** legacy CSS/primitives, Storybook config, visual style guide, accessibility
and Storybook docs

**Estimated scope:** Medium

## Increment and Git Strategy

- Work only in `feature/shadcn-ui-migration`, based on the latest `origin/main`.
- Keep each task or named vertical slice as a focused commit; do not combine configuration,
  customer routes, staff routes, and cleanup.
- Push every verified increment and open the pull request after Checkpoint A for early visual review.
- Integrate main regularly without rewriting published history.
- Keep old/new systems together only for an active slice; do not partially convert classes within a route.

## Definition of Done for Every Increment

- Acceptance criteria are met at runtime, not only by compilation.
- Focused behavior tests and meaningful axe assertions pass; regression tests remain green.
- Relevant loading, empty, error, denied, unavailable, pending, and success states are covered.
- Keyboard, focus, contrast, responsive behavior, and 200% zoom are checked proportionately.
- No domain behavior, API contract, or server-owned value changes accidentally.
- Stories/docs are updated when reusable components or rules change.
- The diff excludes unrelated files and secrets, then is committed and pushed atomically.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Big-bang rewrite hides regressions | High | Migrate and verify one complete route flow at a time. |
| Tailwind and old CSS conflict | High | One styling system per route; delete imports only at zero consumers. |
| Generated source becomes opaque | Medium | Isolate it in `components/ui`, review CLI diffs, document local changes. |
| “Everything shadcn” forces bad semantics | High | Use shadcn primitives plus semantic HTML for document structure. |
| Brand becomes generic | High | Map approved tokens first and review screenshots at checkpoints. |
| Radix changes form behavior | High | Preserve names/values and test keyboard, submission, focus, disabled states. |
| Responsive staff tables regress | High | Retain labeled stacked rows; test narrow widths and 200% zoom. |
| Accessibility is assumed | High | Keep axe gates and manually verify composition-level behavior. |
| Branch diverges from main | Medium | Push small commits, open the PR early, integrate main frequently. |

## Explicit Non-Goals

- Backend, database, OpenAPI, authentication, cart, pricing, inventory, or authorization redesign.
- New workflows, fabricated application data, or unimplemented navigation.
- Dark mode, localization, new branding, animation-heavy effects, or a custom component registry.
- Replacing React Router, Vitest, Storybook, Playwright, axe, or the generated API client.

## Approval Gate

Implementation begins only after human review of this plan. The first implementation increment is
Tasks 1-3 and Checkpoint A; route migrations follow after shared theme and primitives are approved.
