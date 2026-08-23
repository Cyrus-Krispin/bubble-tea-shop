CREATE UNIQUE INDEX uq_inventory_opening_location_ingredient
    ON inventory_movement (location_id, ingredient_id)
    WHERE movement_type = 'OPENING';

CREATE INDEX idx_inventory_movement_location_type_time
    ON inventory_movement (location_id, movement_type, created_at DESC, id DESC);
