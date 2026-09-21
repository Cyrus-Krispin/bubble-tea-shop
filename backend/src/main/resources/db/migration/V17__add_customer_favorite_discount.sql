CREATE TABLE customer_favorite (
    account_id uuid NOT NULL REFERENCES account(id),
    organization_id uuid NOT NULL REFERENCES organization(id),
    recipe_id uuid NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, organization_id),
    FOREIGN KEY (recipe_id, organization_id) REFERENCES recipe(id, organization_id)
);
ALTER TABLE customer_order ADD COLUMN discount_minor bigint NOT NULL DEFAULT 0,
    ADD COLUMN discount_recipe_id uuid,
    ADD CONSTRAINT fk_order_discount_recipe FOREIGN KEY (discount_recipe_id, organization_id) REFERENCES recipe(id, organization_id);
UPDATE customer_order SET discount_minor = subtotal_minor - total_minor;
ALTER TABLE customer_order ADD CONSTRAINT ck_order_discount_total
    CHECK (discount_minor >= 0 AND discount_minor <= subtotal_minor AND total_minor = subtotal_minor - discount_minor);
CREATE TRIGGER order_price_snapshot_is_immutable
    BEFORE UPDATE OF subtotal_minor, total_minor, discount_minor, discount_recipe_id ON customer_order
    FOR EACH ROW EXECUTE FUNCTION reject_order_audit_mutation();
