# Staff Order Operations

## Goal

Give an authorized owner or manager a location-scoped queue where they can inspect pending cash
orders, confirm cash collection, and complete an order without overselling inventory. Completion is
the only MVP workflow that changes order, payment, and stock state.

## Authorization and scope

- Every endpoint requires a verified Supabase bearer token and an enabled application account.
- Owners may operate orders in any active location in their organization. Managers may operate
  orders only in active locations currently assigned to their active membership.
- Organization, location, role, actor, order status, payment status, price, and stock are resolved
  from server-owned state. An order ID outside the authorized route scope is not exposed.
- Reads and writes use the organization and location in the authorized route; the client cannot
  move an order between scopes.

## HTTP contract

The staff API is rooted at:

```text
/api/v1/staff/organizations/{organizationId}/locations/{locationId}/orders
```

- `GET /orders?page={page}&size={size}&status={status}` returns newest-first order summaries.
  `status` is optional and supports `PENDING`, `COMPLETED`, and `CANCELLED`; pages are zero-based
  and capped at 100 rows.
- `GET /orders/{orderId}` returns the immutable line and option snapshots plus the current payment
  and ingredient-requirement view.
- `POST /orders/{orderId}/completion` confirms that cash was collected and requests completion.
  It takes no client-owned business fields. Success returns the refreshed order detail.

Stable problem codes distinguish invalid input, invalid identity, denied scope, missing orders,
invalid state, and stock shortage. A shortage response includes each ingredient ID, name, base
unit, required quantity, and currently available quantity so the staff UI can explain the conflict.

## Read model

An order summary includes its stable ID and pickup number, order and payment status, payment method,
currency, server total, item quantity, creation time, and completion time. Order detail additionally
includes deterministic lines and selected options, and aggregated ingredient requirements with the
current location balance.

The queue supports an explicit location selector derived from staff context. It defaults to pending
orders and offers status filters without client-side filtering of incomplete pages. Empty, loading,
error, and retry states are first-class UI states.

## Atomic cash completion

Spring performs completion in one PostgreSQL transaction:

1. Authorize the actor for the route location and lock the scoped order.
2. Require a pending cash order with one pending cash payment for the exact order total and currency.
3. Aggregate the immutable consumption snapshots and lock affected inventory balances in
   ingredient-ID order.
4. If any balance is short, return `409 ORDER_INSUFFICIENT_STOCK` and change no order, payment,
   history, movement, or balance row.
5. Deduct each requirement and append actor-attributed `SALE` movements.
6. Mark the payment `PAID`, record when and by whom cash was accepted, mark the order `COMPLETED`,
   and append actor-attributed order status history.

Repeating completion for an already completed order with its paid cash payment is an idempotent
success and makes no further writes. Any other order/payment combination fails closed as an invalid
state. PostgreSQL constraints enforce one payment per order and agreement between payment status
and its paid audit fields.

## Staff interaction

- The completion action is labelled as collecting cash and completing the order; staff must confirm
  it once in the UI before the request is sent.
- Mutation controls are disabled while the request is in flight to prevent duplicate clicks.
- Success updates the queue/detail from the server response and clearly shows paid/completed state.
- A shortage leaves the order pending and shows ingredient-specific required and available amounts.
- Authentication, authorization, not-found, state-conflict, malformed-response, and network errors
  use safe messages and never discard the visible order.

## Verification

- PostgreSQL integration tests cover authorization, location isolation, pagination/filtering,
  deterministic detail snapshots, atomic payment/stock/order updates, idempotent replay, malformed
  payment state, shortage rollback, and concurrent completions that cannot oversell.
- Frontend tests cover fail-closed response parsing, authenticated request construction, queue
  states, completion confirmation, duplicate-click protection, success refresh, and shortage UX.
- A real-browser check places a guest order, observes it in the authorized staff queue, completes it
  after stocking its ingredients, and verifies the paid order plus inventory deductions at desktop
  and mobile widths.
