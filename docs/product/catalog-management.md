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

## Menu product and offering lifecycle

A menu product is the stable customer-facing identity for a drink. Variants represent sizes or
forms, while an offering assigns one variant a published recipe, price, and availability at one
location. Product and variant metadata are organization-wide; offering mutations are
location-scoped.

- Product creation accepts a name, optional description, optional HTTPS image URL, optional
  category, optional artwork key, public slug, and non-negative display order. Public slugs and
  artwork keys use lowercase kebab case. Product names and non-null public slugs are unique within
  an organization without regard to case.
- Variants have a name, non-negative display order, and optional default marker. Variant names are
  unique within a product without regard to case. Setting a new active default clears the previous
  default in the same transaction; a product may temporarily have no default while it is being
  configured.
- Products and variants use optimistic versions. Archival is retry-safe, preserves all historical
  rows, and is rejected while an available offering depends on the product or variant.
- An offering is unique for a location and variant. Creation or update accepts a published recipe
  version ID, a non-negative integer minor-unit price, availability, and the last observed version
  when updating. The server derives currency from the location and never accepts it from the
  client.
- Owners may manage offerings for any active location in their organization. Managers may read or
  mutate offerings only for active locations to which they have an active assignment. Product,
  variant, and option metadata retain the organization-wide catalog authorization boundary.
- Making an offering available is rejected unless its product and variant are active, its recipe
  version is published under an active recipe, all ingredients consumed by its recipe and enabled
  option effects are active, and every enabled option group can satisfy its selection bounds.
- Product, variant, and offering mutations append actor-attributed catalog audit rows in the same
  transaction. Availability and recipe reassignment never rewrite historical order snapshots.

### Product and offering routes

- `GET /api/v1/staff/organizations/{organizationId}/menu-products`
- `POST /api/v1/staff/organizations/{organizationId}/menu-products`
- `GET /api/v1/staff/organizations/{organizationId}/menu-products/{productId}`
- `PUT /api/v1/staff/organizations/{organizationId}/menu-products/{productId}`
- `POST /api/v1/staff/organizations/{organizationId}/menu-products/{productId}/archive`
- `POST /api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants`
- `PUT /api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}`
- `POST /api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/archive`
- `GET /api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings`
- `POST /api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings`
- `PUT /api/v1/staff/organizations/{organizationId}/locations/{locationId}/offerings/{offeringId}`

Product lists are paginated and searchable and exclude archived products by default. Product detail
returns its variants, each variant's complete option configuration, and only the offerings at
locations the current actor may access. Offering lists support an optional variant filter and
include unavailable offerings so staff can restore them without creating duplicates.

## Option group and choice lifecycle

Option groups and choices are reusable organization-owned catalog definitions. A variant-choice
configuration enables one choice for one variant, assigns its location-currency price delta, and
defines the complete signed ingredient effect caused by selecting it.

- Option groups have a unique case-insensitive organization name, valid minimum and maximum
  selection bounds, non-negative display order, optimistic version, and archival state.
- Choices have a unique case-insensitive name within their group, non-negative display order,
  optional default marker, optimistic version, and archival state. Setting a new active default
  clears the previous default atomically.
- Variant-choice configuration is an idempotent upsert identified by variant and choice. It accepts
  `enabled`, a signed integer `priceDeltaMinor`, an optimistic version for existing links, and the
  complete desired ingredient-effect set. Each effect uses a unique, active, same-organization
  ingredient and a non-zero signed decimal-string quantity in that ingredient's base unit.
- Replacing ingredient effects is atomic. Omitting an existing effect removes it from the live
  configuration but does not alter order snapshots. A disabled link is retained rather than
  deleted so it can be restored and audited.
- An active group contributes to a variant only when at least one active choice link is enabled.
  For every available offering, each contributing group's enabled active choice count must be at
  least its minimum and no default selection set may exceed its maximum. A required group must have
  one enabled active default choice so the guest configuration starts valid.
- Updates, disables, and archives that would make any available offering invalid are rejected with
  a stable state-conflict response. Staff can first make affected offerings unavailable, change the
  configuration, and then explicitly re-enable them after validation.
- Group and choice archival is retry-safe and blocked while the definition participates in an
  available offering. All option mutations and configuration replacements append actor-attributed
  catalog audit rows in the same transaction.

### Option routes

- `GET /api/v1/staff/organizations/{organizationId}/option-groups`
- `POST /api/v1/staff/organizations/{organizationId}/option-groups`
- `GET /api/v1/staff/organizations/{organizationId}/option-groups/{groupId}`
- `PUT /api/v1/staff/organizations/{organizationId}/option-groups/{groupId}`
- `POST /api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/archive`
- `POST /api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/choices`
- `PUT /api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/choices/{choiceId}`
- `POST /api/v1/staff/organizations/{organizationId}/option-groups/{groupId}/choices/{choiceId}/archive`
- `PUT /api/v1/staff/organizations/{organizationId}/menu-products/{productId}/variants/{variantId}/choices/{choiceId}`

Option group lists are paginated, searchable, deterministically ordered, and exclude archived
groups by default. Group detail returns all choices, optionally including archived choices.
Product detail is the source of truth for variant-specific enablement, price deltas, effect
versions, and exact decimal-string ingredient quantities.

Menu validation returns `MENU_INVALID`; uniqueness conflicts return `MENU_CONFLICT`; stale writes
return `MENU_VERSION_CONFLICT`; and lifecycle conflicts return `MENU_STATE_CONFLICT`. Option
validation and conflicts use the corresponding `OPTION_INVALID`, `OPTION_CONFLICT`,
`OPTION_VERSION_CONFLICT`, and `OPTION_STATE_CONFLICT` codes. Missing or cross-scope identifiers
use `MENU_NOT_FOUND` or `OPTION_NOT_FOUND` without disclosing foreign resources.

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
- Integration tests prove product and variant optimistic concurrency, normalized uniqueness,
  default reassignment, location-scoped offering authorization, server-owned currency, offering
  activation validation, archive guards, and actor-attributed auditing.
- Integration tests prove option bounds, default reassignment, atomic effect replacement,
  same-organization active-ingredient validation, available-offering configuration guards, and
  option audit attribution.
- The staff menu UI supports product search and metadata, variants, assigned-location offerings,
  exact minor-unit pricing, recipe-version selection, availability, option definitions, and
  per-variant choice/effect configuration with explicit conflict recovery.
