ALTER TABLE location
    ADD COLUMN image_key varchar(40);

ALTER TABLE location
    ADD CONSTRAINT ck_location_image_key CHECK (
        image_key IS NULL OR image_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    );

UPDATE location
   SET image_key = 'orchard-central'
 WHERE id = '20000000-0000-0000-0000-000000000001';

INSERT INTO location (
    id, organization_id, public_slug, image_key, name, timezone, default_locale, currency_code
)
VALUES (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'tiong-bahru',
    'tiong-bahru',
    'Tiong Bahru',
    'Asia/Singapore',
    'en-SG',
    'SGD'
);

UPDATE menu_product
   SET artwork_key = public_slug
 WHERE organization_id = '10000000-0000-0000-0000-000000000001';

INSERT INTO ingredient (id, organization_id, name, sku, base_unit, reorder_threshold)
VALUES
    ('90000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Green Tea', 'TEA-GREEN', 'GRAM', 500),
    ('90000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Peach Syrup', 'SYRUP-PEACH', 'MILLILITER', 1000),
    ('90000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Hojicha Powder', 'HOJICHA', 'GRAM', 300),
    ('90000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Mango Puree', 'PUREE-MANGO', 'MILLILITER', 1000),
    ('90000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'Passionfruit Syrup', 'SYRUP-PASSIONFRUIT', 'MILLILITER', 1000);

INSERT INTO recipe (id, organization_id, name, description)
VALUES
    ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Honey Peach Green Tea', 'Green tea brightened with peach and a light honeyed finish.'),
    ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Roasted Hojicha Latte', 'Roasted Japanese green tea blended with fresh milk.'),
    ('40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Mango Passionfruit Tea', 'Tropical mango and passionfruit over fragrant green tea.');

INSERT INTO recipe_version (id, organization_id, recipe_id, version_number, status)
VALUES
    ('92000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', 1, 'DRAFT'),
    ('92000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006', 1, 'DRAFT'),
    ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000007', 1, 'DRAFT');

INSERT INTO recipe_component (organization_id, recipe_version_id, ingredient_id, quantity)
VALUES
    ('10000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000010', 8),
    ('10000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000011', 30),
    ('10000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000012', 6),
    ('10000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000005', 220),
    ('10000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000010', 8),
    ('10000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000013', 35),
    ('10000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000014', 20);

UPDATE recipe_version
   SET status = 'PUBLISHED', published_at = now(), version = version + 1
 WHERE id IN (
    '92000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000003'
 );

INSERT INTO menu_product (
    id, organization_id, public_slug, name, description, category, artwork_key, display_order
)
VALUES
    ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'honey-peach-green-tea', 'Honey Peach Green Tea', 'Fragrant green tea with ripe peach and a light honeyed finish.', 'Fruit tea', 'honey-peach-green-tea', 4),
    ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'roasted-hojicha-latte', 'Roasted Hojicha Latte', 'Toasty hojicha and fresh milk with a smooth, nutty finish.', 'Tea latte', 'roasted-hojicha-latte', 5),
    ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'mango-passionfruit-tea', 'Mango Passionfruit Tea', 'Juicy mango and tangy passionfruit over fragrant green tea.', 'Fruit tea', 'mango-passionfruit-tea', 6);

