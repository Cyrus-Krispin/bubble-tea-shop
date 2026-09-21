# Favorite drink and checkout discount

A signed-in customer can choose or remove one favorite recipe per organization from the current
shop menu. The preference belongs to the customer resolved from the authenticated subject; the
request never accepts an account or organization identifier.

## Product rules

- Ordering owns the favorite preference because it participates in checkout pricing. Catalog and
  identity remain owners of recipe and account records. Recipe selection must be currently offered
  at the chosen active location; archived recipes cannot be newly selected or earn a discount.
- The favorite grants 5% of one eligible base drink per order, rounded down to minor currency units.
  Apply the largest eligible discount if several matching drinks/sizes occur. Add-ons do not earn
  extra discount. Cap savings at that unit's actual configured price so totals cannot be negative.
- Anonymous and staff-counter orders have no customer favorite discount. A signed-in staff account
  using the customer checkout behaves as a customer; privileges never increase its discount.
- Checkout quotes and placement share the same server pricing rules. Quotes are estimates, not
  reservations; the confirmed order snapshots subtotal, savings, selected recipe, and final total.
- Matching placement-key retries retain the original order and discount even if the customer later
  changes their favorite. Payment amount and cash collection use the discounted confirmed total.
- Customer and staff receipts show savings. Preference removal is permitted; historical order and
  recipe records remain intact. No limit on preference changes or per-customer order frequency.

## Verification

Cover customer isolation, inactive/foreign/unoffered recipes, clearing a preference, anonymous and
counter exclusions, multiple units/sizes, integer rounding, negative-price effects, original-price
replay, quote/placement parity, and receipt totals. Run full affected suites and desktop/mobile
customer favorite-to-checkout flows. Add the migration and update ownership, ERD, dictionary,
invariants, generated API/types, and the completion plan.
