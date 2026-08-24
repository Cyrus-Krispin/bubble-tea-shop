# Customer Ordering Visual Style Guide

This guide defines the photographic visual direction for Bubble Tea Shop's customer ordering
experience. Implementation must preserve usability, accessibility, responsive behavior, and the
schema-first product boundary as the interface evolves.

## Visual identity

The customer experience should feel like a contemporary neighborhood tea bar photographed in
warm natural light. Real drinks and welcoming storefronts lead the interface; restrained ivory,
forest, and apricot surfaces keep ordering calm and legible.

- Show the selected shop, drink, essential choices, price, and next action before decoration.
- Use realistic photography to distinguish products and places without introducing fictional
  labels, packaging brands, people, or text inside images.
- Keep generous whitespace and one dominant action per step.
- Prefer honest ingredients, natural texture, and plausible café lighting over exaggerated color,
  animation, illustration, or synthetic glossy effects.

## Color and typography

Use the existing customer tokens as the base palette and confirm every foreground/background pair
with automated contrast checks.

| Token | Value | Use |
|---|---:|---|
| `canvas` | `#FFFDF7` | Page background and breathing room |
| `surface` | `#FFF9EE` | Cards and customization panels |
| `ink` | `#23332B` | Primary text |
| `forest` | `#496B35` | Selected states and secondary actions |
| `forest-strong` | `#315126` | Accessible emphasis on light surfaces |
| `apricot` | `#F47A32` | Primary ordering action |
| `apricot-strong` | `#C84F16` | Hover, pressed, and strong emphasis |
| `line` | `#E8D9C4` | Dividers and inactive boundaries |
| `muted-ink` | `#667269` | Supporting copy |

Ivory should dominate, forest should organize, and apricot should identify the primary action.
Never rely on color alone for selection, status, errors, or availability.

Use a warm, readable display serif for the brand, page titles, and drink names, paired with a
highly legible humanist sans serif for prices, descriptions, controls, and operational copy. Keep
interface text at least `1rem`, limit all-caps text, and avoid novelty lettering in controls.

## Photography system

Every public drink and location record exposes a lowercase kebab-case image key through Spring's
PostgreSQL-backed APIs. The frontend maps that presentation key to a reviewed, optimized local
WebP asset; it must not invent a product, shop, price, availability value, or runtime fallback
catalog.

Drink photographs should:

- use a consistent portrait crop with one clear cup, realistic liquid and toppings, a neutral
  warm café setting, soft daylight, and enough edge space for responsive `object-fit: cover`;
- match the named recipe visually without text, logos, branded packaging, hands, or implausible
  ingredients;
- retain enough tonal contrast against the card and avoid important details at crop boundaries.

Location photographs should:

- use a consistent landscape storefront or interior crop with a believable Singapore neighborhood
  context and warm daylight;
- avoid readable branding, promotional text, identifiable faces, and decorative drink lineups that
  could be mistaken for catalog offerings;
- keep the main architectural subject centered enough for desktop and phone card crops.

Generated source files are not runtime dependencies. Production assets belong under
`public/assets/catalog`, use explicit intrinsic dimensions, and should be compressed to WebP after
visual review. Menu images load lazily; the primary product detail image may load eagerly. Keep
layout dimensions reserved to prevent content shift.

Meaningful standalone drink photographs need concise alternative text such as “Mossy Matcha in a
clear cup.” Shop thumbnails in the location picker use empty alternative text because the adjacent
shop name already supplies the accessible name.

## Layout, cards, and controls

Build pages on an eight-point spacing rhythm. Desktop pages use a centered container with generous
outer margins; phones use a single column without reducing text or touch targets. Location choices
appear before the menu so pricing and checkout context remain clear.

Product cards feature one large photograph, the product name, a short flavor note, and a clearly
formatted database-owned starting price. Shop selection stays compact: a “Pickup at” disclosure
beside the menu heading shows only a small selected-shop thumbnail and name until opened. Its
anchored panel lists the two shop routes with restrained thumbnails and a visible current marker;
it never becomes a hero gallery or full-screen picker. Use a quiet boundary, moderate radius, and
restrained shadow. Selected or current states need a visible non-color cue such as text or a check.

Use standard accessible controls:

- segmented controls for mutually exclusive choices such as size, sweetness, and ice;
- checkbox-style tiles for optional toppings, with selection communicated beyond color;
- literal labels, visible price deltas, and a current total near the primary action;
- one dominant apricot action per step and forest treatments for secondary actions.

All interactive targets should be at least `44px` square. Keyboard focus must be visible and not
clipped by rounded containers.

## Responsive image behavior

- Wide screens align the compact location disclosure beside the menu heading.
- Tablets retain two columns only while cards and controls remain comfortable.
- Phones keep the same disclosure pattern at full container width, around `64–72px` tall when
  collapsed; the anchored option panel stays within the viewport.
- Keep text in document flow; never bake shop names, prices, labels, or availability into photos.
- Verify focal points at representative phone, tablet, and desktop widths before release.
- Prefer CSS cropping with stable aspect ratios over separate domain-specific mobile assets.

## Accessibility and interaction

Target WCAG 2.2 AA. Preserve heading order, landmarks, labels, descriptions, and error associations;
support keyboard-only ordering, screen readers, 200% zoom, and text reflow. Announce price and
selection changes without moving focus unexpectedly. Pair error color with actionable text and
retain customer choices after validation.

Respect reduced-motion preferences. Photography must not require parallax, autoplay, or animation
to understand the page. Loading and error states reserve space and use plain progress or recovery
copy. Cart and checkout must state the selected shop, prevent mixed-location carts, and explain
cash pickup before submission.

## Customer and staff separation

The photographic treatment belongs primarily to public shop selection, menu browsing,
customization, cart, checkout, and guest order status. Staff and owner operations remain denser and
more utilitarian, sharing tokens and accessible controls but prioritizing stable alignment, status
clarity, data density, and keyboard workflows.

## Image generation brief

Use this reusable structure when extending the catalog:

```text
Use case: product-mockup
Asset type: photorealistic bubble tea product or Singapore tea-shop location photograph
Primary request: create one realistic, original subject matching the database-owned product or
location name and description.
Composition: clean centered subject, generous crop-safe edges, no collage; portrait 4:5 for drinks
or landscape 3:2 for shops.
Lighting/mood: soft warm natural daylight, welcoming contemporary café, realistic materials.
Palette: warm ivory, natural tea colors, restrained forest green and apricot accents.
Constraints: no text, logo, watermark, brand, identifiable face, illustration, animation, fake UI,
or unrelated products; plausible ingredients and scale; consistent with the existing photo set.
```

Review every result at full size. Reject malformed cups, inconsistent shadows, illegible generated
signage, unintended brands, misleading extra products, or focal points that fail responsive crops.
