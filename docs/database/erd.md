# Database ERD

The diagrams are split by concern for readability. `organization_id` is repeated through owned
tables to support composite foreign keys that reject cross-organization references.

The identity diagram reflects the implemented V1 schema. Its `REFRESH_SESSION` relationship belongs
to the superseded custom-auth design and is not the target Supabase session model. A later migration
will reconcile it after the Supabase identity mapping has been selected.

## Identity

```mermaid
erDiagram
    ORGANIZATION ||--o{ LOCATION : owns
    ORGANIZATION ||--o{ ORGANIZATION_MEMBERSHIP : grants
    ACCOUNT ||--o{ ORGANIZATION_MEMBERSHIP : receives
    ORGANIZATION_MEMBERSHIP ||--o{ LOCATION_ASSIGNMENT : scoped_by
    LOCATION ||--o{ LOCATION_ASSIGNMENT : allows
    ACCOUNT ||--o{ REFRESH_SESSION : has_legacy_session
```

## Catalog

```mermaid
erDiagram
    ORGANIZATION ||--o{ INGREDIENT : owns
    ORGANIZATION ||--o{ RECIPE : owns
    RECIPE ||--o{ RECIPE_VERSION : versions
    RECIPE_VERSION ||--o{ RECIPE_COMPONENT : contains
    INGREDIENT ||--o{ RECIPE_COMPONENT : consumed

    ORGANIZATION ||--o{ MENU_PRODUCT : owns
    MENU_PRODUCT ||--o{ MENU_VARIANT : offers
    MENU_VARIANT ||--o{ MENU_VARIANT_OFFERING : priced_as
    LOCATION ||--o{ MENU_VARIANT_OFFERING : sells
    RECIPE_VERSION ||--o{ MENU_VARIANT_OFFERING : prepared_from

    ORGANIZATION ||--o{ OPTION_GROUP : owns
    OPTION_GROUP ||--o{ OPTION_CHOICE : contains
    MENU_VARIANT ||--o{ MENU_VARIANT_OPTION_CHOICE : enables
    OPTION_CHOICE ||--o{ MENU_VARIANT_OPTION_CHOICE : selected_as
    MENU_VARIANT_OPTION_CHOICE ||--o{ OPTION_CHOICE_INGREDIENT_EFFECT : changes
    INGREDIENT ||--o{ OPTION_CHOICE_INGREDIENT_EFFECT : affected
```

## Inventory and ordering

```mermaid
erDiagram
    LOCATION ||--o{ INVENTORY_BALANCE : holds
    INGREDIENT ||--o{ INVENTORY_BALANCE : counted_as
    LOCATION ||--o{ INVENTORY_MOVEMENT : records
    INGREDIENT ||--o{ INVENTORY_MOVEMENT : changes

    LOCATION ||--o{ CUSTOMER_ORDER : receives
    ACCOUNT o|--o{ CUSTOMER_ORDER : optionally_places
    CUSTOMER_ORDER ||--|{ ORDER_ITEM : contains
    ORDER_ITEM ||--o{ ORDER_ITEM_OPTION : selects
    ORDER_ITEM ||--|{ ORDER_ITEM_CONSUMPTION : snapshots
    INGREDIENT ||--o{ ORDER_ITEM_CONSUMPTION : consumes
    CUSTOMER_ORDER ||--o{ ORDER_STATUS_HISTORY : transitions
    CUSTOMER_ORDER ||--o{ PAYMENT : paid_by
    CUSTOMER_ORDER o|--o{ INVENTORY_MOVEMENT : causes
```
