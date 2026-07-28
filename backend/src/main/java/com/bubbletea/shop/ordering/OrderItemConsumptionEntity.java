package com.bubbletea.shop.ordering;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_item_consumption")
public class OrderItemConsumptionEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "order_item_id", nullable = false)
    UUID orderItemId;

    @Column(name = "ingredient_id", nullable = false)
    UUID ingredientId;

    @Column(nullable = false, precision = 19, scale = 6)
    BigDecimal quantity;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected OrderItemConsumptionEntity() {
    }
}

