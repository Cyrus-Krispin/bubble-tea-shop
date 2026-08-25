# Ube, Calamansi, and Photographic Product Experience

This guide defines Bubble Tea Shop as a fast, contemporary ordering product with a realistic,
product-led visual system. The interface should feel like a modern independent tea bar: direct,
energetic, composed, and grounded in honest drink and shop photography.

## Objective

Help a guest discover a drink, choose a pickup shop, understand customization, and place a cash
pickup order with as little friction as possible. Help staff complete repeated operational work
quickly and accurately. The guest and staff products share one brand system but use different
information density.

Success means:

- the menu is the home page and guest ordering never passes through an account gate;
- every customer and staff workflow remains API-backed;
- customer sign-in and registration share one compact access surface;
- the experience works at 320, 768, 1024, and 1440 CSS pixels and at 200% zoom;
- interactive controls meet WCAG 2.2 AA and use at least a 44-pixel target;
- no business data, availability, price, location, badge, rating, or promotion is invented in the
  client.

## Brand system

Cool white and soft lavender carry most of the interface. Ube violet is the functional brand
color; calamansi lime is a scarce highlight. Realistic drink photography supplies warmth and
ingredient color.

| Token | Value | Role |
|---|---:|---|
| `canvas` | `#f7f7fb` | App background |
| `surface` | `#ffffff` | Product and form surfaces |
| `surface-subtle` | `#f0edff` | Selected and supporting surfaces |
| `ink` | `#17131f` | Primary type and strong structure |
| `muted` | `#625b6b` | Supporting type |
| `line` | `#ded9e5` | Decorative dividers |
| `line-strong` | `#958b9f` | Interactive boundaries |
| `primary` | `#6b2bd9` | Primary actions and current navigation |
| `primary-strong` | `#5420b5` | Hover and pressed actions |
| `primary-soft` | `#eee8ff` | Selected and informational surfaces |
| `highlight` | `#c8f169` | Small freshness highlights |
| `flavor` | `#d91e63` | Rare product accent |
| `success` | `#18794e` | Successful states |
| `warning` | `#8a4b08` | Attention states |
| `danger` | `#b42318` | Errors and destructive actions |

Keep neutral surfaces to roughly 85–90% of each screen. Violet is functional; lime and lychee are
accents. Do not use gradients, glass effects, fantasy scenery, decorative sparkles, floating boba
circles, or color-only state.

Use a contemporary system sans stack. Display hierarchy comes from weight, scale, and spacing,
not novelty type. Body text never falls below `1rem`; supporting metadata never falls below
`0.8125rem`. Use literal task labels such as “Customize your drink” and “Pay cash at pickup.”

Use an eight-point spacing rhythm. Controls use 8px radii and product surfaces use 10–12px radii.
Pills are limited to category filters, status labels, and count badges. Prefer one-pixel boundaries
and reserve shadows for overlays and sticky mobile actions.

## Photography system

Every public drink and location record exposes a lowercase kebab-case image key through Spring's
PostgreSQL-backed APIs. The frontend maps that presentation key to a reviewed, optimized local WebP
asset; it must not invent a product, shop, price, availability, location, or runtime fallback
catalog.

Drink photographs should use a consistent crop with one clear cup, realistic liquid and toppings,
a neutral café setting, soft daylight, and enough edge space for responsive `object-fit: cover`.
They must match the recipe without text, logos, branded packaging, hands, or implausible ingredients.

Location photographs should use a landscape storefront or interior crop with a believable
Singapore neighborhood context and warm daylight. Avoid readable branding, promotional text,
identifiable faces, and decorative drink lineups that could be mistaken for catalog offerings.

Runtime assets belong under `public/assets/catalog`, use explicit intrinsic dimensions, and are
compressed to WebP after visual review. Menu images load lazily; the primary product and selected
location images may load eagerly. Meaningful drink photographs use concise alternative text. Shop
thumbnails use empty alternative text because the adjacent shop name supplies the accessible name.

## Customer information architecture

`/` is the API-backed menu and `/shop` is a compatibility alias. The header contains the brand,
menu link, account access, and cart count. Staff access remains a quiet secondary concern.

The menu begins with a compact title and a “Pickup at” disclosure beside it. The closed control
shows one small selected-shop photograph and name. Its anchored panel lists the API-returned shop
routes with restrained thumbnails and a visible current marker; it never becomes a hero gallery,
modal, or full-screen picker. Phones use the same control at full container width, approximately
64–72px tall when closed.

