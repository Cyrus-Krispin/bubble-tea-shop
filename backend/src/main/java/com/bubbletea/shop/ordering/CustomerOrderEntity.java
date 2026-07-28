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
@Table(name = "customer_order")
public class CustomerOrderEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "location_id", nullable = false)
    UUID locationId;

    @Column(name = "customer_account_id")
    UUID customerAccountId;

    @Column(name = "public_order_number", nullable = false, length = 32)
    String publicOrderNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    OrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20)
    PaymentMethod paymentMethod;

    @Column(name = "currency_code", nullable = false, length = 3)
    String currencyCode;

    @Column(name = "subtotal_minor", nullable = false)
    long subtotalMinor;

    @Column(name = "total_minor", nullable = false)
    long totalMinor;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "completed_at")
    Instant completedAt;

    @Column(name = "cancelled_at")
    Instant cancelledAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected CustomerOrderEntity() {
    }
}
