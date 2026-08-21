ALTER TABLE ingredient
    ADD COLUMN version bigint NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX uq_ingredient_name_organization_ci
    ON ingredient (organization_id, lower(name));

CREATE UNIQUE INDEX uq_ingredient_sku_organization_ci
    ON ingredient (organization_id, lower(sku))
    WHERE sku IS NOT NULL;

CREATE TABLE catalog_change (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organization(id),
    entity_type varchar(40) NOT NULL,
    entity_id uuid NOT NULL,
    action varchar(20) NOT NULL,
    actor_account_id uuid NOT NULL REFERENCES account(id),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_catalog_change_entity_type CHECK (entity_type IN ('INGREDIENT')),
    CONSTRAINT ck_catalog_change_action CHECK (action IN ('CREATE', 'UPDATE', 'ARCHIVE'))
);

CREATE INDEX idx_catalog_change_entity
    ON catalog_change (organization_id, entity_type, entity_id, occurred_at DESC);
