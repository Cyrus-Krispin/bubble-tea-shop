CREATE TABLE cash_expense (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    currency_code varchar(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
    amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 100000000),
    description varchar(240) NOT NULL CHECK (btrim(description) <> ''),
    paid_at timestamptz NOT NULL DEFAULT now(),
    recorded_by_account_id uuid NOT NULL REFERENCES account(id),
    request_key uuid NOT NULL,
    UNIQUE (location_id, request_key),
    UNIQUE (id, organization_id, location_id),
    FOREIGN KEY (location_id, organization_id) REFERENCES location(id, organization_id)
);
CREATE INDEX ix_cash_expense_location_paid ON cash_expense (location_id, paid_at DESC, id DESC);
CREATE TABLE cash_expense_void (
    expense_id uuid PRIMARY KEY,
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    recorded_by_account_id uuid NOT NULL REFERENCES account(id),
    reason varchar(240) NOT NULL CHECK (btrim(reason) <> ''),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (expense_id, organization_id, location_id) REFERENCES cash_expense(id, organization_id, location_id)
);
CREATE TRIGGER cash_expense_is_immutable BEFORE UPDATE OR DELETE ON cash_expense
    FOR EACH ROW EXECUTE FUNCTION reject_order_audit_mutation();
CREATE TRIGGER cash_expense_void_is_immutable BEFORE UPDATE OR DELETE ON cash_expense_void
    FOR EACH ROW EXECUTE FUNCTION reject_order_audit_mutation();
CREATE INDEX ix_payment_paid_report ON payment (organization_id, paid_at, customer_order_id) WHERE status = 'PAID';
