# Guest Order Placement

## Purpose

Guest checkout turns a client-side cart into immutable order, option, price, payment, and ingredient
consumption snapshots. The client supplies a public location slug, catalog identifiers, and
quantities only. Spring resolves the active guest location and treats the current PostgreSQL catalog as the sole source
of names, availability, recipes, prices, currency, and ownership.

The MVP creates pending cash orders. Placement does not reserve or deduct inventory; authorized
staff completion performs the atomic stock check and deduction described in the database
invariants.

## Request and identity boundary

- `POST /api/v1/guest/locations/{locationSlug}/orders` is available without authentication. The
  legacy `POST /api/v1/guest/orders` route resolves the configured default shop.
- A valid optional bearer token links the order to its enabled application customer account. A
  missing token creates a guest order. Invalid bearer tokens are rejected by the resource server.
- The request contains one to 25 lines. Each line contains an available variant ID, a quantity from
  one to 20, and zero or more distinct option-choice IDs. The complete order is limited to 50 cups.
- Clients cannot submit organization, location, account, product name, variant name, recipe,
  currency, price, total, payment status, stock, consumption, or order-status values.
- The payment method is server-owned and fixed to `CASH` for the MVP.

## Catalog resolution and snapshots

Within one transaction, Spring:

1. Resolves the requested public location slug to one active location and organization.
2. Loads every requested variant through an active product, active variant, available
   location offering, and published assigned recipe version.
3. Verifies every selected choice is active and enabled for that variant, rejects duplicates, and
   enforces every option group's minimum and maximum selection count.
4. Recalculates the unit price from the location offering plus selected choice deltas and derives
   line, subtotal, and total minor-unit amounts with overflow checks.
5. Copies product, variant, option group, option choice, price, and currency values into immutable
   order snapshots.
6. Combines the published recipe components with signed choice ingredient effects, multiplies by
   line quantity, and stores each final positive ingredient consumption quantity. A negative final
   quantity is rejected as invalid catalog state.
7. Creates the initial `PENDING` status-history entry and a `PENDING` cash payment for the exact
   server-calculated total.

Catalog changes after placement never rewrite an existing order. A product becoming unavailable
between browsing and checkout returns a conflict and the frontend keeps the cart so the customer
can review current choices.

## Retry safety and public numbers

- Every request requires an unpredictable UUID in the `Idempotency-Key` header.
- The database stores a location-scoped unique key and a SHA-256 fingerprint of the normalized
  server input, including the optional resolved customer account.
- Repeating the same key and input returns the existing order without inserting another order,
  payment, history row, or snapshot.
- Reusing a key for different input or identity returns `409 ORDER_IDEMPOTENCY_CONFLICT`.
- Public pickup numbers come from a PostgreSQL sequence and are not derived from customer data.

## Response and errors

The response contains the order ID, public pickup number, `PENDING` status, `CASH` payment method,
currency, server-calculated totals, creation time, replay indicator, and immutable line/option
snapshots. It does not expose account IDs, authentication identifiers, recipes, or internal stock
details.

- `400 ORDER_INVALID`: malformed size, quantity, duplicate choices, or otherwise invalid input.
- `409 ORDER_CATALOG_CHANGED`: a requested offering or selection is no longer valid or available.
- `409 ORDER_IDEMPOTENCY_CONFLICT`: the key was already used for different normalized input.
- `403 CUSTOMER_ACCOUNT_DISABLED`: a valid signed-in identity maps to a disabled account.
- `503 ORDER_UNAVAILABLE`: placement could not be completed safely; no partial order remains.

## Frontend workflow

- Checkout targets the cart's selected location and sends variant IDs, choice IDs, and quantities;
  it never sends location IDs or preview prices. One cart cannot mix offerings from different shops.
- One idempotency key is retained for an in-flight checkout and reused when the customer explicitly
  retries an ambiguous network failure. It is replaced when the cart changes or a terminal
  response is received.
- While submitting, cart mutation and duplicate submission controls are disabled.
- Success clears the cart and shows the server-issued pickup number, confirmed total, cash-at-shop
  instructions, and pending status.
- Catalog conflicts keep the cart intact and direct the customer back to review current menu
  availability. Generic failures keep the cart and offer a safe retry.

## Acceptance criteria

- PostgreSQL integration tests prove server-owned pricing, currency, names, location, payment, and
  recipe consumption snapshots for multi-line customized orders.
- Tests reject unavailable or foreign variants, disabled or duplicate choices, invalid group
  cardinality, invalid quantities, client-shaped excess input, monetary overflow, and invalid
  catalog consumption without partial writes.
- Tests prove guest placement, verified-account linkage, disabled-account denial, replay safety,
  mismatch conflicts, public-number uniqueness, and concurrent duplicate-key behavior.
- The OpenAPI snapshot and generated frontend types remain drift-free.
- Frontend tests prove contract-only request bodies, retained carts on failure, stable retry keys,
  single-submit behavior, confirmed server totals, and cart clearing only after success.
- A live browser test selects a shop and completes guest checkout at desktop and mobile widths
  against the Compose stack.
