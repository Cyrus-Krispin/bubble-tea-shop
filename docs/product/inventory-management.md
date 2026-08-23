# Inventory Management

## Purpose

Staff inventory tools expose each authorized location's current ingredient balances and immutable
movement history. Every stock change is recorded as a movement in the same transaction that updates
the materialized balance, so the ledger remains the explanation for the current quantity.

## Authorization boundary

- The verified bearer-token subject identifies the acting account.
- Owners may manage inventory at every active location in their organization.
- Managers may manage inventory only at active locations to which they have an active assignment.
- Organization and location path IDs select scope; they are never accepted as authorization
  evidence. Cross-scope ingredient and location identifiers are rejected without disclosure.
- The server records the acting account and derives the location currency. Clients cannot submit
  either value.

## Balance and movement lifecycle

- A balance is unique for a location and ingredient and never becomes negative.
- Balance listing includes active organization ingredients even before their first movement, with a
  displayed quantity of zero. Archived ingredients are available only through an explicit filter so
  historical stock remains explainable.
- `OPENING` records positive starting stock and may occur at most once for a location and ingredient.
- `RECEIPT` records a positive delivery. It may include a supplier/source reference and a
  non-negative total cost in the location currency.
- `ADJUSTMENT` records a positive or negative correction. A non-blank note is mandatory, and a
  negative adjustment is rejected when it would make the resulting balance negative.
- `SALE` and `REVERSAL` remain exclusive to order workflows and cannot be submitted through the
  manual inventory endpoint.
- Quantities cross JSON boundaries as exact decimal strings with at most six fractional digits.
  Monetary amounts use whole minor units.
- Movements are immutable after insertion. Correction means appending another adjustment, never
  editing or deleting history.
- Creating a movement locks the location/ingredient balance, changes the balance, increments its
  optimistic version, and appends the actor-attributed movement in one transaction.

## HTTP contract

- `GET /api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory/balances`
- `GET /api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory/movements`
- `POST /api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory/movements`

Balance lists use zero-based `page`, bounded `size`, optional literal `query`, and
`includeArchived=false` by default. Movement history supports optional `ingredientId` and
`movementType` filters and is ordered newest first, then by ID for deterministic pagination.

Validation returns `400 INVENTORY_INVALID`; any inaccessible location scope returns `403`; missing,
archived, or cross-scope ingredients return `404 INVENTORY_NOT_FOUND`; a duplicate opening or state
race returns `409 INVENTORY_STATE_CONFLICT`; and a movement that would make stock negative returns
`409 INVENTORY_INSUFFICIENT_STOCK` with no balance or movement change.

## Staff workspace

- Staff choose only from server-returned assigned locations.
- The balance table supports organization/location selection, search, archived visibility,
  quantities in each ingredient's immutable base unit, and low-stock status.
- A movement dialog supports opening stock, receipts, and signed adjustments with type-specific
  validation and explicit minor-unit cost entry.
- Movement history can be filtered by ingredient and movement type and shows actor-independent
  operational details without exposing tokens or authentication identifiers.
- Conflict and shortage messages explain that current data was reloaded and do not apply optimistic
  local balance changes.

## Acceptance criteria

- PostgreSQL integration tests prove owner and assigned-manager access plus denial for unassigned
  managers and foreign organizations.
- Tests prove zero-balance projection, pagination/search, opening uniqueness, positive receipt
  rules, adjustment-note rules, exact decimal handling, server-owned actor/currency, atomic shortage
  rollback, movement immutability, and deterministic history filters.
- The OpenAPI snapshot and generated frontend types remain drift-free.
- The staff workspace lists live balances, records each allowed manual movement, displays history,
  handles conflict/shortage recovery, and passes responsive browser verification.
