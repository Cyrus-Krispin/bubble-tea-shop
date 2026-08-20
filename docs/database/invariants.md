# Database and Transaction Invariants

## Ownership

- Every organization-owned reference uses `(entity_id, organization_id)` where needed.
- A location and ingredient from different organizations cannot form an inventory balance.
- An offering cannot combine a location, variant, or recipe version from different organizations.

## Identity

- A non-null Supabase Auth subject maps to at most one application account.
- Customer account provisioning derives the subject from a verified JWT and creates no
  organization membership.
- An account without an active membership has no staff or owner authorization.

## Recipes and offerings

- A non-null location public slug resolves globally to one location; product public slugs are
  unique inside their organization.
- Public slugs and artwork keys use lowercase kebab case. Each product has at most one active
  default variant, and each option group has at most one active default choice.
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
- V2 contains the local MVP guest catalog seed. Runtime catalog values are read through Spring,
  not duplicated in the browser.
- V4 adds the Supabase subject mapping and makes legacy application-owned credential columns
  optional without editing V1.
