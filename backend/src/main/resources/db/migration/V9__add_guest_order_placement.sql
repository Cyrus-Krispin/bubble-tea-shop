ALTER TABLE customer_order
    ADD COLUMN placement_key uuid,
    ADD COLUMN placement_fingerprint varchar(64);

ALTER TABLE customer_order
    ADD CONSTRAINT ck_customer_order_placement_pair CHECK (
        (placement_key IS NULL AND placement_fingerprint IS NULL)
        OR (placement_key IS NOT NULL AND placement_fingerprint ~ '^[0-9a-f]{64}$')
    );

CREATE UNIQUE INDEX uq_customer_order_location_placement_key
    ON customer_order (location_id, placement_key)
    WHERE placement_key IS NOT NULL;

CREATE SEQUENCE customer_order_public_number_seq;
SELECT setval(
    'customer_order_public_number_seq',
    COALESCE(MAX(substring(public_order_number FROM '^BT([0-9]{10})$')::bigint), 0) + 1,
    false
)
FROM customer_order;

ALTER TABLE order_item DISABLE TRIGGER order_item_is_immutable;
ALTER TABLE order_item ADD COLUMN line_number integer;
WITH numbered AS (
    SELECT id, row_number() OVER (
        PARTITION BY customer_order_id ORDER BY created_at, id
    ) AS line_number
    FROM order_item
)
UPDATE order_item item
   SET line_number = numbered.line_number
  FROM numbered
 WHERE numbered.id = item.id;
ALTER TABLE order_item ALTER COLUMN line_number SET NOT NULL;
ALTER TABLE order_item ADD CONSTRAINT ck_order_item_line_number CHECK (line_number > 0);
ALTER TABLE order_item ADD CONSTRAINT uq_order_item_line_number UNIQUE (customer_order_id, line_number);
ALTER TABLE order_item ENABLE TRIGGER order_item_is_immutable;

ALTER TABLE order_item_option DISABLE TRIGGER order_item_option_is_immutable;
ALTER TABLE order_item_option ADD COLUMN selection_number integer;
WITH numbered AS (
    SELECT id, row_number() OVER (
        PARTITION BY order_item_id ORDER BY created_at, id
    ) AS selection_number
    FROM order_item_option
)
UPDATE order_item_option item_option
   SET selection_number = numbered.selection_number
  FROM numbered
 WHERE numbered.id = item_option.id;
ALTER TABLE order_item_option ALTER COLUMN selection_number SET NOT NULL;
ALTER TABLE order_item_option ADD CONSTRAINT ck_order_item_option_selection_number CHECK (selection_number > 0);
ALTER TABLE order_item_option ADD CONSTRAINT uq_order_item_option_selection_number UNIQUE (order_item_id, selection_number);
ALTER TABLE order_item_option ENABLE TRIGGER order_item_option_is_immutable;

INSERT INTO ingredient (id, organization_id, name, sku, base_unit, reorder_threshold)
VALUES
    ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Black Tea', 'TEA-BLACK', 'GRAM', 500),
    ('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Oolong Tea', 'TEA-OOLONG', 'GRAM', 500),
    ('90000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Matcha Powder', 'MATCHA', 'GRAM', 300),
    ('90000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Taro Powder', 'TARO', 'GRAM', 500),
    ('90000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Fresh Milk', 'MILK', 'MILLILITER', 5000),
    ('90000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Strawberry Syrup', 'SYRUP-STRAWBERRY', 'MILLILITER', 1000),
    ('90000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Brown Sugar Pearls', 'TOP-PEARLS', 'GRAM', 1000),
    ('90000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Grass Jelly', 'TOP-GRASS-JELLY', 'GRAM', 1000),
    ('90000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'Aloe', 'TOP-ALOE', 'GRAM', 1000);

INSERT INTO recipe_version (id, organization_id, recipe_id, version_number, status)
VALUES
    ('91000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 2, 'DRAFT'),
    ('91000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 2, 'DRAFT'),
    ('91000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 2, 'DRAFT'),
    ('91000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 2, 'DRAFT');

INSERT INTO recipe_component (organization_id, recipe_version_id, ingredient_id, quantity)
VALUES
    ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 8),
    ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000005', 200),
    ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 8),
    ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000006', 30),
    ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', 5),
    ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000005', 220),
    ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000004', 40),
    ('10000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000005', 200);

UPDATE recipe_version
   SET status = 'PUBLISHED', published_at = now(), version = version + 1
 WHERE id IN (
    '91000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000003',
    '91000000-0000-0000-0000-000000000004'
 );

UPDATE menu_variant_offering offering
   SET recipe_version_id = replacement.id, version = offering.version + 1, updated_at = now()
  FROM recipe_version current_version
  JOIN recipe_version replacement
    ON replacement.recipe_id = current_version.recipe_id
   AND replacement.version_number = 2
 WHERE offering.recipe_version_id = current_version.id
   AND current_version.organization_id = '10000000-0000-0000-0000-000000000001';

INSERT INTO option_choice_ingredient_effect (
    organization_id, menu_variant_option_choice_id, ingredient_id, quantity_delta
)
SELECT variant_choice.organization_id,
       variant_choice.id,
       CASE choice.id
           WHEN '71000000-0000-0000-0000-000000000010' THEN '90000000-0000-0000-0000-000000000007'::uuid
           WHEN '71000000-0000-0000-0000-000000000011' THEN '90000000-0000-0000-0000-000000000008'::uuid
           WHEN '71000000-0000-0000-0000-000000000012' THEN '90000000-0000-0000-0000-000000000009'::uuid
       END,
       50
  FROM menu_variant_option_choice variant_choice
  JOIN option_choice choice ON choice.id = variant_choice.option_choice_id
 WHERE choice.id IN (
    '71000000-0000-0000-0000-000000000010',
    '71000000-0000-0000-0000-000000000011',
    '71000000-0000-0000-0000-000000000012'
 );
