package com.bubbletea.shop.catalog;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class GuestCatalogService {
    private final JdbcTemplate jdbc;

    public GuestCatalogService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public GuestCatalogDto.Menu loadMenu(String locationSlug) {
        LocationRecord location = findLocation(locationSlug);
        List<GuestCatalogDto.ProductSummary> products = jdbc.query("""
            SELECT product.id,
                   product.public_slug,
                   product.name,
                   product.description,
                   product.category,
                   product.artwork_key,
                   MIN(offering.price_minor) AS starting_price_minor,
                   bool_or(offering.available) AS available
              FROM menu_product product
              JOIN menu_variant variant
                ON variant.menu_product_id = product.id
               AND variant.organization_id = product.organization_id
               AND variant.archived_at IS NULL
              JOIN menu_variant_offering offering
                ON offering.menu_variant_id = variant.id
               AND offering.organization_id = variant.organization_id
             WHERE product.organization_id = ?
               AND product.public_slug IS NOT NULL
               AND product.archived_at IS NULL
               AND offering.location_id = ?
             GROUP BY product.id
             ORDER BY product.display_order, product.name
            """,
            (rs, rowNum) -> new GuestCatalogDto.ProductSummary(
                rs.getObject("id", UUID.class),
                rs.getString("public_slug"),
                rs.getString("name"),
                rs.getString("description"),
                rs.getString("category"),
                rs.getString("artwork_key"),
                new GuestCatalogDto.Money(
                    rs.getLong("starting_price_minor"),
                    location.currency()),
                rs.getBoolean("available")),
            location.organizationId(),
            location.id());

        return new GuestCatalogDto.Menu(location.toDto(), List.copyOf(products));
    }

    @Transactional(readOnly = true)
    public GuestCatalogDto.Product loadProduct(String locationSlug, String productSlug) {
        LocationRecord location = findLocation(locationSlug);
        ProductRecord product = jdbc.query("""
                SELECT DISTINCT product.id,
                       product.public_slug,
                       product.name,
                       product.description,
                       product.category,
                       product.artwork_key
                  FROM menu_product product
                  JOIN menu_variant variant
                    ON variant.menu_product_id = product.id
                   AND variant.organization_id = product.organization_id
                   AND variant.archived_at IS NULL
                  JOIN menu_variant_offering offering
                    ON offering.menu_variant_id = variant.id
                   AND offering.organization_id = variant.organization_id
                 WHERE product.organization_id = ?
                   AND product.public_slug = ?
                   AND product.archived_at IS NULL
                   AND offering.location_id = ?
                """,
                (rs, rowNum) -> new ProductRecord(
                    rs.getObject("id", UUID.class),
                    rs.getString("public_slug"),
                    rs.getString("name"),
                    rs.getString("description"),
                    rs.getString("category"),
                    rs.getString("artwork_key")),
                location.organizationId(),
                productSlug,
                location.id())
            .stream()
            .findFirst()
            .orElseThrow(() -> new GuestCatalogNotFoundException(
                "CATALOG_PRODUCT_NOT_FOUND",
                "The requested menu product is not available at this location."));

        List<VariantRecord> variants = jdbc.query("""
            SELECT variant.id,
                   variant.name,
                   variant.display_order,
                   variant.is_default,
                   offering.available,
                   offering.price_minor
              FROM menu_variant variant
              JOIN menu_variant_offering offering
                ON offering.menu_variant_id = variant.id
               AND offering.organization_id = variant.organization_id
             WHERE variant.organization_id = ?
               AND variant.menu_product_id = ?
               AND variant.archived_at IS NULL
               AND offering.location_id = ?
             ORDER BY variant.display_order, variant.name
            """,
            (rs, rowNum) -> new VariantRecord(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getInt("display_order"),
                rs.getBoolean("is_default"),
                rs.getBoolean("available"),
                rs.getLong("price_minor")),
            location.organizationId(),
            product.id(),
            location.id());

        Map<UUID, LinkedHashMap<UUID, OptionGroupBuilder>> groupsByVariant = loadOptionGroups(
            location.organizationId(),
            product.id(),
            location.currency());

        List<GuestCatalogDto.Variant> variantDtos = variants.stream()
            .map(variant -> new GuestCatalogDto.Variant(
                variant.id(),
                variant.name(),
                variant.displayOrder(),
                variant.isDefault(),
                variant.available(),
                new GuestCatalogDto.Money(variant.priceMinor(), location.currency()),
                groupsByVariant.getOrDefault(variant.id(), new LinkedHashMap<>())
                    .values()
                    .stream()
                    .map(OptionGroupBuilder::toDto)
                    .toList()))
            .toList();

        return new GuestCatalogDto.Product(
            product.id(),
            product.slug(),
            product.name(),
            product.description(),
            product.category(),
            product.artworkKey(),
            variantDtos);
    }

    private LocationRecord findLocation(String locationSlug) {
        return jdbc.query("""
                SELECT id, organization_id, public_slug, name, currency_code
                  FROM location
                 WHERE public_slug = ?
                   AND active
                """,
                (rs, rowNum) -> new LocationRecord(
                    rs.getObject("id", UUID.class),
                    rs.getObject("organization_id", UUID.class),
                    rs.getString("public_slug"),
                    rs.getString("name"),
                    rs.getString("currency_code")),
                locationSlug)
            .stream()
            .findFirst()
            .orElseThrow(() -> new GuestCatalogNotFoundException(
                "CATALOG_NOT_FOUND",
                "The requested shop menu was not found."));
    }

    private Map<UUID, LinkedHashMap<UUID, OptionGroupBuilder>> loadOptionGroups(
        UUID organizationId,
        UUID productId,
        String currency
    ) {
        Map<UUID, LinkedHashMap<UUID, OptionGroupBuilder>> result = new LinkedHashMap<>();
        jdbc.query("""
            SELECT variant.id AS variant_id,
                   option_group.id AS group_id,
                   option_group.name AS group_name,
                   option_group.minimum_selections,
                   option_group.maximum_selections,
                   option_group.display_order AS group_display_order,
                   option_choice.id AS choice_id,
                   option_choice.name AS choice_name,
                   option_choice.display_order AS choice_display_order,
                   variant_choice.price_delta_minor
              FROM menu_variant variant
              JOIN menu_variant_option_choice variant_choice
                ON variant_choice.menu_variant_id = variant.id
               AND variant_choice.organization_id = variant.organization_id
               AND variant_choice.enabled
              JOIN option_choice
                ON option_choice.id = variant_choice.option_choice_id
               AND option_choice.organization_id = variant_choice.organization_id
               AND option_choice.archived_at IS NULL
              JOIN option_group
                ON option_group.id = option_choice.option_group_id
               AND option_group.organization_id = option_choice.organization_id
               AND option_group.archived_at IS NULL
             WHERE variant.organization_id = ?
               AND variant.menu_product_id = ?
               AND variant.archived_at IS NULL
             ORDER BY variant.display_order,
                      option_group.display_order,
                      option_choice.display_order
            """, rs -> {
                UUID variantId = rs.getObject("variant_id", UUID.class);
                UUID groupId = rs.getObject("group_id", UUID.class);
                String groupName = rs.getString("group_name");
                int minimumSelections = rs.getInt("minimum_selections");
                int maximumSelections = rs.getInt("maximum_selections");
                int groupDisplayOrder = rs.getInt("group_display_order");
                LinkedHashMap<UUID, OptionGroupBuilder> variantGroups =
                    result.computeIfAbsent(variantId, ignored -> new LinkedHashMap<>());
                OptionGroupBuilder group = variantGroups.computeIfAbsent(
                    groupId,
                    ignored -> new OptionGroupBuilder(
                        groupId,
                        groupName,
                        minimumSelections,
                        maximumSelections,
                        groupDisplayOrder));
                group.choices().add(new GuestCatalogDto.OptionChoice(
                    rs.getObject("choice_id", UUID.class),
                    rs.getString("choice_name"),
                    rs.getInt("choice_display_order"),
                    new GuestCatalogDto.Money(rs.getLong("price_delta_minor"), currency)));
            }, organizationId, productId);
        return result;
    }

    private record LocationRecord(
        UUID id,
        UUID organizationId,
        String slug,
        String name,
        String currency
    ) {
        GuestCatalogDto.Location toDto() {
            return new GuestCatalogDto.Location(id, slug, name, currency);
        }
    }

    private record ProductRecord(
        UUID id,
        String slug,
        String name,
        String description,
        String category,
        String artworkKey
    ) {
    }

    private record VariantRecord(
        UUID id,
        String name,
        int displayOrder,
        boolean isDefault,
        boolean available,
        long priceMinor
    ) {
    }

    private record OptionGroupBuilder(
        UUID id,
        String name,
        int minimumSelections,
        int maximumSelections,
        int displayOrder,
        List<GuestCatalogDto.OptionChoice> choices
    ) {
        OptionGroupBuilder(
            UUID id,
            String name,
            int minimumSelections,
            int maximumSelections,
            int displayOrder
        ) {
            this(id, name, minimumSelections, maximumSelections, displayOrder, new ArrayList<>());
        }

        GuestCatalogDto.OptionGroup toDto() {
            return new GuestCatalogDto.OptionGroup(
                id,
                name,
                minimumSelections,
                maximumSelections,
                displayOrder,
                List.copyOf(choices));
        }
    }
}
