# MVP Product Scope

## Goal

Enable one bubble tea location to maintain recipes and stock, accept guest cash orders, complete
orders without overselling inventory, and delegate management access safely.

The schema is location-aware so a later multi-location release does not require re-owning catalog,
stock, staff, or order data.

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

## In-scope workflows

1. Create an ingredient and record its starting quantity as an `OPENING` movement.
2. Record deliveries as `RECEIPT` movements and stock corrections as `ADJUSTMENT` movements.
3. Create a recipe draft, add ingredient quantities, and publish an immutable version.
4. Create products and size variants, assign published recipes and location-specific prices, and
   enable sugar, ice, milk, or topping choices.
5. Place a guest order with immutable product, option, price, and consumption snapshots.
6. Move a pending order to completed. Completion deducts its consumption snapshot atomically.
7. View current inventory balances and historical movements.

## Deferred

- Customer accounts, profiles, favorites, discounts, order history, and customer cancellation.
- Card payment providers, refunds, taxation, and promotions.
- Consumption forecasting, projected low-stock alerts, and supplier ordering.
- Cash-flow dashboards, purchase orders, and detailed cost-of-goods accounting.
- Multiple active currencies, translations, and multiple active locations.
- Inventory reservations, delivery lots, expiry dates, and FIFO consumption.

