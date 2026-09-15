# Staff counter order entry

Managers can select an assigned shop, configure drinks from its current API-backed menu, and create
an anonymous pending cash order from the staff workspace. Completing that order uses the existing
cash confirmation, payment recording, immutable consumption, and atomic shortage handling.

## Acceptance and decisions

- The server resolves current staff/location access, prices, options, currency, and consumption.
- The creating staff account is stored on the immutable initial order-status event. The employee
  is not the customer and does not receive the counter order in their private purchase history.
- Reuse the guest placement transaction and catalog rules. Extend fingerprints with the staff actor
  for counter orders; preserve existing guest fingerprints and reject mismatched key reuse.
- Creation is pending and does not deduct stock. Repeating a matching request returns the same order;
  a different payload or actor cannot recover it by reusing a placement key.
- The staff composer supports multiple configured drink lines and quantities, removes lines, shows
  preview totals, and displays the server-confirmed pickup number and total after submission.
- Staff explicitly confirm collected cash through the order queue; no automatic collection is implied.

Tests cover actor/customer separation, authorization, key replay, no premature stock movement, and
browser counter entry. Use backend `./mvnw verify` and frontend `pnpm test`, `pnpm typecheck`,
`pnpm lint`, `pnpm build`, plus desktop/mobile counter-order Playwright checks. No new schema is
needed; the existing immutable status history already records the creating actor.
