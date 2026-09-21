ALTER TABLE inventory_movement ADD CONSTRAINT uq_inventory_movement_location_scope UNIQUE (id, organization_id, location_id);

CREATE TABLE inventory_movement_request (
    location_id uuid NOT NULL,
    request_key uuid NOT NULL,
    organization_id uuid NOT NULL,
    actor_account_id uuid NOT NULL REFERENCES account(id),
    request_fingerprint varchar(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    inventory_movement_id uuid NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (location_id, request_key),
    FOREIGN KEY (location_id, organization_id) REFERENCES location(id, organization_id),
    FOREIGN KEY (inventory_movement_id, organization_id, location_id)
        REFERENCES inventory_movement(id, organization_id, location_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TRIGGER inventory_movement_request_immutable BEFORE UPDATE OR DELETE ON inventory_movement_request
    FOR EACH ROW EXECUTE FUNCTION reject_order_audit_mutation();
