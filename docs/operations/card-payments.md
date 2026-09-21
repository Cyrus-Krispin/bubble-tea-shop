# Hosted card payments

Spring owns payment amounts, checkout identity and stock reservations. Stripe hosts card entry;
card details never reach the app. Cash remains available when online payments are disabled.

## Configure

Set these backend environment variables through the deployment's secret manager (local `.env` is
ignored): `STRIPE_ENABLED=true`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`PAYMENT_PUBLIC_ORIGIN`. The origin must be the frontend HTTPS origin with no path; HTTP is accepted
only for localhost/127.0.0.1 development. Never expose API/webhook secrets as Vite variables.

Use a Stripe account that supports the location's configured presentment currency. Checkout fixes
the server order total in SGD, MYR or CNY and disables adaptive currency conversion. Stripe's
account/settlement rules and minimum charge apply; an unsupported total can use cash after the
original card attempt has a confirmed terminal outcome.

The adapter pins `2026-08-26.dahlia`. Configure the webhook endpoint with the same API version at
`/api/v1/payments/stripe/webhook`. Subscribe to `checkout.session.completed`,
`checkout.session.expired`, `payment_intent.succeeded`, `charge.refunded`, `refund.created`,
`refund.updated`, and `refund.failed`. Signed events queue reconciliation; only verified provider
retrieval can change payment state. A 15-second worker also reconciles open checkouts.

For local Stripe sandbox verification, forward events with the Stripe CLI to
`http://localhost:8080/api/v1/payments/stripe/webhook` and use that listener's signing secret. The
browser return is `PAYMENT_PUBLIC_ORIGIN/card-checkout/{private-checkout-id}`. Do not log or share
that recovery URL: it grants access to the guest receipt and unpaid cancellation.

## Reconciliation and refunds

An online order reserves its full ingredient snapshot before a provider session is created. A
one-hour provider expiry gives customers time to pay. Completion requires verified collection and
uses the reservation once. Unpaid cancellation first expires the provider session. Staff can
cancel/refund an unfulfilled paid order from the order queue. Confirmed refunds are immutable
cash-flow outflows on their provider dates; original paid income and completed inventory remain.
If payment wins a guest cancellation race, the order remains paid and the guest cancellation is
cleared. Ask scoped staff to cancel/refund it; a guest receipt never authorizes a paid refund.

Use **Check online payment** to reconcile an order. `REFUND_PENDING` retains stock; a failed,
cancelled, or action-required refund enters `REVIEW_REQUIRED`. These safeguards also apply to
refunds initiated from the Stripe dashboard, and unresolved refunds block pending-order fulfillment.
Investigate them in Stripe before taking any further financial action. The app does not automatically
issue replacement refunds with new retry keys.
After resolving a failed refund in Stripe, reconciliation imports the confirmed successful refund.

Unknown creation responses retain the original request key. If too little provider expiry time
remains, the worker searches existing sessions by creation window and private checkout reference
instead of submitting an invalid or new purchase. The scan is bounded to 1,000 sessions; missing or
mismatched provider evidence enters `REVIEW_REQUIRED` and holds stock. In a high-volume account,
locate the original Checkout session in Stripe and redeliver its signed session event to supply the
recovery reference. Verify order reference, amount and currency before any operator action. Never
release stock based only on a timeout or browser redirect. Provider outages retain durable work.

Customers recover the original attempt after navigation/reload/hosted return using tab session
storage (catalog IDs, retry key and private checkout ID only). Signed-in customers can also open
payment status from their private order history. Closing a guest tab loses its recovery pointer;
keep the receipt URL/order number and ask staff to reconcile before placing a replacement purchase.

## Verification and activation gate

Local integration tests use actual PostgreSQL and an isolated payment-provider boundary. They cover
reservation contention, cash/manual movement exclusion, paid fulfillment, refund accounting,
ambiguous requests, webhook authentication/scoping, and duplicate work. Browser tests separately
exercise actual cash checkout and the card UI with a mocked API boundary.

Before enabling for customers, complete an actual Stripe sandbox card payment, duplicate webhook
replay, abandoned checkout expiry, staff refund, and provider-dashboard refund. Confirm payment
amount/currency, order status, stock reservations and cash-flow entries through the application.
No real Stripe account credentials were available for this implementation's local checks, so those
checks are not evidence of a real external transaction. Promote live credentials only after the
sandbox lifecycle is verified for the merchant account.
