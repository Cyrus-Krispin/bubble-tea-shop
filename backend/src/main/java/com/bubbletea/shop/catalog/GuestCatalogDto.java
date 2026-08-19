package com.bubbletea.shop.catalog;

import java.util.List;
import java.util.UUID;

public final class GuestCatalogDto {
    private GuestCatalogDto() {
    }

    public record Money(long amountMinor, String currency) {
    }

    public record Location(UUID id, String slug, String name, String currency) {
    }

    public record Menu(Location location, List<ProductSummary> products) {
    }

    public record ProductSummary(
        UUID id,
        String slug,
        String name,
        String description,
        String category,
        String artworkKey,
        Money startingPrice,
        boolean available
    ) {
    }

    public record Product(
        UUID id,
        String slug,
        String name,
        String description,
        String category,
        String artworkKey,
        List<Variant> variants
    ) {
    }

    public record Variant(
        UUID id,
        String name,
        int displayOrder,
        boolean isDefault,
        boolean available,
        Money price,
        List<OptionGroup> optionGroups
    ) {
    }

    public record OptionGroup(
        UUID id,
        String name,
        int minimumSelections,
        int maximumSelections,
        int displayOrder,
        List<OptionChoice> choices
    ) {
    }

    public record OptionChoice(
        UUID id,
        String name,
        int displayOrder,
        boolean isDefault,
        Money priceDelta
    ) {
    }
}
