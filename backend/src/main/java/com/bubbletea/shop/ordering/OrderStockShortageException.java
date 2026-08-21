package com.bubbletea.shop.ordering;

import java.util.List;
import java.util.UUID;

public class OrderStockShortageException extends RuntimeException {
    private final List<Shortage> shortages;

    OrderStockShortageException(List<Shortage> shortages) {
        super("Order cannot be completed because stock is insufficient");
        this.shortages = List.copyOf(shortages);
    }

    public List<Shortage> shortages() {
        return shortages;
    }

    public record Shortage(UUID ingredientId, String ingredientName, String baseUnit,
                           String requiredQuantity, String availableQuantity) { }
}
