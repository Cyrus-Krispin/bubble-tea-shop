ALTER TABLE menu_product ADD COLUMN version bigint NOT NULL DEFAULT 0;
ALTER TABLE menu_variant ADD COLUMN version bigint NOT NULL DEFAULT 0;
ALTER TABLE menu_variant_offering ADD COLUMN version bigint NOT NULL DEFAULT 0;
ALTER TABLE option_group ADD COLUMN version bigint NOT NULL DEFAULT 0;
ALTER TABLE option_choice ADD COLUMN version bigint NOT NULL DEFAULT 0;
ALTER TABLE menu_variant_option_choice ADD COLUMN version bigint NOT NULL DEFAULT 0;

ALTER TABLE menu_product
    ADD CONSTRAINT ck_menu_product_version_nonnegative CHECK (version >= 0);
ALTER TABLE menu_variant
    ADD CONSTRAINT ck_menu_variant_version_nonnegative CHECK (version >= 0);
ALTER TABLE menu_variant_offering
    ADD CONSTRAINT ck_menu_variant_offering_version_nonnegative CHECK (version >= 0);
ALTER TABLE option_group
    ADD CONSTRAINT ck_option_group_version_nonnegative CHECK (version >= 0);
ALTER TABLE option_choice
    ADD CONSTRAINT ck_option_choice_version_nonnegative CHECK (version >= 0);
ALTER TABLE menu_variant_option_choice
    ADD CONSTRAINT ck_menu_variant_option_choice_version_nonnegative CHECK (version >= 0);

CREATE UNIQUE INDEX uq_menu_product_name_organization_ci
    ON menu_product (organization_id, lower(name));
CREATE UNIQUE INDEX uq_menu_product_public_slug_organization_ci
    ON menu_product (organization_id, lower(public_slug)) WHERE public_slug IS NOT NULL;
CREATE UNIQUE INDEX uq_menu_variant_name_product_ci
    ON menu_variant (menu_product_id, lower(name));
CREATE UNIQUE INDEX uq_option_group_name_organization_ci
    ON option_group (organization_id, lower(name));
CREATE UNIQUE INDEX uq_option_choice_name_group_ci
    ON option_choice (option_group_id, lower(name));

ALTER TABLE catalog_change
    DROP CONSTRAINT ck_catalog_change_entity_type,
    DROP CONSTRAINT ck_catalog_change_action;

ALTER TABLE catalog_change
    ADD CONSTRAINT ck_catalog_change_entity_type CHECK (entity_type IN (
        'INGREDIENT', 'RECIPE', 'RECIPE_VERSION', 'MENU_PRODUCT', 'MENU_VARIANT',
        'MENU_OFFERING', 'OPTION_GROUP', 'OPTION_CHOICE', 'VARIANT_OPTION_CHOICE'
    )),
    ADD CONSTRAINT ck_catalog_change_action CHECK (action IN (
        'CREATE', 'UPDATE', 'ARCHIVE', 'CREATE_VERSION', 'UPDATE_DRAFT', 'PUBLISH',
        'RETIRE', 'CONFIGURE'
    ));

CREATE FUNCTION lock_offering_menu_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM product.id
      FROM menu_variant variant
      JOIN menu_product product ON product.id = variant.menu_product_id
     WHERE variant.id = NEW.menu_variant_id
     FOR UPDATE OF product;
    PERFORM 1 FROM menu_variant WHERE id = NEW.menu_variant_id FOR UPDATE;
    RETURN NEW;
END;
$$;

CREATE TRIGGER a0_offering_menu_lifecycle_lock
BEFORE INSERT OR UPDATE ON menu_variant_offering
FOR EACH ROW EXECUTE FUNCTION lock_offering_menu_lifecycle();

CREATE FUNCTION validate_available_variant_configuration(affected_variant_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    invalid_group_count integer;
    archived_effect_count integer;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM menu_variant_offering
         WHERE menu_variant_id = affected_variant_id AND available
    ) THEN
        RETURN;
    END IF;

    SELECT count(*) INTO invalid_group_count
      FROM (
          SELECT group_row.id, group_row.minimum_selections, group_row.maximum_selections,
                 count(*) FILTER (WHERE link.enabled AND choice.archived_at IS NULL) AS enabled_count,
                 count(*) FILTER (
                     WHERE link.enabled AND choice.archived_at IS NULL AND choice.is_default
                 ) AS default_count
            FROM option_group group_row
            JOIN option_choice choice ON choice.option_group_id = group_row.id
            JOIN menu_variant_option_choice link ON link.option_choice_id = choice.id
           WHERE link.menu_variant_id = affected_variant_id
             AND group_row.archived_at IS NULL
          GROUP BY group_row.id, group_row.minimum_selections, group_row.maximum_selections
      ) configured_group
     WHERE configured_group.enabled_count > 0
       AND (configured_group.enabled_count < configured_group.minimum_selections
            OR configured_group.minimum_selections > 0 AND configured_group.default_count <> 1
            OR configured_group.default_count > configured_group.maximum_selections);

    IF invalid_group_count > 0 THEN
        RAISE EXCEPTION 'available offering has invalid option selection bounds';
    END IF;

    SELECT count(*) INTO archived_effect_count
      FROM menu_variant_option_choice link
      JOIN option_choice choice ON choice.id = link.option_choice_id
      JOIN option_group group_row ON group_row.id = choice.option_group_id
      JOIN option_choice_ingredient_effect effect
        ON effect.menu_variant_option_choice_id = link.id
      JOIN ingredient ON ingredient.id = effect.ingredient_id
     WHERE link.menu_variant_id = affected_variant_id
       AND link.enabled
       AND choice.archived_at IS NULL
       AND group_row.archived_at IS NULL
       AND ingredient.archived_at IS NOT NULL;

    IF archived_effect_count > 0 THEN
        RAISE EXCEPTION 'available offering options require active ingredients';
    END IF;
