package com.bubbletea.shop.inventory;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public class InsufficientStockException extends RuntimeException {
    private final Map<UUID, StockShortage> shortages;

    public InsufficientStockException(Map<UUID, StockShortage> shortages) {
        super("Insufficient stock for " + shortages.size() + " ingredient(s)");
        this.shortages = Collections.unmodifiableMap(new LinkedHashMap<>(shortages));
    }

    public Map<UUID, StockShortage> shortages() {
        return shortages;
    }

    public record StockShortage(BigDecimal required, BigDecimal available) {
    }
}

