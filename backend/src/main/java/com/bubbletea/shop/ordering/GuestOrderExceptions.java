package com.bubbletea.shop.ordering;

final class InvalidGuestOrderException extends RuntimeException { }

final class GuestOrderCatalogChangedException extends RuntimeException { }

final class GuestOrderIdempotencyConflictException extends RuntimeException { }

final class GuestOrderUnavailableException extends RuntimeException {
    GuestOrderUnavailableException(Throwable cause) {
        super(cause);
    }
}

final class CustomerAccountDisabledException extends RuntimeException { }
