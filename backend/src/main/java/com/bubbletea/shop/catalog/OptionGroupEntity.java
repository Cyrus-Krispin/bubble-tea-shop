package com.bubbletea.shop.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "option_group")
public class OptionGroupEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(nullable = false, length = 120)
    String name;

    @Column(name = "minimum_selections", nullable = false)
    int minimumSelections;

    @Column(name = "maximum_selections", nullable = false)
    int maximumSelections;

    @Column(name = "display_order", nullable = false)
    int displayOrder;

    @Version
    @Column(nullable = false)
    long version;

    @Column(name = "archived_at")
    Instant archivedAt;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected OptionGroupEntity() {
    }
}
