# Guest Bubble Tea Shop Foundation Tasks

## Task 1: Add route shell and guest entry

**Description:** Add client-side routing, make `/` a customer-first welcome page, connect
`Continue as guest` to `/shop`, and preserve the current staff form at `/staff/sign-in`.

**Acceptance criteria:**

- [x] `/` exposes a primary `Continue as guest` link and a secondary, clearly labeled staff link.
- [x] Guest navigation reaches `/shop`; direct URLs, refresh, back, and forward navigation work.
- [x] Staff authentication behavior remains unchanged at `/staff/sign-in`.

**Verification:**

- [x] Component tests cover both entry actions and the staff route.
- [x] Manual keyboard check covers skip link, both actions, focus visibility, and browser history.
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass in `frontend/`.

**Dependencies:** None

**Files likely touched:**

- `frontend/package.json`
- `frontend/src/main.tsx`
- `frontend/src/app/App.tsx`
- `frontend/src/app/App.test.tsx`
- `frontend/src/features/auth/StaffSignInPage.tsx`

**Estimated scope:** Medium (5 files)

## Task 2: Establish customer design-system foundations

**Description:** Convert the documented palette, typography roles, spacing, borders, focus styles,
and action hierarchy into reusable tokens and small accessible primitives used by customer pages.

**Acceptance criteria:**

- [x] Color, spacing, typography, radius, and motion values use named tokens rather than repeated literals.
- [x] Primary, secondary, and text actions have consistent hover, focus, disabled, and pressed states.
- [x] Reduced motion, 200% zoom, forced colors, contrast, and 44px interaction targets are supported.

**Verification:**

- [x] Component tests cover accessible names, selected states, and disabled behavior.
- [x] Manual checks run at 320px, 768px, 1024px, and 1440px.
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass in `frontend/`.

**Dependencies:** Task 1

**Files likely touched:**

- `frontend/src/index.css`
- `frontend/src/design-system/Button.tsx`
- `frontend/src/design-system/Button.test.tsx`
- `frontend/src/design-system/PageHeader.tsx`

**Estimated scope:** Medium (4 files)

## Task 3: Build typed menu browsing

**Description:** Add a catalog data boundary and render the `/shop`
menu with location, category filters, availability, product summaries, and current-order access.

**Acceptance criteria:**

- [x] Available drinks expose name, flavor note, image alternative text, and formatted SGD starting price.
- [x] Filtering is keyboard accessible and unavailable products cannot enter customization.
- [x] Available, filtered, unavailable, loading, empty, and API-error states are explicit and tested.

**Verification:**

- [x] Component tests cover catalog states, category filters, and unavailable products.
- [x] Browser accessibility-tree and responsive checks cover semantic navigation and product headings.
- [x] Frontend test, typecheck, lint, and build commands pass.

**Dependencies:** Tasks 1 and 2

**Files likely touched:**

- `frontend/src/features/catalog/types.ts`
- `frontend/src/features/catalog/catalogClient.ts`
- `frontend/src/features/catalog/useGuestCatalog.ts`
- `frontend/src/features/catalog/ShopPage.tsx`
- `frontend/src/features/catalog/ShopPage.test.tsx`

**Estimated scope:** Medium (5 files)

## Task 7: Load the guest catalog from PostgreSQL

**Description:** Seed the MVP location catalog through new Flyway migrations, expose public Spring
menu/product DTO endpoints, and remove runtime frontend business-data fixtures.

**Acceptance criteria:**

- [x] Products, location, currency, prices, availability, variants, options, and defaults are stored
  in PostgreSQL and returned by Spring.
- [x] The frontend validates responses and shows loading, empty, and recoverable error states.
- [x] Production frontend code contains no fallback catalog or hard-coded catalog values.
- [x] `AGENTS.md` requires application-domain values to flow through Spring from PostgreSQL.

**Verification:**

- [x] Backend integration tests cover migrations, public access, DTO shape, and 404 problem details.
- [x] Frontend tests cover client validation and API-backed browse/customize/cart behavior.
- [x] Compose and real-browser verification pass against the migrated local database.

**Dependencies:** Tasks 3–6

## Task 4: Build responsive drink customization

**Description:** Add `/shop/drinks/:drinkId` with size, sweetness, ice, and topping choices. Render it
as a side panel on wide screens and a focused page on phones while preserving one semantic form.

**Acceptance criteria:**

- [x] Radio groups and checkboxes expose labels, selected state, availability, and price deltas.
- [x] The displayed total updates deterministically and is announced without moving focus.
- [x] Unknown or unavailable drinks provide a recovery path to `/shop`.

**Verification:**

- [x] Tests cover default options, total changes, unavailable options, and unknown drink IDs.
- [x] Keyboard, screen-reader, 200% zoom, reduced-motion, and breakpoint checks pass.
- [x] Frontend test, typecheck, lint, and build commands pass.

**Dependencies:** Task 3

**Files likely touched:**

- `frontend/src/features/catalog/DrinkCustomizer.tsx`
- `frontend/src/features/catalog/DrinkCustomizer.test.tsx`
- `frontend/src/features/catalog/pricing.ts`
- `frontend/src/features/catalog/pricing.test.ts`
- `frontend/src/features/catalog/DrinkPage.tsx`

**Estimated scope:** Medium (5 files)

## Task 5: Add current-order state

**Description:** Introduce narrowly scoped client state for configured line items, quantities, and
preview totals, then connect the customizer's primary action to that state.

**Acceptance criteria:**

- [x] Adding the same configuration increments quantity; different configurations stay separate.
- [x] The header count and preview total update after add, quantity change, or removal.
- [x] No client-owned organization, location, availability, or price value is represented as authoritative.

**Verification:**

- [x] Reducer tests cover add, merge, quantity change, remove, and clear operations.
- [x] Component test confirms add-to-order feedback and current-order count.
- [x] Frontend test, typecheck, lint, and build commands pass.

**Dependencies:** Task 4

**Files likely touched:**

- `frontend/src/features/cart/types.ts`
- `frontend/src/features/cart/cartReducer.ts`
- `frontend/src/features/cart/cartReducer.test.ts`
- `frontend/src/features/cart/CartProvider.tsx`
- `frontend/src/features/catalog/DrinkPage.tsx`

**Estimated scope:** Medium (5 files)

## Task 6: Add cart review and cash-pickup handoff

**Description:** Add `/cart` so guests can review configurations, adjust quantities, remove items,
see preview totals, and understand the future pickup/cash checkout flow without submitting an order.

**Acceptance criteria:**

- [x] Empty and populated carts have clear routes back to the menu.
- [x] Each line item exposes its configuration, quantity controls, item total, edit, and remove actions.
- [x] The checkout handoff is visibly unavailable or marked as a demo until a Spring endpoint exists.

**Verification:**

- [x] Component tests cover empty cart, quantity edits, removal, totals, and disabled handoff.
- [x] Manual keyboard and screen-reader checks confirm focus and status messages remain understandable.
- [x] Browser console and accessibility-tree review are clean at all supported breakpoints.
- [x] Frontend test, typecheck, lint, and build commands pass.

**Dependencies:** Task 5

**Files likely touched:**

- `frontend/src/features/cart/CartPage.tsx`
- `frontend/src/features/cart/CartPage.test.tsx`
- `frontend/src/features/cart/CartLineItem.tsx`
- `frontend/src/app/App.tsx`
- `frontend/src/index.css`

**Estimated scope:** Medium (5 files)
