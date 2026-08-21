# Catalog Management

## Purpose

Staff catalog tools manage organization-owned ingredients, recipes, products, variants, offerings,
and options without weakening location authorization or historical records. This contract begins
with ingredients and extends to the later catalog slices.

## Authorization boundary

- Every endpoint derives the account from the verified bearer-token subject.
- A requested organization ID selects a resource scope; it is never authorization evidence.
- An active owner membership grants catalog access throughout its organization.
- An active manager membership grants organization catalog access only while the manager has at
  least one assignment to an active location in that organization.
- Disabled accounts, inactive memberships, missing assignments, and cross-organization resource
  IDs are rejected without revealing resource details.

## Ingredient lifecycle

An ingredient belongs to one organization and has a trimmed name, optional normalized SKU, base
unit, optional non-negative reorder threshold, version, timestamps, and archival state.

- Creation accepts `name`, optional `sku`, `baseUnit`, and optional decimal-string
  `reorderThreshold`. Names and non-null SKUs remain unique within an organization.
- Listing is paginated, deterministically ordered by case-insensitive name then ID, and excludes
  archived ingredients unless explicitly requested.
- Updates can change the name, SKU, and reorder threshold. The base unit is immutable because
  recipe and inventory quantities use that unit historically.
- Update and archive commands include the last observed version. A stale version returns `409`
  instead of silently overwriting another staff member's change.
- Archive is idempotent for the matching current version and sets `archived_at`; ingredients are
  never physically deleted through the application API.
- Create, update, and archive operations append a durable catalog audit record with the acting
  account ID. Raw bearer tokens and request secrets are never recorded.

## HTTP contract

The first slice uses these authenticated routes:

- `GET /api/v1/staff/organizations/{organizationId}/ingredients`
- `POST /api/v1/staff/organizations/{organizationId}/ingredients`
- `PUT /api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}`
- `POST /api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}/archive`

List requests use zero-based `page`, bounded `size`, optional `query`, and `includeArchived=false`
by default. Decimal quantities cross JSON boundaries as strings. Validation returns `400`, denied
scope returns `403`, absent or cross-scope resources return `404`, and uniqueness or stale-version
conflicts return stable `409` problem details.

## Acceptance criteria

- PostgreSQL-backed integration tests prove owner and eligible-manager access plus denial for
  unassigned managers and other organizations.
- Validation, duplicate name/SKU, pagination, update conflicts, archival, and audit attribution are
  covered before UI integration.
- The generated OpenAPI snapshot and frontend types remain drift-free.
- The staff UI lists, creates, edits, and archives ingredients using the shared field, button,
  table, dialog, pagination, and problem-state primitives.
