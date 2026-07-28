package com.bubbletea.shop.ordering;

import java.util.UUID;

public class OrderNotFoundException extends RuntimeException {
    public OrderNotFoundException(UUID orderId) {
        super("Order " + orderId + " was not found");
    }
}

