DELETE FROM menu_variant_offering offering
USING menu_variant variant, menu_product product
WHERE offering.menu_variant_id = variant.id
  AND variant.menu_product_id = product.id
  AND (
      (offering.location_id = '20000000-0000-0000-0000-000000000001'
       AND product.public_slug = 'mango-passionfruit-tea')
      OR
      (offering.location_id = '20000000-0000-0000-0000-000000000002'
       AND product.public_slug IN ('sunberry-oolong', 'roasted-hojicha-latte'))
  );

INSERT INTO inventory_movement (
    organization_id, location_id, ingredient_id, movement_type,
    quantity_delta, source_reference, note
)
SELECT ingredient.organization_id, location.id, ingredient.id, 'OPENING',
       10000, 'seed-opening-stock', 'Initial local catalog stock'
  FROM ingredient
 CROSS JOIN location
 WHERE ingredient.organization_id = '10000000-0000-0000-0000-000000000001'
   AND location.organization_id = ingredient.organization_id
   AND location.id IN (
       '20000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000002'
   )
   AND NOT EXISTS (
       SELECT 1
         FROM inventory_balance balance
        WHERE balance.location_id = location.id
          AND balance.ingredient_id = ingredient.id
   );

INSERT INTO inventory_balance (
    organization_id, location_id, ingredient_id, quantity
)
SELECT ingredient.organization_id, location.id, ingredient.id, 10000
  FROM ingredient
 CROSS JOIN location
 WHERE ingredient.organization_id = '10000000-0000-0000-0000-000000000001'
   AND location.organization_id = ingredient.organization_id
   AND location.id IN (
       '20000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000002'
   )
ON CONFLICT (location_id, ingredient_id) DO NOTHING;
