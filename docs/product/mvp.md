# MVP Product Scope

## Goal

Enable two bubble tea locations to maintain recipes and stock, accept guest or signed-in customer
cash orders, complete orders without overselling inventory, and delegate management access safely.
Guests choose an active shop before browsing its database-owned menu and pricing.

## Roles

### Owner

- Has organization-wide access.
- Adds, views, and deactivates manager memberships.
- Is not limited by location assignments.

### Manager

- Manages ingredients, stock, recipes, offerings, and orders for assigned locations.
- Completes pending orders.
- Cannot manage owner access.

### Guest customer

- Browses available products and configuration choices.
- Places an order without an account.
- Selects cash as the MVP payment method.

### Registered customer

- Creates an optional account without receiving staff or owner access.
- Can still use the same customer ordering experience as a guest.
- Account-linked orders are retained for a later order-history interface.

## In-scope workflows

1. Create an ingredient and record its starting quantity as an `OPENING` movement.
2. Record deliveries as `RECEIPT` movements and stock corrections as `ADJUSTMENT` movements.
3. Create a recipe draft, add ingredient quantities, and publish an immutable version.
4. Create products and size variants, assign published recipes and location-specific prices, and
   enable sugar, ice, milk, or topping choices.
5. Create or sign in to an optional customer account without creating an organization membership.
6. Place a guest or account-linked order with immutable product, option, price, and consumption
   snapshots at the selected active location.
7. Move a pending order to completed. Completion deducts its consumption snapshot atomically.
8. View current inventory balances and historical movements.
9. View private account-linked order history and immutable receipts after signing in.

## Deferred

- Extended customer profiles and customer cancellation.
- Card payment providers, refunds, taxation, and promotions.
- Supplier ordering (explicitly excluded; restocking uses the inventory UI).
- Purchase orders and detailed cost-of-goods accounting.
- Translations and location closure/reactivation workflows.
- Inventory reservations, delivery lots, expiry dates, and FIFO consumption.

## Authorized product completion: operational cash flow

The 2026-09-15 expanded request adds a manager dashboard for today and the last 7/30 local calendar
days, collected payment totals, and a paid-expense form with audited correction. Stock receipt costs
are not automatically treated as payments. See [cash-flow rules](../specs/cash-flow-dashboard.md).

## Authorized product completion: favorites and inventory planning

Customers can save one favorite recipe per organization and receive a server-calculated 5% discount
on one matching base drink per order. Current price quotes precede checkout; immutable receipts retain
the confirmed savings. See [favorite pricing rules](../specs/favorite-drink-discount.md). Managers can
record walk-in orders, inspect observed ingredient consumption, projected shortages, and reorder lists.

## Authorized product completion: location currencies

Owners may create shops in SGD, MYR and CNY. Configure offerings and currency-specific add-on prices
through the staff catalog, then record opening stock through inventory. Currency is permanent for a
shop and there is no exchange-rate conversion. See [currency specification](../specs/location-currency-pricing.md).
