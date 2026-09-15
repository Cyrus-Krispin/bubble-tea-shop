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

## Retry recovery

Keep the draft, shop selection, confirmed result, and request key in an account-scoped in-memory
staff cache above route permission revalidation. Routine token refresh can temporarily hide the
route without erasing the transaction. Sign-out/account replacement discards private cached state.
If an earlier attempt has an uncertain outcome, a later authorization error must preserve its key;
restored access retries the same immutable payload. An explicit first-attempt rejection may unlock
correction. The permission error screen offers another access check without requiring sign-out.
The cache also owns the in-flight flag so revalidation cannot enable a second request before the
first settles. A 30-second timeout leaves an uncertain request recoverable with its original key.
