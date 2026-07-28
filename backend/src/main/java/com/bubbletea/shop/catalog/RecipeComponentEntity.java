package com.bubbletea.shop.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@IdClass(RecipeComponentId.class)
@Table(name = "recipe_component")
public class RecipeComponentEntity {
    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Id
    @Column(name = "recipe_version_id")
    UUID recipeVersionId;

    @Id
    @Column(name = "ingredient_id")
    UUID ingredientId;

    @Column(nullable = false, precision = 19, scale = 6)
    BigDecimal quantity;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected RecipeComponentEntity() {
    }
}

