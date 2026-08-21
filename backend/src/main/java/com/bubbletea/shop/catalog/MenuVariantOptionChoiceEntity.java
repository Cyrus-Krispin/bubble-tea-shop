package com.bubbletea.shop.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "menu_variant_option_choice")
public class MenuVariantOptionChoiceEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "menu_variant_id", nullable = false)
    UUID menuVariantId;

    @Column(name = "option_choice_id", nullable = false)
    UUID optionChoiceId;

    @Column(name = "price_delta_minor", nullable = false)
    long priceDeltaMinor;

    @Column(nullable = false)
    boolean enabled;

    @Version
    @Column(nullable = false)
    long version;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected MenuVariantOptionChoiceEntity() {
    }
}
