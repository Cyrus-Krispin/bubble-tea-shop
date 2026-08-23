package com.bubbletea.shop.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "menu_variant_offering")
public class MenuVariantOfferingEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "location_id", nullable = false)
    UUID locationId;

    @Column(name = "menu_variant_id", nullable = false)
    UUID menuVariantId;

    @Column(name = "recipe_version_id", nullable = false)
    UUID recipeVersionId;

    @Column(name = "price_minor", nullable = false)
    long priceMinor;

    @Column(name = "currency_code", nullable = false, length = 3)
    String currencyCode;

    @Column(nullable = false)
    boolean available;

    @Version
    @Column(nullable = false)
    long version;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected MenuVariantOfferingEntity() {
    }
}
