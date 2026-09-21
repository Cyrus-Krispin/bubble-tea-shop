CREATE TABLE menu_variant_currency_price (
    organization_id uuid NOT NULL,
    menu_variant_option_choice_id uuid NOT NULL,
    currency_code varchar(3) NOT NULL CHECK (currency_code IN ('MYR', 'CNY')),
    price_delta_minor bigint NOT NULL CHECK (price_delta_minor BETWEEN -100000000 AND 100000000),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (menu_variant_option_choice_id, currency_code),
    FOREIGN KEY (menu_variant_option_choice_id, organization_id)
        REFERENCES menu_variant_option_choice (id, organization_id)
);

CREATE FUNCTION variant_currency_ready(variant_id uuid, currency varchar)
RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT currency = 'SGD' OR (currency IN ('MYR', 'CNY') AND NOT EXISTS (
        SELECT 1 FROM menu_variant_option_choice link
        JOIN option_choice choice ON choice.id = link.option_choice_id AND choice.archived_at IS NULL
        JOIN option_group grp ON grp.id = choice.option_group_id AND grp.archived_at IS NULL
        WHERE link.menu_variant_id = variant_id AND link.enabled AND NOT EXISTS (
            SELECT 1 FROM menu_variant_currency_price price
            WHERE price.menu_variant_option_choice_id = link.id AND price.currency_code = currency
        )
    ));
$$;

CREATE FUNCTION preserve_location_currency() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.currency_code IS DISTINCT FROM OLD.currency_code THEN
        RAISE EXCEPTION 'Location currency is immutable; create a new location';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER location_currency_immutable BEFORE UPDATE OF currency_code ON location
    FOR EACH ROW EXECUTE FUNCTION preserve_location_currency();
