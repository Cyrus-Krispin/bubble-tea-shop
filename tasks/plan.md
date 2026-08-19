# Implementation Plan: Guest Bubble Tea Shop Foundation

## Overview

Build the first customer-facing ordering journey without weakening the existing staff authentication
boundary. The application entry page will clearly separate guest ordering from staff operations:
`Continue as guest` is the primary action and opens `/shop`, while staff sign-in moves to
`/staff/sign-in`. The shop will follow the existing minimalist storybook direction and initially use
typed demo menu data behind a replaceable data boundary because guest catalog and ordering APIs are
scheduled for Phase 3.

## Experience Structure

```text
/
├── Continue as guest ──> /shop
└── Staff sign in ──────> /staff/sign-in

/shop
├── Browse available drinks
├── Filter by a small set of menu categories
├── Select a drink ─────> /shop/drinks/:drinkId
└── Open current order ─> /cart

/shop/drinks/:drinkId
├── Choose size, sweetness, ice, and toppings
└── Add configured drink to the current order

/cart
├── Review, edit, or remove items
└── Continue to cash checkout (later API-backed slice)
```

On wide screens, the drink route should render as the existing 64/36 menu-and-customizer split. On
phones, the same route should become a focused full-page customization step. This keeps URL and
decision order stable across breakpoints without forcing a cramped side panel onto small screens.

## Architecture Decisions

- Keep customer and staff routes in the same React SPA, but give them separate layouts and visual
  priorities. Storybook illustration belongs to public ordering; staff screens remain utilitarian.
- Add a small client-side router rather than conditional page state. Direct URLs, browser history,
  refreshes, tests, and future guarded staff routes then have one consistent model.
- Introduce semantic CSS custom properties and a small set of reusable primitives before expanding
  shop screens. Retain the documented palette and eight-point spacing rhythm; defer Tailwind,
  Radix, and Storybook setup to their planned design-system increment unless a component needs an
  accessible behavior that the platform cannot provide cleanly.
- Keep catalog data access separate from presentation. Use typed local fixtures for this frontend
  foundation, then replace the fixture adapter with the generated Spring OpenAPI client when the
  Phase 3 guest-menu API exists.
- Keep the current order in a narrowly scoped React context with a reducer. Persisting an unfinished
  guest order is optional for the first slice; server-created prices and order totals will replace
  client calculations before checkout can submit.
- Never present fixture availability, price, or a client-computed total as server-authoritative.
  Checkout submission remains out of scope until Spring exposes guest ordering endpoints.

## Page Design

### Welcome (`/`)

- Preserve the existing brand header and warm ivory canvas.
- Lead with customer copy and one apricot `Continue as guest` action.
- Show `Staff sign in` as a quieter forest-outline action with an explicit `Staff` label.
- Avoid an account-creation prompt because customer accounts are deferred from the MVP.

### Shop (`/shop`)

- Header: brand, active location, `Menu`, `Track order`, and a current-order button with item count.
- Main content: `Choose your brew`, concise category filters, availability feedback, and a product
  grid containing illustration, name, flavor note, and SGD price.
- Product selection uses a visible outline and text/icon cue, not color alone.
- Empty, loading, and error states reserve the same layout and provide a clear recovery action.

### Drink customization (`/shop/drinks/:drinkId`)

- Use literal controls for size, sweetness, ice, and toppings.
- Show all price deltas before selection and announce total changes through a polite live region.
- Use radio groups for mutually exclusive choices and checkboxes for optional toppings.
- Keep one primary action: `Add to order · $x.xx`.
- On mobile, keep the total and primary action reachable without hiding content behind the browser
  viewport or reducing the 44px target minimum.

### Current order (`/cart`)

- Show configured choices, quantity, item price, order total, edit, and remove controls.
- Include a useful empty state that returns the guest to the menu.
- Explain that the MVP is pickup with cash payment before the future checkout action.

## Task List

### Phase 1: Navigation and visual foundation

- [x] Task 1: Add route shell and separate guest/staff entry paths.
- [x] Task 2: Extract customer-facing tokens and reusable controls from the current global styles.

### Checkpoint: Entry flow

- [x] `Continue as guest` reaches `/shop` with browser history and keyboard navigation working.
- [x] Existing staff sign-in behavior and tests still pass at `/staff/sign-in`.
- [x] Layout is usable at 320px, 768px, 1024px, and 1440px.

### Phase 2: Browse and customize

- [x] Task 3: Add the typed catalog fixture boundary and shop browsing screen.
- [x] Task 4: Add responsive, accessible drink customization.

### Checkpoint: Menu flow

- [x] A guest can browse, select, configure, and price a demo drink without signing in.
- [x] Static unavailable and unknown-drink states are covered; async loading and error states wait for the API adapter.
- [x] Automated component tests, lint, typecheck, and production build pass.

### Phase 3: Current order

- [x] Task 5: Add current-order state and add-to-order behavior.
- [x] Task 6: Add the cart review screen and cash-pickup handoff state.

### Checkpoint: Frontend foundation complete

- [x] A guest can complete the browse-to-cart flow with keyboard or pointer input.
- [x] State and price announcements are exposed through semantic controls and live regions.
- [x] Browser console, accessibility-tree review, responsive checks, and frontend verification are clean.
- [x] The UI clearly labels demo data and does not submit an order without a backend API.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Guest catalog APIs do not exist yet | High | Put typed fixtures behind a data adapter and keep checkout non-submitting. |
| Client totals diverge from future server prices | High | Treat displayed totals as previews and accept server-owned snapshots only when APIs arrive. |
| Customer visuals leak into staff operations | Medium | Use separate route layouts while sharing only foundational tokens and controls. |
| Customization becomes cramped on phones | Medium | Use the drink URL as a full-page mobile step and the 64/36 panel only on wide screens. |
| Decorative art harms performance or accessibility | Medium | Start with CSS accents/placeholders, lazy-load meaningful art, and keep text outside images. |
| Cart state is lost on refresh | Low | Decide on session storage after the first in-memory flow; version and validate persisted data if added. |

## Open Questions

- Should the first shop increment use polished placeholder drink art, or should original production
  illustrations be created before implementation?
- Should an unfinished current order survive a browser refresh in the first release, or is
  in-memory state sufficient until the backend order API exists?
- What public location name should replace the concept's `Orchard Central` placeholder?

## Explicitly Deferred

- Customer accounts, loyalty, favorites, discounts, card payment, and face authentication.
- Server-authoritative catalog availability, price snapshots, order placement, and order tracking.
- Staff catalog management, inventory screens, and order completion UI.
- Tailwind, Radix, Storybook, TanStack Query, and generated OpenAPI client adoption unless required
  by the corresponding backend/design-system increment.
