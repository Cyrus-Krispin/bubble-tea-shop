CREATE TABLE organization (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(160) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_organization_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE location (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organization(id),
    name varchar(160) NOT NULL,
    timezone varchar(64) NOT NULL,
    default_locale varchar(16) NOT NULL DEFAULT 'en-SG',
    currency_code varchar(3) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_location_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_location_name_organization UNIQUE (organization_id, name),
    CONSTRAINT ck_location_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_location_currency CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE TABLE account (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(100) NOT NULL,
    normalized_username varchar(100) NOT NULL,
    password_hash varchar(255) NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_account_normalized_username UNIQUE (normalized_username),
    CONSTRAINT ck_account_username_not_blank CHECK (btrim(username) <> ''),
    CONSTRAINT ck_account_username_normalized CHECK (normalized_username = lower(btrim(username))),
    CONSTRAINT ck_account_password_hash_not_blank CHECK (btrim(password_hash) <> '')
);

CREATE TABLE organization_membership (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organization(id),
    account_id uuid NOT NULL REFERENCES account(id),
    role varchar(20) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_membership_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_membership_account_organization UNIQUE (organization_id, account_id),
    CONSTRAINT ck_membership_role CHECK (role IN ('OWNER', 'MANAGER'))
);

CREATE TABLE location_assignment (
    organization_id uuid NOT NULL,
    membership_id uuid NOT NULL,
    location_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (membership_id, location_id),
    CONSTRAINT fk_assignment_membership
        FOREIGN KEY (membership_id, organization_id)
        REFERENCES organization_membership(id, organization_id),
    CONSTRAINT fk_assignment_location
        FOREIGN KEY (location_id, organization_id)
        REFERENCES location(id, organization_id)
);

CREATE TABLE refresh_session (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES account(id),
    token_hash varchar(128) NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    replaced_by_session_id uuid REFERENCES refresh_session(id),
    device_description varchar(255),
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_refresh_session_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_refresh_session_expiry CHECK (expires_at > created_at),
    CONSTRAINT ck_refresh_session_replacement CHECK (replaced_by_session_id IS NULL OR replaced_by_session_id <> id)
);

CREATE TABLE ingredient (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organization(id),
    name varchar(160) NOT NULL,
    sku varchar(80),
    base_unit varchar(20) NOT NULL,
    reorder_threshold numeric(19,6),
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_ingredient_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_ingredient_name_organization UNIQUE (organization_id, name),
    CONSTRAINT uq_ingredient_sku_organization UNIQUE (organization_id, sku),
    CONSTRAINT ck_ingredient_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_ingredient_base_unit CHECK (base_unit IN ('GRAM', 'MILLILITER', 'EACH')),
    CONSTRAINT ck_ingredient_reorder_threshold CHECK (reorder_threshold IS NULL OR reorder_threshold >= 0)
);

CREATE TABLE recipe (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organization(id),
    name varchar(160) NOT NULL,
    description text,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_recipe_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_recipe_name_organization UNIQUE (organization_id, name),
    CONSTRAINT ck_recipe_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE recipe_version (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    version_number integer NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'DRAFT',
    created_by_account_id uuid REFERENCES account(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    CONSTRAINT uq_recipe_version_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_recipe_version_number UNIQUE (recipe_id, version_number),
    CONSTRAINT fk_recipe_version_recipe
        FOREIGN KEY (recipe_id, organization_id)
        REFERENCES recipe(id, organization_id),
    CONSTRAINT ck_recipe_version_number CHECK (version_number > 0),
    CONSTRAINT ck_recipe_version_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
    CONSTRAINT ck_recipe_version_published_at CHECK (
        (status = 'DRAFT' AND published_at IS NULL)
        OR (status IN ('PUBLISHED', 'RETIRED') AND published_at IS NOT NULL)
    )
);

CREATE TABLE recipe_component (
    organization_id uuid NOT NULL,
    recipe_version_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric(19,6) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (recipe_version_id, ingredient_id),
    CONSTRAINT fk_recipe_component_version
        FOREIGN KEY (recipe_version_id, organization_id)
        REFERENCES recipe_version(id, organization_id),
    CONSTRAINT fk_recipe_component_ingredient
        FOREIGN KEY (ingredient_id, organization_id)
        REFERENCES ingredient(id, organization_id),
    CONSTRAINT ck_recipe_component_quantity CHECK (quantity > 0)
);

CREATE TABLE menu_product (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organization(id),
    name varchar(160) NOT NULL,
    description text,
    image_url text,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_menu_product_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_menu_product_name_organization UNIQUE (organization_id, name),
    CONSTRAINT ck_menu_product_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE menu_variant (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    menu_product_id uuid NOT NULL,
    name varchar(100) NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_menu_variant_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_menu_variant_name_product UNIQUE (menu_product_id, name),
    CONSTRAINT fk_menu_variant_product
        FOREIGN KEY (menu_product_id, organization_id)
        REFERENCES menu_product(id, organization_id),
    CONSTRAINT ck_menu_variant_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_menu_variant_display_order CHECK (display_order >= 0)
);

CREATE TABLE menu_variant_offering (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    menu_variant_id uuid NOT NULL,
    recipe_version_id uuid NOT NULL,
    price_minor bigint NOT NULL,
    currency_code varchar(3) NOT NULL,
    available boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_offering_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_offering_location_variant UNIQUE (location_id, menu_variant_id),
    CONSTRAINT fk_offering_location
        FOREIGN KEY (location_id, organization_id)
        REFERENCES location(id, organization_id),
    CONSTRAINT fk_offering_variant
        FOREIGN KEY (menu_variant_id, organization_id)
        REFERENCES menu_variant(id, organization_id),
    CONSTRAINT fk_offering_recipe_version
        FOREIGN KEY (recipe_version_id, organization_id)
        REFERENCES recipe_version(id, organization_id),
    CONSTRAINT ck_offering_price CHECK (price_minor >= 0),
    CONSTRAINT ck_offering_currency CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE TABLE option_group (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organization(id),
    name varchar(120) NOT NULL,
    minimum_selections integer NOT NULL DEFAULT 0,
    maximum_selections integer NOT NULL DEFAULT 1,
    display_order integer NOT NULL DEFAULT 0,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_option_group_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_option_group_name_organization UNIQUE (organization_id, name),
    CONSTRAINT ck_option_group_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_option_group_selection_range CHECK (
        minimum_selections >= 0
        AND maximum_selections > 0
        AND minimum_selections <= maximum_selections
    ),
    CONSTRAINT ck_option_group_display_order CHECK (display_order >= 0)
);

CREATE TABLE option_choice (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    option_group_id uuid NOT NULL,
    name varchar(120) NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_option_choice_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_option_choice_name_group UNIQUE (option_group_id, name),
    CONSTRAINT fk_option_choice_group
        FOREIGN KEY (option_group_id, organization_id)
        REFERENCES option_group(id, organization_id),
    CONSTRAINT ck_option_choice_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_option_choice_display_order CHECK (display_order >= 0)
);

CREATE TABLE menu_variant_option_choice (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    menu_variant_id uuid NOT NULL,
    option_choice_id uuid NOT NULL,
    price_delta_minor bigint NOT NULL DEFAULT 0,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_variant_option_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_variant_option_choice UNIQUE (menu_variant_id, option_choice_id),
    CONSTRAINT fk_variant_option_variant
        FOREIGN KEY (menu_variant_id, organization_id)
        REFERENCES menu_variant(id, organization_id),
    CONSTRAINT fk_variant_option_choice
        FOREIGN KEY (option_choice_id, organization_id)
        REFERENCES option_choice(id, organization_id)
);

CREATE TABLE option_choice_ingredient_effect (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    menu_variant_option_choice_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity_delta numeric(19,6) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_option_effect_variant_ingredient UNIQUE (menu_variant_option_choice_id, ingredient_id),
    CONSTRAINT fk_option_effect_variant_choice
        FOREIGN KEY (menu_variant_option_choice_id, organization_id)
        REFERENCES menu_variant_option_choice(id, organization_id),
    CONSTRAINT fk_option_effect_ingredient
        FOREIGN KEY (ingredient_id, organization_id)
        REFERENCES ingredient(id, organization_id),
    CONSTRAINT ck_option_effect_quantity CHECK (quantity_delta <> 0)
);

CREATE TABLE inventory_balance (
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric(19,6) NOT NULL DEFAULT 0,
    version bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (location_id, ingredient_id),
    CONSTRAINT fk_inventory_balance_location
        FOREIGN KEY (location_id, organization_id)
        REFERENCES location(id, organization_id),
    CONSTRAINT fk_inventory_balance_ingredient
        FOREIGN KEY (ingredient_id, organization_id)
        REFERENCES ingredient(id, organization_id),
    CONSTRAINT ck_inventory_balance_quantity CHECK (quantity >= 0),
    CONSTRAINT ck_inventory_balance_version CHECK (version >= 0)
);

CREATE TABLE customer_order (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    customer_account_id uuid REFERENCES account(id),
    public_order_number varchar(32) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    payment_method varchar(20) NOT NULL,
    currency_code varchar(3) NOT NULL,
    subtotal_minor bigint NOT NULL,
    total_minor bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    cancelled_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_customer_order_id_organization UNIQUE (id, organization_id),
    CONSTRAINT uq_customer_order_public_number UNIQUE (location_id, public_order_number),
    CONSTRAINT fk_customer_order_location
        FOREIGN KEY (location_id, organization_id)
        REFERENCES location(id, organization_id),
    CONSTRAINT ck_customer_order_public_number CHECK (btrim(public_order_number) <> ''),
    CONSTRAINT ck_customer_order_status CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_customer_order_payment_method CHECK (payment_method IN ('CASH', 'CARD')),
    CONSTRAINT ck_customer_order_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_customer_order_subtotal CHECK (subtotal_minor >= 0),
    CONSTRAINT ck_customer_order_total CHECK (total_minor >= 0),
    CONSTRAINT ck_customer_order_status_timestamp CHECK (
        (status = 'PENDING' AND completed_at IS NULL AND cancelled_at IS NULL)
        OR (status = 'COMPLETED' AND completed_at IS NOT NULL AND cancelled_at IS NULL)
        OR (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND completed_at IS NULL)
    )
);

CREATE TABLE order_item (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    customer_order_id uuid NOT NULL,
    menu_variant_id uuid,
    product_name_snapshot varchar(160) NOT NULL,
    variant_name_snapshot varchar(100) NOT NULL,
    quantity integer NOT NULL,
    unit_price_minor bigint NOT NULL,
    line_total_minor bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_order_item_id_organization UNIQUE (id, organization_id),
    CONSTRAINT fk_order_item_order
        FOREIGN KEY (customer_order_id, organization_id)
        REFERENCES customer_order(id, organization_id),
    CONSTRAINT fk_order_item_variant
        FOREIGN KEY (menu_variant_id, organization_id)
        REFERENCES menu_variant(id, organization_id),
    CONSTRAINT ck_order_item_product_name CHECK (btrim(product_name_snapshot) <> ''),
    CONSTRAINT ck_order_item_variant_name CHECK (btrim(variant_name_snapshot) <> ''),
    CONSTRAINT ck_order_item_quantity CHECK (quantity > 0),
    CONSTRAINT ck_order_item_unit_price CHECK (unit_price_minor >= 0),
    CONSTRAINT ck_order_item_line_total CHECK (line_total_minor >= 0)
);

CREATE TABLE order_item_option (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    option_choice_id uuid,
    group_name_snapshot varchar(120) NOT NULL,
    choice_name_snapshot varchar(120) NOT NULL,
    price_delta_minor bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_order_item_option_item
        FOREIGN KEY (order_item_id, organization_id)
        REFERENCES order_item(id, organization_id),
    CONSTRAINT fk_order_item_option_choice
        FOREIGN KEY (option_choice_id, organization_id)
        REFERENCES option_choice(id, organization_id),
    CONSTRAINT ck_order_item_option_group_name CHECK (btrim(group_name_snapshot) <> ''),
    CONSTRAINT ck_order_item_option_choice_name CHECK (btrim(choice_name_snapshot) <> '')
);

CREATE TABLE order_item_consumption (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric(19,6) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_order_consumption_item_ingredient UNIQUE (order_item_id, ingredient_id),
    CONSTRAINT fk_order_consumption_item
        FOREIGN KEY (order_item_id, organization_id)
        REFERENCES order_item(id, organization_id),
    CONSTRAINT fk_order_consumption_ingredient
        FOREIGN KEY (ingredient_id, organization_id)
        REFERENCES ingredient(id, organization_id),
    CONSTRAINT ck_order_consumption_quantity CHECK (quantity > 0)
);

CREATE TABLE order_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    customer_order_id uuid NOT NULL,
    from_status varchar(20),
    to_status varchar(20) NOT NULL,
    changed_by_account_id uuid REFERENCES account(id),
    changed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_order_history_order
        FOREIGN KEY (customer_order_id, organization_id)
        REFERENCES customer_order(id, organization_id),
    CONSTRAINT ck_order_history_from_status CHECK (
        from_status IS NULL OR from_status IN ('PENDING', 'COMPLETED', 'CANCELLED')
    ),
    CONSTRAINT ck_order_history_to_status CHECK (to_status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_order_history_transition CHECK (from_status IS NULL OR from_status <> to_status)
);

CREATE TABLE payment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    customer_order_id uuid NOT NULL,
    method varchar(20) NOT NULL,
    status varchar(20) NOT NULL,
    amount_minor bigint NOT NULL,
    currency_code varchar(3) NOT NULL,
    external_reference varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_payment_order
        FOREIGN KEY (customer_order_id, organization_id)
        REFERENCES customer_order(id, organization_id),
    CONSTRAINT ck_payment_method CHECK (method IN ('CASH', 'CARD')),
    CONSTRAINT ck_payment_status CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    CONSTRAINT ck_payment_amount CHECK (amount_minor >= 0),
    CONSTRAINT ck_payment_currency CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE TABLE inventory_movement (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    movement_type varchar(20) NOT NULL,
    quantity_delta numeric(19,6) NOT NULL,
    customer_order_id uuid,
    actor_account_id uuid REFERENCES account(id),
    source_reference varchar(120),
    note text,
    total_cost_minor bigint,
    currency_code varchar(3),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_inventory_movement_id_organization UNIQUE (id, organization_id),
    CONSTRAINT fk_inventory_movement_location
        FOREIGN KEY (location_id, organization_id)
        REFERENCES location(id, organization_id),
    CONSTRAINT fk_inventory_movement_ingredient
        FOREIGN KEY (ingredient_id, organization_id)
        REFERENCES ingredient(id, organization_id),
    CONSTRAINT fk_inventory_movement_order
        FOREIGN KEY (customer_order_id, organization_id)
        REFERENCES customer_order(id, organization_id),
    CONSTRAINT ck_inventory_movement_type CHECK (
        movement_type IN ('OPENING', 'RECEIPT', 'SALE', 'REVERSAL', 'ADJUSTMENT')
    ),
    CONSTRAINT ck_inventory_movement_delta CHECK (quantity_delta <> 0),
    CONSTRAINT ck_inventory_movement_sign CHECK (
        (movement_type IN ('OPENING', 'RECEIPT', 'REVERSAL') AND quantity_delta > 0)
        OR (movement_type = 'SALE' AND quantity_delta < 0)
        OR movement_type = 'ADJUSTMENT'
    ),
    CONSTRAINT ck_inventory_movement_order_link CHECK (
        (movement_type IN ('SALE', 'REVERSAL') AND customer_order_id IS NOT NULL)
        OR (movement_type NOT IN ('SALE', 'REVERSAL') AND customer_order_id IS NULL)
    ),
    CONSTRAINT ck_inventory_movement_cost CHECK (total_cost_minor IS NULL OR total_cost_minor >= 0),
    CONSTRAINT ck_inventory_movement_cost_currency CHECK (
        (total_cost_minor IS NULL AND currency_code IS NULL)
        OR (total_cost_minor IS NOT NULL AND currency_code ~ '^[A-Z]{3}$')
    )
);

CREATE UNIQUE INDEX uq_inventory_sale_order_ingredient
    ON inventory_movement (customer_order_id, ingredient_id)
    WHERE movement_type = 'SALE';

CREATE INDEX idx_location_active ON location (organization_id, active);
CREATE INDEX idx_membership_active ON organization_membership (organization_id, role, active);
CREATE INDEX idx_refresh_session_account_active ON refresh_session (account_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_ingredient_active ON ingredient (organization_id, name) WHERE archived_at IS NULL;
CREATE INDEX idx_recipe_active ON recipe (organization_id, name) WHERE archived_at IS NULL;
CREATE INDEX idx_menu_product_active ON menu_product (organization_id, name) WHERE archived_at IS NULL;
CREATE INDEX idx_offering_catalog ON menu_variant_offering (location_id, available, menu_variant_id);
CREATE INDEX idx_inventory_balance_stock ON inventory_balance (location_id, quantity);
CREATE INDEX idx_inventory_movement_history ON inventory_movement (location_id, ingredient_id, created_at DESC);
CREATE INDEX idx_customer_order_status_time ON customer_order (location_id, status, created_at DESC);
CREATE INDEX idx_order_item_order ON order_item (customer_order_id);
CREATE INDEX idx_order_history_order_time ON order_status_history (customer_order_id, changed_at);
CREATE INDEX idx_payment_order ON payment (customer_order_id);

CREATE FUNCTION reject_inventory_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'inventory movements are immutable';
END;
$$;

CREATE TRIGGER inventory_movement_is_immutable
BEFORE UPDATE OR DELETE ON inventory_movement
FOR EACH ROW EXECUTE FUNCTION reject_inventory_movement_mutation();

CREATE FUNCTION reject_order_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'order snapshots and status history are immutable';
END;
$$;

CREATE TRIGGER order_item_is_immutable
BEFORE UPDATE OR DELETE ON order_item
FOR EACH ROW EXECUTE FUNCTION reject_order_audit_mutation();

CREATE TRIGGER order_item_option_is_immutable
BEFORE UPDATE OR DELETE ON order_item_option
FOR EACH ROW EXECUTE FUNCTION reject_order_audit_mutation();

CREATE TRIGGER order_item_consumption_is_immutable
BEFORE UPDATE OR DELETE ON order_item_consumption
FOR EACH ROW EXECUTE FUNCTION reject_order_audit_mutation();

CREATE TRIGGER order_status_history_is_immutable
BEFORE UPDATE OR DELETE ON order_status_history
FOR EACH ROW EXECUTE FUNCTION reject_order_audit_mutation();

CREATE FUNCTION protect_published_recipe_components()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    affected_version_id uuid;
    affected_status varchar(20);
    ingredient_archived_at timestamptz;
BEGIN
    affected_version_id := COALESCE(NEW.recipe_version_id, OLD.recipe_version_id);
    SELECT status INTO affected_status
      FROM recipe_version
     WHERE id = affected_version_id;

    IF affected_status IN ('PUBLISHED', 'RETIRED') THEN
        RAISE EXCEPTION 'published recipe versions are immutable';
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT archived_at INTO ingredient_archived_at
          FROM ingredient
         WHERE id = NEW.ingredient_id;
        IF ingredient_archived_at IS NOT NULL THEN
            RAISE EXCEPTION 'archived ingredients cannot be added to recipes';
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER published_recipe_components_are_immutable
BEFORE INSERT OR UPDATE OR DELETE ON recipe_component
FOR EACH ROW EXECUTE FUNCTION protect_published_recipe_components();

CREATE FUNCTION validate_menu_variant_offering()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    version_status varchar(20);
    recipe_archived_at timestamptz;
    variant_archived_at timestamptz;
    product_archived_at timestamptz;
    location_currency varchar(3);
    archived_ingredient_count integer;
BEGIN
    SELECT rv.status, r.archived_at
      INTO version_status, recipe_archived_at
      FROM recipe_version rv
      JOIN recipe r ON r.id = rv.recipe_id
     WHERE rv.id = NEW.recipe_version_id;

    SELECT mv.archived_at, mp.archived_at
      INTO variant_archived_at, product_archived_at
      FROM menu_variant mv
      JOIN menu_product mp ON mp.id = mv.menu_product_id
     WHERE mv.id = NEW.menu_variant_id;

    SELECT currency_code
      INTO location_currency
      FROM location
     WHERE id = NEW.location_id;

    SELECT count(*)
      INTO archived_ingredient_count
      FROM (
          SELECT rc.ingredient_id
            FROM recipe_component rc
            JOIN ingredient i ON i.id = rc.ingredient_id
           WHERE rc.recipe_version_id = NEW.recipe_version_id
             AND i.archived_at IS NOT NULL
          UNION
          SELECT effect.ingredient_id
            FROM menu_variant_option_choice variant_choice
            JOIN option_choice_ingredient_effect effect
              ON effect.menu_variant_option_choice_id = variant_choice.id
            JOIN ingredient i ON i.id = effect.ingredient_id
           WHERE variant_choice.menu_variant_id = NEW.menu_variant_id
             AND variant_choice.enabled
             AND i.archived_at IS NOT NULL
      ) archived_ingredients;

    IF version_status <> 'PUBLISHED' OR recipe_archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'offerings require a published, active recipe';
    END IF;
    IF variant_archived_at IS NOT NULL OR product_archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'archived menu products or variants cannot be offered';
    END IF;
    IF NEW.currency_code <> location_currency THEN
        RAISE EXCEPTION 'offering currency must match location currency';
    END IF;
    IF archived_ingredient_count > 0 THEN
        RAISE EXCEPTION 'offerings cannot consume archived ingredients';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER menu_variant_offering_is_valid
BEFORE INSERT OR UPDATE ON menu_variant_offering
FOR EACH ROW EXECUTE FUNCTION validate_menu_variant_offering();
