package com.bubbletea.shop.ordering;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_status_history")
public class OrderStatusHistoryEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "customer_order_id", nullable = false)
    UUID customerOrderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    OrderStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 20)
    OrderStatus toStatus;

    @Column(name = "changed_by_account_id")
    UUID changedByAccountId;

    @Column(name = "changed_at", nullable = false)
    Instant changedAt;

    protected OrderStatusHistoryEntity() {
    }
}

