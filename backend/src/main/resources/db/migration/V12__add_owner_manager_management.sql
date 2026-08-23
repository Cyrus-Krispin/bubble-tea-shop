ALTER TABLE account
    ADD COLUMN email varchar(254),
    ADD CONSTRAINT ck_account_email_normalized
        CHECK (email IS NULL OR (email = lower(btrim(email)) AND position('@' IN email) > 1));

CREATE UNIQUE INDEX uq_account_email_ci
    ON account (lower(email))
    WHERE email IS NOT NULL;

ALTER TABLE organization_membership
    ADD COLUMN version bigint NOT NULL DEFAULT 0,
    ADD CONSTRAINT ck_membership_version_non_negative CHECK (version >= 0);

CREATE TABLE staff_access_change (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organization(id),
    membership_id uuid NOT NULL,
    action varchar(30) NOT NULL,
    actor_account_id uuid NOT NULL REFERENCES account(id),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_staff_access_change_membership
        FOREIGN KEY (membership_id, organization_id)
        REFERENCES organization_membership(id, organization_id),
    CONSTRAINT ck_staff_access_change_action
        CHECK (action IN ('CREATE', 'REACTIVATE', 'UPDATE_ASSIGNMENTS', 'DEACTIVATE'))
);

CREATE INDEX idx_staff_access_change_timeline
    ON staff_access_change (organization_id, occurred_at DESC, id DESC);

CREATE FUNCTION reject_staff_access_change_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'staff access changes are immutable';
END;
$$;

CREATE TRIGGER staff_access_change_is_immutable
BEFORE UPDATE OR DELETE ON staff_access_change
FOR EACH ROW EXECUTE FUNCTION reject_staff_access_change_mutation();
