# Database and Transaction Invariants

## Ownership

- Every organization-owned reference uses `(entity_id, organization_id)` where needed.
- A location and ingredient from different organizations cannot form an inventory balance.
- An offering cannot combine a location, variant, or recipe version from different organizations.

## Identity

- A non-null Supabase Auth subject maps to at most one application account.
- Customer account provisioning derives the subject from a verified JWT and creates no
  organization membership; it persists the normalized verified email for owner grants.
- An account without an active membership has no staff or owner authorization.
- Verified account emails are unique without regard to case. Owners can grant or reactivate only
  manager memberships in their organization and only with distinct active same-organization
  locations.
- Manager membership changes lock the membership, require the current non-negative version, update
  all assignments atomically, and append an immutable actor-attributed staff-access change.

## Recipes and offerings

- Ingredient names and non-null SKUs are unique per organization without regard to case.
- An ingredient's base unit is immutable after creation. Updates and archival require the current
  optimistic version; successful mutations increment it exactly once.
- Ingredient creation, update, and archival append an actor-attributed `catalog_change` row in the
  same transaction. Retrying an already-completed archive is an idempotent no-op.
- A non-null location public slug resolves globally to one location; product public slugs are
  unique inside their organization.
- Public slugs, product artwork keys, and location image keys use lowercase kebab case. Each product has at most one active
  default variant, and each option group has at most one active default choice.
- Component quantities are strictly positive and use the ingredient's base unit.
- Components of a published or retired recipe version cannot be inserted, changed, or deleted.
- Recipe names are unique per organization without regard to case. Recipe metadata and recipe
  versions have separate non-negative optimistic versions.
- Each recipe has at most one draft. A draft may be empty, but publication requires active,
  same-organization ingredients and at least one positive component.
- An available offering prevents its recipe version from retiring and prevents its parent recipe
  or any consumed ingredient from being archived. Offering activation and those lifecycle mutations
  lock the same recipe and ingredient rows so concurrent transactions cannot bypass the invariant.
- Recipe and version mutations append actor-attributed `catalog_change` rows in the same transaction.
- An available offering references an active product/variant and a published, non-archived recipe.
- Offering currency must equal location currency.
- Menu products, variants, offerings, option groups, choices, and variant-choice links use
  non-negative optimistic versions. Their names are unique in their ownership scope without regard
  to case.
- Available offerings prevent product, variant, participating option-group, and participating
  option-choice archival.
- Every contributing option group on an available variant satisfies its minimum enabled-choice
  count. Required groups have one enabled active default choice, and default selections never
  exceed the group's maximum.
- Enabled option effects for available offerings use active ingredients. Option configuration
  validation is deferred to the transaction boundary so atomic default reassignment and complete
  effect replacement never expose an invalid intermediate state.
- Offering activation and option reconfiguration lock the same product/variant rows before recipe
  and ingredient rows so concurrent catalog writes cannot bypass available-menu validation.
- Offering currency is derived from the authorized active location by Spring; clients do not
  submit it. Managers can mutate offerings only for actively assigned locations.
- Menu and option mutations append actor-attributed `catalog_change` rows in the same transaction.

## Inventory

- Movements are insert-only and non-zero.
- Opening, receipt, and reversal movements are positive; sale movements are negative.
- Each location and ingredient has at most one opening movement.
- Manual adjustments require an explanatory note; receipt cost currency is derived from the
  authorized location.
- Sale and reversal movements reference an order.
- The balance and its movement are written in the same transaction.
- Balance quantity cannot become negative.
- At most one `SALE` movement exists per order and ingredient.
- Balance rows are locked in ingredient UUID order to prevent deadlocks during multi-ingredient completion.

## Orders

- Placement snapshots names, prices, selected choices, currency, and final ingredient consumption.
- Positive line and selection ordinals preserve deterministic cart order across initial responses
  and idempotent replays.
- Placement keys are unique per location; matching retries return the existing order, while a
  different normalized request or customer identity cannot reuse the key.
- The requested active location (or configured default on the compatibility route), catalog
  availability, published recipe, price, currency, cash
  payment, totals, and optional verified customer account are resolved by Spring, never trusted
  from checkout input.
- A pending order does not reserve stock.
- Every placed order has one payment. Paid status agrees with its paid timestamp, and paid cash
  identifies the staff account that accepted it.
- Completion locks the order and affected balances, checks all ingredients, deducts all or none, appends
  sale movements and status history, marks the cash payment paid with its accepting actor, and
  commits once.
- Repeating completion for an already-completed order succeeds as an idempotent no-op.
- A shortage leaves both the order and every inventory row unchanged.
- Completed and cancelled timestamps must agree with current status.
- Catalog changes, inventory movements, and order status transitions form the durable operational
  audit timeline. Owners can read their full organization; managers can read organization-wide
  catalog events and operational events only for assigned locations.
- Catalog changes, inventory movements, and order status history are database-enforced append-only;
  update and deletion are rejected.

## Migration policy

- Flyway migration SQL is the schema source of truth.
- Hibernate uses `validate`; it never creates or updates production schema.
- Applied migrations are immutable. Corrections use a new numbered migration.
- V2 contains the local MVP guest catalog seed. Runtime catalog values are read through Spring,
  not duplicated in the browser.
- V4 adds the Supabase subject mapping and makes legacy application-owned credential columns
  optional without editing V1.
- V5 adds ingredient optimistic versions, case-insensitive organization uniqueness, and durable
  catalog change auditing.
- V6 adds recipe/version optimistic concurrency, case-insensitive recipe names, the single-draft
  constraint, expanded catalog auditing, and offering-safe recipe lifecycle triggers.
- V7 adds menu/option optimistic concurrency, case-insensitive scoped names, expanded catalog
  auditing, location-safe offering management, and database-enforced available-menu validity.
- V8 enforces one opening movement per location/ingredient and indexes deterministic location/type
  movement history.
- V9 adds location-scoped checkout idempotency, sequence-backed public order numbers, and complete
  recipe and topping-consumption data for the versioned local guest catalog seed.
- V10 enforces one payment per order and records paid time plus the staff actor accepting cash.
- V11 makes catalog audit rows database-enforced immutable and indexes deterministic organization
  timelines for catalog and order status events.
- V12 stores verified account emails, adds manager membership optimistic versions, and adds the
  immutable staff-access change ledger used by owner management.
- V13 adds location image keys and seeds Tiong Bahru, three published recipes and products, and
  location-specific offerings without changing earlier migrations.
- V14 adds the partial account/time/order index used for deterministic, bounded customer-history
  reads; it changes no domain relationship or lifecycle.
- V15 gives Orchard Central and Tiong Bahru distinct product assortments and adds auditable opening
  balances for the local catalog ingredients at both seeded locations.
