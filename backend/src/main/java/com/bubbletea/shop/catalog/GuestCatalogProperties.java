package com.bubbletea.shop.catalog;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.catalog")
public record GuestCatalogProperties(String guestLocationSlug) {
    public GuestCatalogProperties {
        if (guestLocationSlug == null || guestLocationSlug.isBlank()) {
            throw new IllegalArgumentException("app.catalog.guest-location-slug must be configured");
        }
    }
}
