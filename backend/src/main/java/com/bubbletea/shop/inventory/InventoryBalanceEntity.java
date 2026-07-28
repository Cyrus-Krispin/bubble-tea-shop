package com.bubbletea.shop.inventory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@IdClass(InventoryBalanceId.class)
@Table(name = "inventory_balance")
public class InventoryBalanceEntity {
    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Id
    @Column(name = "location_id")
    UUID locationId;

    @Id
    @Column(name = "ingredient_id")
    UUID ingredientId;

    @Column(nullable = false, precision = 19, scale = 6)
    BigDecimal quantity;

    @Version
    @Column(nullable = false)
    long version;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected InventoryBalanceEntity() {
    }
}

