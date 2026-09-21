ALTER TABLE customer_order ADD CONSTRAINT uq_order_location_scope UNIQUE (id, organization_id, location_id);

CREATE TABLE card_checkout (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_order_id uuid NOT NULL UNIQUE REFERENCES customer_order(id),
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    state varchar(30) NOT NULL DEFAULT 'CREATING' CHECK (state IN ('CREATING','OPEN','PAID','EXPIRED','REFUND_PENDING','REFUNDED','FAILED','REVIEW_REQUIRED')),
    provider_session_id varchar(255) UNIQUE,
    provider_payment_intent_id varchar(255) UNIQUE,
    provider_refund_id varchar(255) UNIQUE,
    checkout_url text,
    expires_at timestamptz NOT NULL,
    cancel_requested boolean NOT NULL DEFAULT false,
    cancel_actor_id uuid REFERENCES account(id),
    lease_until timestamptz,
    lease_token uuid,
    provider_session_hint varchar(255),
    creation_attempts integer NOT NULL DEFAULT 0,
    reconcile_requested boolean NOT NULL DEFAULT true,
    reconcile_version bigint NOT NULL DEFAULT 0,
    last_checked_at timestamptz,
    last_error_code varchar(80),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (customer_order_id, organization_id, location_id) REFERENCES customer_order(id, organization_id, location_id),
    FOREIGN KEY (location_id, organization_id) REFERENCES location(id, organization_id)
);
CREATE INDEX ix_card_checkout_reconcile ON card_checkout (last_checked_at NULLS FIRST)
    WHERE state IN ('CREATING','OPEN','REFUND_PENDING','REVIEW_REQUIRED');

CREATE TABLE inventory_reservation (
    customer_order_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric(19,6) NOT NULL CHECK (quantity > 0),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    released_at timestamptz,
    PRIMARY KEY (customer_order_id, ingredient_id),
    FOREIGN KEY (customer_order_id, organization_id, location_id) REFERENCES customer_order(id, organization_id, location_id),
    FOREIGN KEY (location_id, organization_id) REFERENCES location(id, organization_id),
    FOREIGN KEY (ingredient_id, organization_id) REFERENCES ingredient(id, organization_id),
    CHECK (active = (released_at IS NULL))
);
CREATE INDEX ix_inventory_reservation_active ON inventory_reservation (location_id, ingredient_id) WHERE active;

CREATE TABLE card_refund (
    provider_refund_id varchar(255) PRIMARY KEY,
    customer_order_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    currency_code varchar(3) NOT NULL,
    amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    refunded_at timestamptz NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (customer_order_id, organization_id, location_id) REFERENCES customer_order(id, organization_id, location_id),
    FOREIGN KEY (location_id, organization_id) REFERENCES location(id, organization_id)
);
CREATE INDEX ix_card_refund_report ON card_refund (location_id, refunded_at);
CREATE TRIGGER card_refund_immutable BEFORE UPDATE OR DELETE ON card_refund
    FOR EACH ROW EXECUTE FUNCTION reject_order_audit_mutation();

ALTER TABLE payment DROP CONSTRAINT ck_payment_paid_timestamp;
ALTER TABLE payment ADD CONSTRAINT ck_payment_paid_timestamp CHECK (
    (status = 'PAID' AND paid_at IS NOT NULL) OR status = 'REFUNDED'
    OR (status NOT IN ('PAID','REFUNDED') AND paid_at IS NULL)
);
