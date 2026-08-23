package com.bubbletea.shop.ordering;

import java.util.UUID;

public class InvalidOrderStateException extends RuntimeException {
    public InvalidOrderStateException(UUID orderId) {
        super("Order data is not valid for completion: " + orderId);
    }
}
