ALTER TABLE recipe
    ADD COLUMN version bigint NOT NULL DEFAULT 0;

ALTER TABLE recipe_version
    ADD COLUMN version bigint NOT NULL DEFAULT 0;

ALTER TABLE ingredient
    ADD CONSTRAINT ck_ingredient_version_nonnegative CHECK (version >= 0);

ALTER TABLE recipe
    ADD CONSTRAINT ck_recipe_version_nonnegative CHECK (version >= 0);

ALTER TABLE recipe_version
    ADD CONSTRAINT ck_recipe_version_lock_nonnegative CHECK (version >= 0);

CREATE UNIQUE INDEX uq_recipe_name_organization_ci
    ON recipe (organization_id, lower(name));

CREATE UNIQUE INDEX uq_recipe_single_draft
    ON recipe_version (recipe_id)
    WHERE status = 'DRAFT';

ALTER TABLE catalog_change
    DROP CONSTRAINT ck_catalog_change_entity_type,
    DROP CONSTRAINT ck_catalog_change_action;

ALTER TABLE catalog_change
    ADD CONSTRAINT ck_catalog_change_entity_type
        CHECK (entity_type IN ('INGREDIENT', 'RECIPE', 'RECIPE_VERSION')),
    ADD CONSTRAINT ck_catalog_change_action
        CHECK (action IN (
            'CREATE', 'UPDATE', 'ARCHIVE', 'CREATE_VERSION',
            'UPDATE_DRAFT', 'PUBLISH', 'RETIRE'
        ));

CREATE FUNCTION lock_offering_recipe_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_recipe_id uuid;
BEGIN
    SELECT recipe_id
      INTO parent_recipe_id
      FROM recipe_version
     WHERE id = NEW.recipe_version_id
     FOR UPDATE;

    IF parent_recipe_id IS NOT NULL THEN
        PERFORM 1 FROM recipe WHERE id = parent_recipe_id FOR UPDATE;
    END IF;
    PERFORM ingredient.id
      FROM ingredient
     WHERE ingredient.id IN (
         SELECT component.ingredient_id
           FROM recipe_component component
          WHERE component.recipe_version_id = NEW.recipe_version_id
         UNION
         SELECT effect.ingredient_id
           FROM menu_variant_option_choice variant_choice
           JOIN option_choice_ingredient_effect effect
             ON effect.menu_variant_option_choice_id = variant_choice.id
          WHERE variant_choice.menu_variant_id = NEW.menu_variant_id
            AND variant_choice.enabled
     )
     ORDER BY ingredient.id
     FOR UPDATE;
    RETURN NEW;
END;
$$;

CREATE TRIGGER a_offering_recipe_lifecycle_lock
BEFORE INSERT OR UPDATE ON menu_variant_offering
FOR EACH ROW EXECUTE FUNCTION lock_offering_recipe_lifecycle();

CREATE FUNCTION prevent_available_recipe_version_retirement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED'
       AND EXISTS (
           SELECT 1 FROM menu_variant_offering
            WHERE recipe_version_id = OLD.id AND available
       ) THEN
        RAISE EXCEPTION 'available offerings require a published recipe version';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER available_recipe_version_cannot_be_retired
BEFORE UPDATE ON recipe_version
FOR EACH ROW EXECUTE FUNCTION prevent_available_recipe_version_retirement();

CREATE FUNCTION prevent_available_recipe_archival()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL
       AND EXISTS (
           SELECT 1
             FROM menu_variant_offering offering
             JOIN recipe_version version ON version.id = offering.recipe_version_id
            WHERE version.recipe_id = OLD.id AND offering.available
       ) THEN
        RAISE EXCEPTION 'available offerings require an active recipe';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER available_recipe_cannot_be_archived
BEFORE UPDATE ON recipe
FOR EACH ROW EXECUTE FUNCTION prevent_available_recipe_archival();

CREATE FUNCTION prevent_available_ingredient_archival()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL
       AND EXISTS (
           SELECT 1
             FROM menu_variant_offering offering
             JOIN recipe_component component
               ON component.recipe_version_id = offering.recipe_version_id
            WHERE component.ingredient_id = OLD.id AND offering.available
           UNION ALL
           SELECT 1
             FROM menu_variant_offering offering
             JOIN menu_variant_option_choice variant_choice
               ON variant_choice.menu_variant_id = offering.menu_variant_id
              AND variant_choice.enabled
             JOIN option_choice_ingredient_effect effect
               ON effect.menu_variant_option_choice_id = variant_choice.id
            WHERE effect.ingredient_id = OLD.id AND offering.available
       ) THEN
        RAISE EXCEPTION 'available offerings require active ingredients';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER available_offering_ingredient_cannot_be_archived
BEFORE UPDATE ON ingredient
FOR EACH ROW EXECUTE FUNCTION prevent_available_ingredient_archival();
