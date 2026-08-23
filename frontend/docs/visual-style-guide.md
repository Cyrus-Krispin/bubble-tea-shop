# Modern Tea Bar Product Experience

This guide replaces the previous visual direction rather than extending it. Bubble Tea Shop is a
fast, contemporary consumer ordering product first. Its interface should feel like a modern
independent tea bar: product-led, direct, energetic, and composed.

## Objective

Help a guest discover a drink, understand customization, and place a cash pickup order with as
little friction as possible. Help staff complete repeated operational work quickly and accurately.
The guest and staff products share one brand system but use different information density.

Success means:

- the menu is the home page and guest ordering never passes through an account gate;
- every current customer and staff workflow remains available and API-backed;
- customer sign-in and registration share one compact access surface;
- the experience works at 320, 768, 1024, and 1440 CSS pixels and at 200% zoom;
- interactive controls meet WCAG 2.2 AA and use at least a 44-pixel house target;
- no business data, availability, price, badge, rating, or promotion is invented in the client.

## Research basis

The direction draws on current Gong cha, Boba Guys, and CHAGEE product presentation and on Baymard
research for mobile commerce, product pages, guest checkout, and checkout review. The common useful
patterns are direct menu entry, short category navigation, product-first imagery, exposed variant
choices, explicit guest checkout, visible totals, and compact checkout copy.

## Brand system

### Palette

Cool white and soft lavender carry nearly the entire interface. Ube violet is the functional brand
color; calamansi lime is a scarce highlight. The drink artwork supplies warmth and ingredient
color. This deliberately avoids the category's crowded cream/red, orange, heritage-green, and
near-black systems, while remaining more specific to a modern drink shop than generic cafe beige.

| Token | Value | Role |
|---|---:|---|
| `canvas` | `#f7f7fb` | App background |
| `surface` | `#ffffff` | Product and form surfaces |
| `surface-subtle` | `#f0edff` | Selected and compact supporting surfaces |
| `ink` | `#17131f` | Primary type and strong structure |
| `muted` | `#625b6b` | Supporting type |
| `line` | `#ded9e5` | Decorative dividers |
| `line-strong` | `#958b9f` | Interactive control boundaries |
| `primary` | `#6b2bd9` | Primary actions and current navigation |
| `primary-strong` | `#5420b5` | Hover and pressed action state |
| `primary-soft` | `#eee8ff` | Selected and informational surfaces |
| `highlight` | `#c8f169` | Small freshness and conversion highlights |
| `flavor` | `#d91e63` | Rare product/promotion accent |
| `success` | `#18794e` | Successful operational states |
| `warning` | `#8a4b08` | Low stock and attention states |
| `danger` | `#b42318` | Destructive actions and errors |

Keep neutral surfaces to roughly 85–90% of each screen. Violet is functional; lime and lychee are
accents, never a three-color decoration. Do not use gradients, glass effects, paper texture,
fantasy scenery, decorative sparkles, floating boba circles, or color-only state.

### Typography

Use a contemporary system sans stack for both editorial and interface text. Display hierarchy
comes from weight, scale, and spacing—not a novelty serif. Headlines are compact and literal.

- Display: `Avenir Next`, `Helvetica Neue`, Arial, sans-serif; 700–800 weight.
- Interface: Inter where available, then the system sans stack.
- Customer page title: `clamp(2rem, 4vw, 3.5rem)`.
- Staff page title: `clamp(1.75rem, 3vw, 2.5rem)`.
- Body text never falls below `1rem`; supporting metadata never falls below `0.8125rem`.

Avoid poetic slogans where a task label is clearer. Use “Menu”, “Customize your drink”, “Your
order”, “Pay cash at pickup”, and “Staff access”.

### Geometry and motion

- Use an eight-point spacing rhythm with four pixels only for optical correction.
- Use 8px controls and 10–12px product/surface radii. Pills are limited to category filters,
  status labels, and count badges.
- Prefer a one-pixel boundary and no shadow. A restrained shadow is allowed only for overlays and
  sticky mobile actions.
- Interactions use 140–180ms easing and must disappear under `prefers-reduced-motion`.

## Customer information architecture

`/` is the menu. `/shop` remains a compatibility alias. The persistent customer header contains
the brand, current menu link, account access, and order/cart count. Staff access is a quiet footer
or direct-link concern, never a competing customer call to action.

The menu begins with a compact title and pickup-location/payment context, followed by a sticky
category rail and the products returned by Spring. Product cards show the drink artwork, category,
name, short description, starting price, availability, and one customization action. Do not add
fake ratings, popularity, dietary attributes, or marketing badges.

Customization uses a dedicated route. Desktop shows the drink at left and a sticky decision panel
at right. Mobile uses a single document with a persistent total/action bar. Size, sweetness, ice,
milk, and topping choices remain visible as radios or checkboxes with literal names and price
deltas. Unavailable choices remain readable and visibly disabled.

The cart is a one-page review. Each line shows quantity, complete configuration, remove control,
and line total. The summary shows pickup method, preview total, and the explicit action
`Place order · <total>`. Confirmation prioritizes the public order number, pending status, cash due,
and the next action.

## Authentication flow

Customer sign-in and registration live on one compact `/account/access` route with an in-place mode
switch. Old customer auth routes redirect to the corresponding mode. Guest ordering stays visible
and available. Successful sign-in returns to a validated same-origin `next` application path.

Staff sign-in uses the same form language but remains an intentional staff entry because Spring—not
the browser—resolves staff membership. The interface never offers a role picker or implies that
registration grants staff authority.

The form has visible labels, password visibility controls, generic provider-safe errors, progress
text, and a single dominant action. Recovery controls appear only when supported by the current
authentication contract; do not ship an inert “Forgot password?” link.

## Staff workspace

Desktop staff navigation is a left rail with brand, primary modules, and account controls. The
workspace is a neutral high-density canvas with a compact page heading, scope controls, page action,
and then the relevant table, form, or detail surface. Mobile uses a clearly labeled horizontally
scrollable module bar until a dedicated drawer is justified.

Tables remain semantic tables. Horizontal scrolling is acceptable for exact operational data, but
the scope, primary action, status, and recovery controls must remain visible. Dialogs use the same
field and action hierarchy as pages. Status always combines words with color.

## State and accessibility contract

Every route handles loading, empty, error, denied, unavailable, and success states without layout
collapse. Focus is visible, never clipped, and follows document order. Selection and availability
never depend on color alone. Live regions announce price, cart, and mutation updates without moving
focus. Content reflows at 200% zoom, controls remain usable by keyboard, and forced-colors mode
retains boundaries and selection.

## Commands and verification

Run from `frontend/`:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm e2e
```

Use Vitest and Testing Library for state and accessible interaction contracts, axe for automated
WCAG checks, and a real browser for desktop/mobile layout, keyboard navigation, console/network,
and screenshot review.

## Boundaries

- Always preserve API-backed catalog, pricing, inventory, organization, location, and role data.
- Always preserve idempotent order retry, optimistic concurrency, archival history, and server-side
  authorization behavior.
- Ask before changing API contracts, adding dependencies, or expanding deferred product scope.
- Never add a runtime fixture catalog, fake merchandising data, client-owned authorization, secrets,
  biometric behavior, or unimplemented navigation.
