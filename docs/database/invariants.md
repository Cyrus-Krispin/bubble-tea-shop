# Database and Transaction Invariants

## Ownership

- Every organization-owned reference uses `(entity_id, organization_id)` where needed.
- A location and ingredient from different organizations cannot form an inventory balance.
- An offering cannot combine a location, variant, or recipe version from different organizations.

## Recipes and offerings

- Component quantities are strictly positive and use the ingredient's base unit.
- Components of a published or retired recipe version cannot be inserted, changed, or deleted.
- An available offering references an active product/variant and a published, non-archived recipe.
- Offering currency must equal location currency.

## Inventory

- Movements are insert-only and non-zero.
- Opening, receipt, and reversal movements are positive; sale movements are negative.
- Sale and reversal movements reference an order.
- The balance and its movement are written in the same transaction.
- Balance quantity cannot become negative.
- At most one `SALE` movement exists per order and ingredient.
- Balance rows are locked in ingredient UUID order to prevent deadlocks during multi-ingredient completion.

## Orders

- Placement snapshots names, prices, selected choices, currency, and final ingredient consumption.
- A pending order does not reserve stock.
- Completion locks the order and affected balances, checks all ingredients, deducts all or none, appends
  status history, and commits once.
- Repeating completion for an already-completed order succeeds as an idempotent no-op.
- A shortage leaves both the order and every inventory row unchanged.
- Completed and cancelled timestamps must agree with current status.

## Migration policy

- Flyway migration SQL is the schema source of truth.
- Hibernate uses `validate`; it never creates or updates production schema.
- Applied migrations are immutable. Corrections use a new numbered migration.

