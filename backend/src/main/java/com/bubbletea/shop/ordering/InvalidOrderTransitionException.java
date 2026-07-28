package com.bubbletea.shop.ordering;

import java.util.UUID;

public class InvalidOrderTransitionException extends RuntimeException {
    public InvalidOrderTransitionException(UUID orderId, OrderStatus status) {
        super("Order " + orderId + " cannot be completed from status " + status);
    }
}

