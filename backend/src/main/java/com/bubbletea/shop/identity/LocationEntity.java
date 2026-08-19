package com.bubbletea.shop.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "location")
public class LocationEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "public_slug", length = 120)
    String publicSlug;

    @Column(nullable = false, length = 160)
    String name;

    @Column(nullable = false, length = 64)
    String timezone;

    @Column(name = "default_locale", nullable = false, length = 16)
    String defaultLocale;

    @Column(name = "currency_code", nullable = false, length = 3)
    String currencyCode;

    @Column(nullable = false)
    boolean active;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected LocationEntity() {
    }
}
