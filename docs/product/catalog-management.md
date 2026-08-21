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

## Recipe and version lifecycle

A recipe is the stable organization-owned identity used by staff. Its versions contain the actual
ingredient formula. Recipe metadata and formula content have separate optimistic versions so two
staff members cannot silently overwrite each other.

- Creating a recipe also creates its empty version 1 draft in the same transaction.
- A recipe has at most one draft at a time. Creating the next draft increments the version number
  under a recipe-row lock and clones the latest published formula by default. An explicit source
  version must belong to the same recipe and already be published or retired.
- Replacing a draft formula is atomic. The request is the complete desired component set; ingredient
  IDs must be unique, active, and owned by the same organization, and quantities must be positive
  decimal strings in each ingredient's immutable base unit.
- Empty drafts are allowed while editing, but publishing requires at least one component.
- Publishing changes only `DRAFT` to `PUBLISHED`, sets `published_at`, and permanently freezes the
  component rows. Existing published versions remain published because offerings reference a
  specific version; publishing a newer formula never rewrites an offering implicitly.
- Retirement changes only `PUBLISHED` to `RETIRED`. It is rejected while any available offering
  references the version. Retired versions remain readable for historical offerings and orders.
- Recipe names and descriptions can change while the recipe is active. Archival is retry-safe and
  rejected while an available offering references any of its versions. Archival never deletes the
  recipe, its versions, or components.
- Every successful recipe metadata, version, formula, publication, retirement, and archival mutation
  appends an actor-attributed catalog audit row in the same transaction.

### Recipe routes

The recipe slice uses authenticated organization-scoped routes:

- `GET /api/v1/staff/organizations/{organizationId}/recipes`
- `POST /api/v1/staff/organizations/{organizationId}/recipes`
- `GET /api/v1/staff/organizations/{organizationId}/recipes/{recipeId}`
- `PUT /api/v1/staff/organizations/{organizationId}/recipes/{recipeId}`
- `POST /api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/archive`
- `POST /api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions`
- `PUT /api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft`
- `POST /api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/publish`
- `POST /api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/retire`

Lists use the same zero-based pagination, bounded size, literal substring search, deterministic
case-insensitive ordering, and explicit archive filter as ingredients. Recipe detail returns every
version in descending version-number order and each component with its ingredient name, base unit,
and exact decimal-string quantity. Requests never accept an actor, organization ownership, version
status, ingredient unit, or publication timestamp from the browser.

State or optimistic-version conflicts return `409` with `RECIPE_STATE_CONFLICT` or
`RECIPE_VERSION_CONFLICT`. Duplicate normalized names return `RECIPE_CONFLICT`; invalid formulas
return `RECIPE_INVALID`; absent and cross-organization IDs return `RECIPE_NOT_FOUND` without
revealing foreign resources.

## Acceptance criteria

- PostgreSQL-backed integration tests prove owner and eligible-manager access plus denial for
  unassigned managers and other organizations.
- Validation, duplicate name/SKU, pagination, update conflicts, archival, and audit attribution are
  covered before UI integration.
- The generated OpenAPI snapshot and frontend types remain drift-free.
- The staff UI lists, creates, edits, and archives ingredients using the shared field, button,
  table, dialog, pagination, and problem-state primitives.
- Integration tests prove draft replacement, same-organization ingredient validation, atomic
  publication, published-formula immutability, single-draft concurrency, offering-dependent
  retirement/archival denial, and audit attribution.
- The staff recipe UI supports list/search, metadata editing, formula composition from live
  ingredients, publish confirmation, next-draft creation, retirement, and archival with explicit
  conflict recovery.
