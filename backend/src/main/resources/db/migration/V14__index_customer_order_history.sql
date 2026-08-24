CREATE INDEX idx_customer_order_customer_time
    ON customer_order (customer_account_id, created_at DESC, id DESC)
    WHERE customer_account_id IS NOT NULL;