The category rail stays visible while browsing. Product cards show a realistic photograph,
category, name, description, database-owned starting price, availability, and one customization
action. Do not add fake ratings, popularity, dietary attributes, or marketing badges.

Customization uses a dedicated route. Desktop shows the drink at left and a decision panel at
right. Mobile uses one document with a persistent total/action bar. Size, sweetness, ice, milk,
and topping choices remain visible as native radios or checkboxes with literal names and price
deltas. Unavailable choices remain readable and disabled.

The cart is a one-page review. Each line shows quantity, configuration, remove control, and line
total. The summary shows the selected pickup shop, pickup method, preview total, and explicit order
action. Confirmation prioritizes the public order number, pending status, cash due, and next action.
Mixed-location carts remain blocked.

## Authentication and staff workspace

Customer sign-in and registration live on one compact `/account/access` route with an in-place mode
switch. Old routes redirect to the corresponding mode. Successful sign-in returns only to a
validated same-origin application path. Staff sign-in remains separate because Spring resolves
staff membership; the interface never offers a role picker.

Desktop staff navigation uses the redesigned left rail. The workspace is a neutral high-density
canvas with compact headings, scope controls, actions, and semantic tables. Mobile uses the labeled
horizontal module bar. Status always combines words with color.

## State and accessibility contract

Every route handles loading, empty, error, denied, unavailable, and success states without layout
collapse. Focus is visible and follows document order. Selection and availability never depend on
color alone. Live regions announce price, cart, and mutation updates without moving focus. Content
reflows at 200% zoom and forced-colors mode retains boundaries and selection.

The location disclosure uses a native button with `aria-expanded` and `aria-controls`, then an
ordinary list of route links. Enter or Space toggles it; Escape closes it and restores trigger
focus; outside click closes it. It does not impersonate a menu, listbox, or editable combobox.

## Image generation brief

```text
Use case: product-mockup
Asset type: photorealistic bubble tea product or Singapore tea-shop location photograph
Composition: one centered subject, crop-safe edges; portrait 4:5 for drinks or landscape 3:2 for shops
Lighting: soft warm natural daylight in a plausible contemporary café
Constraints: no text, logo, watermark, identifiable face, illustration, fake UI, or unrelated products
```

Reject malformed cups, inconsistent shadows, generated signage, unintended brands, misleading
extra products, or focal points that fail responsive crops.

## Verification and boundaries

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm e2e` from `frontend/`.
Verify desktop and phone layouts, keyboard behavior, axe results, console/network output, image
loading and cropping, location-scoped checkout, and screenshot review in a real browser.

Always preserve API-backed catalog, pricing, inventory, organization, location, and role data;
idempotent order retry; optimistic concurrency; archival history; and server-side authorization.
Never add a runtime fixture catalog, fake merchandising data, client-owned authorization, secrets,
biometric behavior, or unimplemented navigation.

## Product-maturity benchmarks

The refinement bar is informed by current, public patterns rather than visual imitation:

- [Baymard food delivery and takeout UX research](https://baymard.com/audits/food-delivery-and-takeout)
  treats menu discovery, food customization, cart behavior, guest checkout, and pickup context as
  one continuous conversion flow.
- [Gong cha product discovery](https://www.gong-cha.com/our-products/) keeps drink photography and
  customization central to the menu experience.
- [Toast order-screen guidance](https://support.toasttab.com/en/article/New-POS-Experience-Ordering-Screens)
  prioritizes frequent actions, search, and rapid order scanning in restaurant operations.
- [Square inventory guidance](https://squareup.com/help/us/en/article/6110-manage-inventory-with-the-retail-pos-app)
  uses visible scope, filters, stock state, and actions close to the affected record.
- [Shopify's index-table pattern](https://shopify.dev/docs/api/app-home/patterns/compositions/index-table)
  emphasizes scannable resource lists, search/filter context, row actions, and responsive behavior.

Applied principles:

- reserve expressive display type for customer merchandising; staff headings and controls use a
  calmer, denser hierarchy;
- keep API-resolved pickup context adjacent to menu discovery and checkout actions;
- preserve image geometry and prioritize the first visible product row so catalog cards do not
  appear unfinished while scrolling;
- make customer primary actions at least 44 pixels and keep mobile purchase actions visible without
  obscuring validation or the final control;
- turn staff tables into labeled stacked rows on narrow screens rather than requiring horizontal
  scrolling for routine work;
- lead operational pages with scope, status, next actions, and derived summaries before historical
  or configuration detail;
- use one restrained surface/border system and reduce nested cards before adding decoration.
