package com.bubbletea.shop.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "option_choice_ingredient_effect")
public class OptionChoiceIngredientEffectEntity {
    @Id
    UUID id;

    @Column(name = "organization_id", nullable = false)
    UUID organizationId;

    @Column(name = "menu_variant_option_choice_id", nullable = false)
    UUID menuVariantOptionChoiceId;

    @Column(name = "ingredient_id", nullable = false)
    UUID ingredientId;

    @Column(name = "quantity_delta", nullable = false, precision = 19, scale = 6)
    BigDecimal quantityDelta;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected OptionChoiceIngredientEffectEntity() {
    }
}

