package com.bubbletea.shop.catalog;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class RecipeComponentId implements Serializable {
    UUID recipeVersionId;
    UUID ingredientId;

    public RecipeComponentId() {
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof RecipeComponentId that)) return false;
        return Objects.equals(recipeVersionId, that.recipeVersionId)
            && Objects.equals(ingredientId, that.ingredientId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(recipeVersionId, ingredientId);
    }
}

