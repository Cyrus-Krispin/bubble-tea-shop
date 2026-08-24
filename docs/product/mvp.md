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

## Deferred

- Extended customer profiles, favorites, discounts, order history UI, and customer cancellation.
- Card payment providers, refunds, taxation, and promotions.
- Consumption forecasting, projected low-stock alerts, and supplier ordering.
- Cash-flow dashboards, purchase orders, and detailed cost-of-goods accounting.
- Multiple active currencies, translations, and self-service location lifecycle management.
- Inventory reservations, delivery lots, expiry dates, and FIFO consumption.
