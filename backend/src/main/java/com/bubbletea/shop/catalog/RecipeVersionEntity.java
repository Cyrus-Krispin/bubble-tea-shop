package com.bubbletea.shop.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recipe_version")
public class RecipeVersionEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "recipe_id", nullable = false)
    UUID recipeId;

    @Column(name = "version_number", nullable = false)
    int versionNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    Status status;

    @Column(name = "created_by_account_id")
    UUID createdByAccountId;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    @Column(name = "published_at")
    Instant publishedAt;

    protected RecipeVersionEntity() {
    }

    public enum Status {
        DRAFT, PUBLISHED, RETIRED
    }
}

