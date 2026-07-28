package com.bubbletea.shop.inventory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Immutable
@Table(name = "inventory_movement")
public class InventoryMovementEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "location_id", nullable = false)
    UUID locationId;

    @Column(name = "ingredient_id", nullable = false)
    UUID ingredientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, length = 20)
    InventoryMovementType movementType;

    @Column(name = "quantity_delta", nullable = false, precision = 19, scale = 6)
    BigDecimal quantityDelta;

    @Column(name = "customer_order_id")
    UUID customerOrderId;

    @Column(name = "actor_account_id")
    UUID actorAccountId;

    @Column(name = "source_reference", length = 120)
    String sourceReference;

    @Column(columnDefinition = "text")
    String note;

    @Column(name = "total_cost_minor")
    Long totalCostMinor;

    @Column(name = "currency_code", length = 3)
    String currencyCode;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected InventoryMovementEntity() {
    }
}
