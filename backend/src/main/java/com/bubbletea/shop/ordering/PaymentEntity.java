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
@Table(name = "payment")
public class PaymentEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "customer_order_id", nullable = false)
    UUID customerOrderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    Status status;

    @Column(name = "amount_minor", nullable = false)
    long amountMinor;

    @Column(name = "currency_code", nullable = false, length = 3)
    String currencyCode;

    @Column(name = "external_reference")
    String externalReference;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected PaymentEntity() {
    }

    public enum Status {
        PENDING, PAID, FAILED, REFUNDED
    }
}
