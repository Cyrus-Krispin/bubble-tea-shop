# Customer Order History

## Objective

Give a signed-in customer a private, durable record of orders placed with their application
account. The account workspace shows newest-first order history and immutable receipt detail. The
storefront uses the newest order as an actionable `Order again` suggestion so a returning customer
can restore the exact available configuration to the cart without rebuilding it by hand.

Guests continue to browse and order without an account. History is available only after Spring
validates the Supabase access token and resolves its subject to an enabled application account.

## Customer experience

- `/account` shows a paginated, newest-first list of the signed-in customer's orders.
- `/account/orders/{orderId}` shows the order number, shop, status, placement time, payment method,
  total, line snapshots, option snapshots, and line prices for one owned order.
- The storefront shows the newest order's individual products, variants, selections, quantities,
  and current total before menu filters when the whole configuration can be fulfilled at the shop
  currently being viewed.
- `Add order to cart` restores the whole configuration atomically using current server-owned
  prices. It never silently substitutes a variant or option and never partially adds an order.
- The suggestion is hidden when the newest order belongs to another shop, a product/variant/option
  is retired or disabled, an offering is unavailable, required selections have changed, or current
  ingredient stock cannot fulfill the full saved quantity.
- A customer with no orders sees a useful empty state in the account workspace and no personalized
  storefront section.
- History and the storefront suggestion have explicit loading and recoverable error states. A
  history failure never blocks the public menu.

If the cart already belongs to another shop or adding the complete order would exceed checkout
quantity limits, the cart remains unchanged and the storefront explains what the customer must do.

## API contract

- `GET /api/v1/customer/orders?page=0&size=10` returns a bounded page of order summaries. Pages are
  zero-based, size is limited to `1..20`, and ordering is deterministic by `created_at DESC, id DESC`.
- `GET /api/v1/customer/orders/{orderId}` returns immutable receipt detail for an order owned by the
  current account.
- `GET /api/v1/customer/orders/latest-reorder?locationSlug={slug}` returns the newest owned order as
  a current, cart-ready configuration only when the complete order is eligible at that location.
  It returns `204` for no history or any ineligible configuration so catalog retirement and stock
  details are not exposed through personalized error messages.
- The list response includes location identity and snapshot-based item summaries needed by the
  account and storefront. Detail includes all immutable line and option snapshots.
- The server derives the account exclusively from the verified JWT subject. It accepts no customer
  account identifier from the path, query, body, or identity metadata.
- An unmapped or disabled account returns `403 CUSTOMER_ACCOUNT_UNAVAILABLE`. A missing order and an
  order owned by another account both return `404 CUSTOMER_ORDER_NOT_FOUND` to avoid disclosing
  another customer's records. Invalid pagination returns `400 CUSTOMER_ORDER_HISTORY_INVALID`.
- JPA entities never cross the HTTP boundary. Spring DTOs generate the OpenAPI contract and the
  frontend validates responses before rendering them.
- Reorder eligibility and current prices are resolved by Spring from current offerings, enabled
  option links, published recipes, and inventory balances. Historical names and prices remain
  unchanged in receipts.

## Threat model and boundaries

The trust boundary is the authenticated HTTP request. The protected assets are customer purchase
history, location information, and immutable receipt data.

- Spoofing is mitigated by Spring resource-server JWT validation.
- Information disclosure and elevation of privilege are mitigated by resolving the account from
  the JWT and including `customer_account_id` in every order lookup.
- Tampering and injection are mitigated by read-only endpoints, validated pagination, UUID path
  binding, and parameterized SQL.
- Denial of service is bounded by a maximum page size and indexed newest-first lookup.
- Cross-account identifiers receive the same not-found response as unknown identifiers.
- The frontend treats API payloads as untrusted data, validates their shape, and relies on React
  escaping for snapshot text.

## Project structure and style

- Backend implementation and integration tests live in the `ordering` module.
- Frontend API parsing, history components, pages, and tests live under
  `frontend/src/features/orders/`.
- Customer-facing styling extends the existing Ube and Calamansi token system without adding a new
  dependency or runtime fixture data.
- Database performance support is an additive Flyway migration; committed migrations remain
  immutable and database documentation changes with it.

Backend DTOs use compact immutable records, for example:

```java
public record CustomerOrderPage(
    List<CustomerOrderSummary> items,
    int pageNumber,
    int pageSize,
    long totalItems,
    int totalPages
) { }
```

Frontend components keep data loading separate from receipt presentation and use semantic lists,
links, headings, status text, and live regions.

## Testing strategy and commands

- Backend API integration tests cover authentication, ownership isolation, deterministic
  pagination, empty history, detail snapshots, invalid input, and disabled accounts.
- Frontend client tests cover bearer-token requests, runtime response validation, problem mapping,
  and abort behavior.
- Component tests cover signed-in history, empty/error states, receipt rendering, eligible reorder,
  atomic cart restoration, ineligible suppression, signed-out suppression, and axe accessibility.
- Playwright covers sign-in, account-linked checkout, storefront suggestion, history, and receipt
  at desktop and mobile widths.

```bash
cd backend && ./mvnw verify
cd frontend && pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e
git diff --check
```

## Success criteria

- A signed-in customer can list and inspect only their own account-linked orders.
- History is newest first, paginated, deterministic, and backed by an appropriate index.
- Receipt details retain the exact names, selections, quantities, and prices captured at placement.
- The newest eligible same-shop order appears as the first personalized storefront section for
  signed-in customers and exposes its actual saved items and selections.
- One action adds the complete order configuration to the cart at current prices; unavailable or
  out-of-stock orders produce no storefront highlight.
- Guests and customers without history receive no personalized storefront suggestion.
- A history request failure does not hide or delay an otherwise available guest menu.
- Backend, frontend, contract, accessibility, build, and browser quality gates pass.

## Boundaries

- Always: derive ownership on the server, paginate lists, use snapshots for history, validate API
  payloads, preserve guest ordering, and update OpenAPI and affected documentation.
- Ask first: introduce new customer PII, change authentication, add dependencies, or add
  cancellation, payment, promotion, or notification behavior.
- Never: accept a customer account ID from the browser, expose cross-account existence, ship
  frontend order fixtures at runtime, recalculate historical receipts from the current menu, or
  edit an existing Flyway migration.

## Open questions

None for this increment.