END;
$$;

CREATE FUNCTION prevent_available_menu_archival()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL AND (
        (TG_TABLE_NAME = 'menu_product' AND EXISTS (
            SELECT 1 FROM menu_variant variant
            JOIN menu_variant_offering offering ON offering.menu_variant_id = variant.id
             WHERE variant.menu_product_id = OLD.id AND offering.available
        )) OR
        (TG_TABLE_NAME = 'menu_variant' AND EXISTS (
            SELECT 1 FROM menu_variant_offering offering
             WHERE offering.menu_variant_id = OLD.id AND offering.available
        ))
    ) THEN
        RAISE EXCEPTION 'available offerings require active menu products and variants';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER available_offering_product_cannot_be_archived
BEFORE UPDATE ON menu_product
FOR EACH ROW EXECUTE FUNCTION prevent_available_menu_archival();

CREATE TRIGGER available_offering_variant_cannot_be_archived
BEFORE UPDATE ON menu_variant
FOR EACH ROW EXECUTE FUNCTION prevent_available_menu_archival();

CREATE FUNCTION prevent_available_option_archival()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL AND (
        (TG_TABLE_NAME = 'option_group' AND EXISTS (
            SELECT 1 FROM option_choice choice
            JOIN menu_variant_option_choice link ON link.option_choice_id = choice.id
            JOIN menu_variant_offering offering ON offering.menu_variant_id = link.menu_variant_id
             WHERE choice.option_group_id = OLD.id AND link.enabled AND offering.available
        )) OR
        (TG_TABLE_NAME = 'option_choice' AND EXISTS (
            SELECT 1 FROM menu_variant_option_choice link
            JOIN menu_variant_offering offering ON offering.menu_variant_id = link.menu_variant_id
             WHERE link.option_choice_id = OLD.id AND link.enabled AND offering.available
        ))
    ) THEN
        RAISE EXCEPTION 'available offerings require active option definitions';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER available_offering_option_group_cannot_be_archived
BEFORE UPDATE ON option_group
FOR EACH ROW EXECUTE FUNCTION prevent_available_option_archival();

CREATE TRIGGER available_offering_option_choice_cannot_be_archived
BEFORE UPDATE ON option_choice
FOR EACH ROW EXECUTE FUNCTION prevent_available_option_archival();

CREATE FUNCTION validate_offering_option_configuration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.available THEN
        PERFORM validate_available_variant_configuration(NEW.menu_variant_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER offering_option_configuration_is_valid
AFTER INSERT OR UPDATE ON menu_variant_offering
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_offering_option_configuration();

CREATE FUNCTION validate_changed_variant_option_configuration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    variant_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'menu_variant_option_choice' THEN
        variant_id := COALESCE(NEW.menu_variant_id, OLD.menu_variant_id);
    ELSE
        SELECT menu_variant_id INTO variant_id
          FROM menu_variant_option_choice
         WHERE id = COALESCE(NEW.menu_variant_option_choice_id, OLD.menu_variant_option_choice_id);
    END IF;
    IF variant_id IS NOT NULL THEN
        PERFORM validate_available_variant_configuration(variant_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE CONSTRAINT TRIGGER changed_variant_option_configuration_is_valid
AFTER INSERT OR UPDATE OR DELETE ON menu_variant_option_choice
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_changed_variant_option_configuration();

CREATE CONSTRAINT TRIGGER changed_option_effect_configuration_is_valid
AFTER INSERT OR UPDATE OR DELETE ON option_choice_ingredient_effect
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_changed_variant_option_configuration();

CREATE FUNCTION validate_changed_option_definition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    group_id uuid;
    variant_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'option_group' THEN
        group_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    ELSE
        group_id := CASE WHEN TG_OP = 'DELETE'
            THEN OLD.option_group_id ELSE NEW.option_group_id END;
    END IF;
    FOR variant_id IN
        SELECT DISTINCT link.menu_variant_id
          FROM option_choice choice
          JOIN menu_variant_option_choice link ON link.option_choice_id = choice.id
         WHERE choice.option_group_id = group_id
    LOOP
        PERFORM validate_available_variant_configuration(variant_id);
    END LOOP;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE CONSTRAINT TRIGGER changed_option_group_is_valid
AFTER UPDATE ON option_group
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_changed_option_definition();

CREATE CONSTRAINT TRIGGER changed_option_choice_is_valid
AFTER INSERT OR UPDATE OR DELETE ON option_choice
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_changed_option_definition();
