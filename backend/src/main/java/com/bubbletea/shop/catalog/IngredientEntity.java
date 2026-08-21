package com.bubbletea.shop.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ingredient")
public class IngredientEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(nullable = false, length = 160)
    String name;

    @Column(length = 80)
    String sku;

    @Enumerated(EnumType.STRING)
    @Column(name = "base_unit", nullable = false, length = 20)
    BaseUnit baseUnit;

    @Column(name = "reorder_threshold", precision = 19, scale = 6)
    BigDecimal reorderThreshold;

    @Column(name = "archived_at")
    Instant archivedAt;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    @Column(nullable = false)
    long version;

    protected IngredientEntity() {
    }
}
