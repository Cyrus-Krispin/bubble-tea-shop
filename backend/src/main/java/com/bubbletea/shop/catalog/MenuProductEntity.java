package com.bubbletea.shop.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "menu_product")
public class MenuProductEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(nullable = false, length = 160)
    String name;

    @Column(columnDefinition = "text")
    String description;

    @Column(name = "image_url", columnDefinition = "text")
    String imageUrl;

    @Column(name = "archived_at")
    Instant archivedAt;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected MenuProductEntity() {
    }
}

