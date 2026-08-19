package com.bubbletea.shop.catalog;

class GuestCatalogNotFoundException extends RuntimeException {
    private final String code;

    GuestCatalogNotFoundException(String code, String message) {
        super(message);
        this.code = code;
    }

    String code() {
        return code;
    }
}
