CREATE INDEX idx_catalog_change_timeline
    ON catalog_change (organization_id, occurred_at DESC, id DESC);

CREATE INDEX idx_order_status_history_timeline
    ON order_status_history (organization_id, changed_at DESC, id DESC);

CREATE FUNCTION reject_catalog_change_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'catalog changes are immutable';
END;
$$;

CREATE TRIGGER catalog_change_is_immutable
BEFORE UPDATE OR DELETE ON catalog_change
FOR EACH ROW EXECUTE FUNCTION reject_catalog_change_mutation();