INSERT INTO menu_variant (
    id, organization_id, menu_product_id, name, display_order, is_default
)
VALUES
    ('50000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'Small', 0, false),
    ('50000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'Medium', 1, true),
    ('50000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'Large', 2, false),
    ('50000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'Small', 0, false),
    ('50000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'Medium', 1, true),
    ('50000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'Large', 2, false),
    ('50000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 'Small', 0, false),
    ('50000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 'Medium', 1, true),
    ('50000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 'Large', 2, false);

INSERT INTO menu_variant_option_choice (
    id, organization_id, menu_variant_id, option_choice_id, price_delta_minor
)
SELECT gen_random_uuid(), variant.organization_id, variant.id, choice.id,
       CASE WHEN choice.option_group_id = '70000000-0000-0000-0000-000000000003' THEN 60 ELSE 0 END
  FROM menu_variant variant
 CROSS JOIN option_choice choice
 WHERE variant.id IN (
    '50000000-0000-0000-0000-000000000013', '50000000-0000-0000-0000-000000000014',
    '50000000-0000-0000-0000-000000000015', '50000000-0000-0000-0000-000000000016',
    '50000000-0000-0000-0000-000000000017', '50000000-0000-0000-0000-000000000018',
    '50000000-0000-0000-0000-000000000019', '50000000-0000-0000-0000-000000000020',
    '50000000-0000-0000-0000-000000000021'
 )
   AND choice.organization_id = variant.organization_id;

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
 WHERE variant_choice.menu_variant_id IN (
    '50000000-0000-0000-0000-000000000013', '50000000-0000-0000-0000-000000000014',
    '50000000-0000-0000-0000-000000000015', '50000000-0000-0000-0000-000000000016',
    '50000000-0000-0000-0000-000000000017', '50000000-0000-0000-0000-000000000018',
    '50000000-0000-0000-0000-000000000019', '50000000-0000-0000-0000-000000000020',
    '50000000-0000-0000-0000-000000000021'
 )
   AND choice.id IN (
    '71000000-0000-0000-0000-000000000010',
    '71000000-0000-0000-0000-000000000011',
    '71000000-0000-0000-0000-000000000012'
 );

INSERT INTO menu_variant_offering (
    id, organization_id, location_id, menu_variant_id, recipe_version_id,
    price_minor, currency_code, available
)
SELECT gen_random_uuid(), variant.organization_id, location.id, variant.id, recipe_version.id,
       CASE product.public_slug
           WHEN 'honey-peach-green-tea' THEN 620 + variant.display_order * 50 + CASE WHEN variant.display_order = 2 THEN 30 ELSE 0 END
           WHEN 'roasted-hojicha-latte' THEN 650 + variant.display_order * 50 + CASE WHEN variant.display_order = 2 THEN 30 ELSE 0 END
           WHEN 'mango-passionfruit-tea' THEN 630 + variant.display_order * 50 + CASE WHEN variant.display_order = 2 THEN 30 ELSE 0 END
       END,
       location.currency_code,
       true
  FROM menu_variant variant
  JOIN menu_product product ON product.id = variant.menu_product_id
  JOIN recipe ON recipe.organization_id = product.organization_id AND recipe.name = product.name
  JOIN recipe_version ON recipe_version.recipe_id = recipe.id AND recipe_version.status = 'PUBLISHED'
  JOIN location ON location.id = '20000000-0000-0000-0000-000000000001'
 WHERE product.id IN (
    '30000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000007'
 );

INSERT INTO menu_variant_offering (
    id, organization_id, location_id, menu_variant_id, recipe_version_id,
    price_minor, currency_code, available
)
SELECT gen_random_uuid(), variant.organization_id, location.id, variant.id, recipe_version.id,
       CASE product.public_slug
           WHEN 'moonlit-milk-tea' THEN 590
           WHEN 'sunberry-oolong' THEN 590
           WHEN 'mossy-matcha' THEN 600
           WHEN 'cloudberry-taro' THEN 620
           WHEN 'honey-peach-green-tea' THEN 600
           WHEN 'roasted-hojicha-latte' THEN 630
           WHEN 'mango-passionfruit-tea' THEN 610
       END + variant.display_order * 50 + CASE WHEN variant.display_order = 2 THEN 30 ELSE 0 END,
       location.currency_code,
       true
  FROM menu_variant variant
  JOIN menu_product product ON product.id = variant.menu_product_id
  JOIN recipe ON recipe.organization_id = product.organization_id AND recipe.name = product.name
  JOIN LATERAL (
      SELECT version.id
        FROM recipe_version version
       WHERE version.recipe_id = recipe.id AND version.status = 'PUBLISHED'
       ORDER BY version.version_number DESC
       LIMIT 1
  ) recipe_version ON true
  JOIN location ON location.id = '20000000-0000-0000-0000-000000000002'
 WHERE product.organization_id = '10000000-0000-0000-0000-000000000001';
