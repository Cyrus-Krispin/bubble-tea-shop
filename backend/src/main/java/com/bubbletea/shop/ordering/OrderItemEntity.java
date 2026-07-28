package com.bubbletea.shop.ordering;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_item")
public class OrderItemEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "customer_order_id", nullable = false)
    UUID customerOrderId;

    @Column(name = "menu_variant_id")
    UUID menuVariantId;

    @Column(name = "product_name_snapshot", nullable = false, length = 160)
    String productNameSnapshot;

    @Column(name = "variant_name_snapshot", nullable = false, length = 100)
    String variantNameSnapshot;

    @Column(nullable = false)
    int quantity;

    @Column(name = "unit_price_minor", nullable = false)
    long unitPriceMinor;

    @Column(name = "line_total_minor", nullable = false)
    long lineTotalMinor;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected OrderItemEntity() {
    }
}

