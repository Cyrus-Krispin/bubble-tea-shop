package com.bubbletea.shop.inventory;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class InventoryBalanceId implements Serializable {
    UUID locationId;
    UUID ingredientId;

    public InventoryBalanceId() {
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof InventoryBalanceId that)) return false;
        return Objects.equals(locationId, that.locationId)
            && Objects.equals(ingredientId, that.ingredientId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(locationId, ingredientId);
    }
}

