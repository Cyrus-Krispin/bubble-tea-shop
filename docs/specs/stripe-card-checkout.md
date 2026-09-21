# Hosted card checkout with reserved inventory

Customers choose cash at pickup or online card payment. Spring creates Stripe hosted Checkout from
its immutable order total (including the favorite discount) and shop currency; React never collects
card details or sends a price. Card checkout is available only when deployment payment settings are
configured. Supplier integration remains excluded.

## Lifecycle and ownership

- Ordering owns checkout sessions, verified payment/refund records and reconciliation. Inventory
  owns ingredient reservations. The application creates an order and reserves its complete
  consumption snapshot atomically before obtaining a provider URL. Concurrent cash fulfillment,
  card reservations and manual adjustments cannot consume reserved stock.
- Stripe collects payment on its hosted page. A signed webhook or server-side provider retrieval
  confirms payment, amount, currency, session reference and payment intent. Redirect query strings
  are never proof of payment. Pending card orders cannot be completed until payment is confirmed.
- Completion consumes the reserved ingredients once, retains the original paid timestamp, releases
  the reservation, and records the staff actor. Cash retains its existing pay-on-completion behavior.
- Open sessions expire at the provider. Release stock only after verified expiry/cancellation, never
  merely because a browser timer elapsed. Provider outages keep reservations and expose recovery.
- Customers can cancel an unpaid checkout. Staff may cancel/refund an unfulfilled paid card order;
  release stock after the refund is confirmed. Completed drinks are never restocked by a refund.
  If payment wins guest cancellation, clear the guest expiry request and retain the paid order;
  only a recorded staff cancellation actor authorizes the application to request a paid refund.
  Immutable refund records contribute to cash-flow outflow on their actual refund date; original
  collection remains in income. A failed/pending refund stays visible for follow-up.
  This includes refunds initiated from the provider dashboard: pending refunds block fulfillment,
  and failed, canceled, or action-required refunds require review until successfully resolved.
- Stable provider idempotency keys, short HTTP timeouts, persisted reconciliation state and periodic
  reconciliation recover interrupted requests and duplicate/out-of-order events. No network call
  holds a database transaction open. Unexpected provider data fails closed and needs investigation.
- A separate unpredictable checkout identifier is a guest receipt/recovery capability. Responses
  contain order details only, never provider secrets or card data. Authenticated placement still
  resolves the customer from verified identity. Preserve the original frontend attempt through
  navigation and hosted-page returns; do not create a replacement purchase after an unknown result.

## Configuration and provider verification

Use environment-injected Stripe API and webhook secrets, an explicit public application origin,
and a pinned Stripe API version. Hosted redirect URLs must be HTTPS on Stripe's checkout host.
Provide setup/runbook instructions and visible disabled/recovery states when not configured.
Production runtime uses the actual Stripe API; tests use an isolated provider boundary. A real Stripe
sandbox payment/webhook/refund check requires account credentials and must be reported separately
from local integration tests. Do not claim live verification without that evidence.

## Acceptance and checks

Cover guest/customer pricing, favorite savings, currency, reservation contention, no overselling,
manual adjustments around holds, cash compatibility, duplicate placement and webhooks, altered or
stale signatures, wrong amount/currency/reference, expiry, paid fulfillment, refund recovery and
cash-flow history. Check the full affected backend/frontend suites and browser checkout/return,
recovery, order queue and stock visibility on desktop/mobile. End with independent review.

## Provider references

- [Hosted Checkout and limited inventory](https://docs.stripe.com/payments/checkout/managing-limited-inventory)
- [Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create)
- [Webhook signature verification](https://docs.stripe.com/webhooks/signature)
- [Fulfillment verification](https://docs.stripe.com/checkout/fulfillment)

## Recovery details

After an unknown creation response, do not interpret a later Stripe validation error as proof that
no session exists: validation may precede idempotency replay. When the original expiry has less than
31 minutes remaining, search existing sessions by creation window and immutable checkout reference.
A bounded scan with no verified match enters explicit review and retains stock. Signed late session
hints remain recoverable. Failed/canceled refunds also require review, without automatic new refund
keys. Signed-in order history links to the payment recovery receipt across devices.
