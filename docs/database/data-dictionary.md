# Data Dictionary

## Identity and ownership

| Table | Purpose | Lifecycle |
|---|---|---|
| `organization` | Top-level business owner. | Retained permanently in MVP. |
| `location` | Physical stock/order boundary, public menu slug, timezone, and currency. | Deactivated with `active=false`. |
| `account` | Application identity mapped optionally and uniquely to a Supabase Auth subject; it grants no organization access by itself. | Disabled rather than deleted. |
| `organization_membership` | Owner/manager role inside an organization. | Deactivated to remove access. |
| `location_assignment` | Manager-to-location access. | Rows added or removed with audit at service layer. |
| `refresh_session` | Legacy custom-session structure superseded by the Supabase direction. | Implemented in V1; later migration is undecided. |

## Catalog

| Table | Purpose | Lifecycle |
|---|---|---|
| `ingredient` | Organization stock item in one immutable base unit, protected by an optimistic version. | Archived after use, but not while consumed by an available offering. |
| `catalog_change` | Actor-attributed audit event for ingredient, recipe, and recipe-version mutations. | Append-only at the service layer and retained permanently. |
| `recipe` | Stable recipe name and description with optimistic concurrency. | Archived only when no available offering uses any version. |
| `recipe_version` | Numbered draft/published/retired formula revision with optimistic concurrency. | One draft per recipe; published content is immutable and an offered version cannot retire. |
| `recipe_component` | Positive base-unit quantity of an ingredient. | Editable only while version is draft. |
| `menu_product` | Customer-facing drink identity, public slug, category, artwork key, and display order. | Archived after use. |
| `menu_variant` | Size/form of a menu product, including its optional default marker. | Archived after use. |
| `menu_variant_offering` | Location price, availability, and recipe assignment. | Updated when price/availability changes. |
| `option_group` | Selection limits and display order for a choice family. | Archived after use. |
| `option_choice` | Value within an option group, including its optional default marker. | Archived after use. |
| `menu_variant_option_choice` | Variant-specific enablement and price delta. | Disabled rather than deleted after use. |
| `option_choice_ingredient_effect` | Signed ingredient delta caused by a choice. | Copied into order consumption at placement. |

## Inventory

| Table | Purpose | Lifecycle |
|---|---|---|
| `inventory_balance` | Current non-negative location/ingredient quantity. | Updated transactionally with the ledger. |
| `inventory_movement` | Immutable signed explanation of stock change. | Insert-only; update/delete rejected by trigger. |

Movement types:

- `OPENING`: positive initial stock.
- `RECEIPT`: positive delivery.
- `SALE`: negative completed-order consumption.
- `REVERSAL`: positive compensation tied to an order.
- `ADJUSTMENT`: signed correction after a physical count.

## Orders

| Table | Purpose | Lifecycle |
|---|---|---|
| `customer_order` | Guest or account-linked sale with money/status snapshots. | Pending, then completed or cancelled. |
| `order_item` | Product, variant, quantity, and price snapshots. | Immutable after placement. |
| `order_item_option` | Selected option name and price snapshots. | Immutable after placement. |
| `order_item_consumption` | Final positive ingredient quantities for the complete line. | Immutable after placement. |
| `order_status_history` | Actor and timestamp for every transition. | Append-only at service layer. |
| `payment` | Cash/card-compatible payment record. | Status transitions are audited by application workflow. |

## Shared representations

- IDs: UUID.
- Quantities: `numeric(19,6)` in the ingredient's base unit.
- Money: signed or non-negative `bigint` minor units as appropriate, plus `varchar(3)` ISO code.
- Time: `timestamptz` in UTC.
- Archival: nullable `archived_at`; historical foreign keys remain valid.
- Optimistic concurrency: non-negative `bigint` versions supplied by staff clients and incremented on mutation.
