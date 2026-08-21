ALTER TABLE payment
    ADD COLUMN paid_at timestamptz,
    ADD COLUMN recorded_by_account_id uuid REFERENCES account(id);

UPDATE payment payment_record
   SET status = 'PAID',
       paid_at = COALESCE(customer_order.completed_at, payment_record.updated_at),
       recorded_by_account_id = completed_history.changed_by_account_id,
       updated_at = COALESCE(customer_order.completed_at, payment_record.updated_at)
  FROM customer_order
  JOIN LATERAL (
      SELECT history.changed_by_account_id
        FROM order_status_history history
       WHERE history.customer_order_id = customer_order.id
         AND history.to_status = 'COMPLETED'
       ORDER BY history.changed_at DESC, history.id DESC
       LIMIT 1
  ) completed_history ON true
 WHERE payment_record.customer_order_id = customer_order.id
   AND customer_order.status = 'COMPLETED'
   AND payment_record.method = 'CASH';

UPDATE payment payment_record
   SET paid_at = COALESCE(payment_record.paid_at, payment_record.updated_at)
 WHERE payment_record.status = 'PAID';

ALTER TABLE payment
    ADD CONSTRAINT uq_payment_customer_order UNIQUE (customer_order_id),
    ADD CONSTRAINT ck_payment_paid_timestamp CHECK (
        (status = 'PAID' AND paid_at IS NOT NULL)
        OR (status <> 'PAID' AND paid_at IS NULL)
    ),
    ADD CONSTRAINT ck_payment_cash_paid_actor CHECK (
        status <> 'PAID' OR method <> 'CASH' OR recorded_by_account_id IS NOT NULL
    );
