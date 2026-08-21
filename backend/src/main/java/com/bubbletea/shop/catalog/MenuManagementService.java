package com.bubbletea.shop.catalog;

import com.bubbletea.shop.identity.StaffContextService;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class MenuManagementService {
    private final JdbcClient jdbc;
    private final CatalogStaffAccessService access;

    public MenuManagementService(JdbcClient jdbc, CatalogStaffAccessService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public ProductPage list(UUID subject, UUID organizationId, int page, int size, String query,
                            boolean includeArchived) {
        access.authorize(subject, organizationId);
        String pattern = query == null || query.isBlank() ? null
            : "%" + escapeLike(query.trim().toLowerCase(Locale.ROOT)) + "%";
        long total = jdbc.sql("""
                SELECT count(*) FROM menu_product
                 WHERE organization_id = :organizationId
                   AND (:includeArchived OR archived_at IS NULL)
                   AND (:query IS NULL OR lower(name) LIKE :query ESCAPE '\\')
                """).param("organizationId", organizationId)
            .param("includeArchived", includeArchived).param("query", pattern, Types.VARCHAR)
            .query(Long.class).single();
        List<ProductSummary> items = jdbc.sql("""
                SELECT product.id, product.public_slug, product.name, product.description,
                       product.category, product.artwork_key, product.image_url,
                       product.display_order, product.version, product.archived_at,
                       count(variant.id) FILTER (WHERE variant.archived_at IS NULL) AS variant_count
                  FROM menu_product product
             LEFT JOIN menu_variant variant ON variant.menu_product_id = product.id
                 WHERE product.organization_id = :organizationId
                   AND (:includeArchived OR product.archived_at IS NULL)
                   AND (:query IS NULL OR lower(product.name) LIKE :query ESCAPE '\\')
              GROUP BY product.id
              ORDER BY lower(product.name), product.id LIMIT :size OFFSET :offset
                """).param("organizationId", organizationId)
            .param("includeArchived", includeArchived).param("query", pattern, Types.VARCHAR)
            .param("size", size).param("offset", (long) page * size)
            .query((rs, row) -> new ProductSummary(rs.getObject("id", UUID.class),
                rs.getString("public_slug"), rs.getString("name"), rs.getString("description"),
                rs.getString("category"), rs.getString("artwork_key"), rs.getString("image_url"),
                rs.getInt("display_order"), rs.getLong("version"),
                rs.getTimestamp("archived_at") != null, rs.getInt("variant_count"))).list();
        return new ProductPage(items, page, size, total, total == 0 ? 0 : (total + size - 1) / size);
    }

    @Transactional
    public ProductDetail create(UUID subject, UUID organizationId, ProductInput input) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        NormalizedProduct product = normalize(input);
        UUID id = jdbc.sql("""
                INSERT INTO menu_product (
                    organization_id, public_slug, name, description, image_url, category,
                    artwork_key, display_order
                ) VALUES (
                    :organizationId, :slug, :name, :description, :imageUrl, :category,
                    :artworkKey, :displayOrder
                ) RETURNING id
                """).param("organizationId", organizationId).param("slug", product.publicSlug())
            .param("name", product.name()).param("description", product.description(), Types.VARCHAR)
            .param("imageUrl", product.imageUrl(), Types.VARCHAR)
            .param("category", product.category(), Types.VARCHAR)
            .param("artworkKey", product.artworkKey(), Types.VARCHAR)
            .param("displayOrder", product.displayOrder()).query(UUID.class).single();
        audit(organizationId, "MENU_PRODUCT", id, "CREATE", context.accountId());
        return detailUnchecked(context, organizationId, id);
    }

    @Transactional(readOnly = true)
    public ProductDetail detail(UUID subject, UUID organizationId, UUID productId) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        return detailUnchecked(context, organizationId, productId);
    }

    @Transactional
    public ProductDetail update(UUID subject, UUID organizationId, UUID productId,
                                ProductInput input) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        NormalizedProduct product = normalize(input);
        int changed = jdbc.sql("""
                UPDATE menu_product SET public_slug = :slug, name = :name,
                       description = :description, image_url = :imageUrl, category = :category,
                       artwork_key = :artworkKey, display_order = :displayOrder,
                       version = version + 1, updated_at = now()
                 WHERE id = :productId AND organization_id = :organizationId
                   AND archived_at IS NULL AND version = :version
                """).param("slug", product.publicSlug()).param("name", product.name())
            .param("description", product.description(), Types.VARCHAR)
            .param("imageUrl", product.imageUrl(), Types.VARCHAR)
            .param("category", product.category(), Types.VARCHAR)
            .param("artworkKey", product.artworkKey(), Types.VARCHAR)
            .param("displayOrder", product.displayOrder()).param("productId", productId)
            .param("organizationId", organizationId).param("version", input.version()).update();
        if (changed == 0) throw productMutationFailure(organizationId, productId);
        audit(organizationId, "MENU_PRODUCT", productId, "UPDATE", context.accountId());
        return detailUnchecked(context, organizationId, productId);
    }

    @Transactional
    public ProductDetail archive(UUID subject, UUID organizationId, UUID productId, long version) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        ProductRow current = product(organizationId, productId, true);
        if (current.archived()) return detailUnchecked(context, organizationId, productId);
        if (current.version() != version) throw new MenuVersionConflictException();
        if (jdbc.sql("""
                SELECT EXISTS(
                    SELECT 1 FROM menu_variant variant
                    JOIN menu_variant_offering offering ON offering.menu_variant_id = variant.id
                     WHERE variant.menu_product_id = :productId AND offering.available
                )
                """).param("productId", productId).query(Boolean.class).single()) {
            throw new MenuStateConflictException();
        }
        try {
            int changed = jdbc.sql("""
                    UPDATE menu_product SET archived_at = now(), version = version + 1,
                           updated_at = now()
                     WHERE id = :productId AND organization_id = :organizationId
                       AND archived_at IS NULL AND version = :version
                    """).param("productId", productId).param("organizationId", organizationId)
                .param("version", version).update();
            if (changed == 0) throw productMutationFailure(organizationId, productId);
        } catch (DataAccessException exception) {
            throw new MenuStateConflictException();
        }
        audit(organizationId, "MENU_PRODUCT", productId, "ARCHIVE", context.accountId());
        return detailUnchecked(context, organizationId, productId);
    }

    @Transactional
    public ProductDetail createVariant(UUID subject, UUID organizationId, UUID productId,
                                       VariantInput input) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        ProductRow product = product(organizationId, productId, true);
        if (product.archived()) throw new MenuStateConflictException();
        if (input.defaultVariant()) clearDefaultVariant(
            organizationId, productId, null, context.accountId());
        UUID id = jdbc.sql("""
                INSERT INTO menu_variant (
                    organization_id, menu_product_id, name, display_order, is_default
                ) VALUES (:organizationId, :productId, :name, :displayOrder, :isDefault)
                RETURNING id
                """).param("organizationId", organizationId).param("productId", productId)
            .param("name", normalizeName(input.name())).param("displayOrder", input.displayOrder())
            .param("isDefault", input.defaultVariant()).query(UUID.class).single();
        audit(organizationId, "MENU_VARIANT", id, "CREATE", context.accountId());
        return detailUnchecked(context, organizationId, productId);
    }

    @Transactional
    public ProductDetail updateVariant(UUID subject, UUID organizationId, UUID productId,
                                       UUID variantId, VariantInput input) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        ensureActiveProduct(organizationId, productId);
        VariantRow current = variant(organizationId, productId, variantId, true);
        if (current.archived()) throw new MenuStateConflictException();
        if (current.version() != input.version()) throw new MenuVersionConflictException();
        if (input.defaultVariant()) clearDefaultVariant(
            organizationId, productId, variantId, context.accountId());
        int changed = jdbc.sql("""
                UPDATE menu_variant SET name = :name, display_order = :displayOrder,
                       is_default = :isDefault, version = version + 1, updated_at = now()
                 WHERE id = :variantId AND menu_product_id = :productId
                   AND organization_id = :organizationId AND archived_at IS NULL
                   AND version = :version
                """).param("name", normalizeName(input.name()))
            .param("displayOrder", input.displayOrder()).param("isDefault", input.defaultVariant())
            .param("variantId", variantId).param("productId", productId)
            .param("organizationId", organizationId).param("version", input.version()).update();
        if (changed == 0) throw variantMutationFailure(organizationId, productId, variantId);
        audit(organizationId, "MENU_VARIANT", variantId, "UPDATE", context.accountId());
        return detailUnchecked(context, organizationId, productId);
    }

    @Transactional
    public ProductDetail archiveVariant(UUID subject, UUID organizationId, UUID productId,
                                        UUID variantId, long version) {
        StaffContextService.StaffContext context = access.authorize(subject, organizationId);
        VariantRow current = variant(organizationId, productId, variantId, true);
        if (current.archived()) return detailUnchecked(context, organizationId, productId);
        if (current.version() != version) throw new MenuVersionConflictException();
        if (jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM menu_variant_offering
                 WHERE menu_variant_id = :variantId AND available)
                """).param("variantId", variantId).query(Boolean.class).single()) {
            throw new MenuStateConflictException();
        }
        try {
            int changed = jdbc.sql("""
                    UPDATE menu_variant SET archived_at = now(), is_default = false,
                           version = version + 1, updated_at = now()
                     WHERE id = :variantId AND menu_product_id = :productId
                       AND organization_id = :organizationId AND archived_at IS NULL
                       AND version = :version
                    """).param("variantId", variantId).param("productId", productId)
                .param("organizationId", organizationId).param("version", version).update();
            if (changed == 0) throw variantMutationFailure(organizationId, productId, variantId);
        } catch (DataAccessException exception) {
            throw new MenuStateConflictException();
        }
        audit(organizationId, "MENU_VARIANT", variantId, "ARCHIVE", context.accountId());
        return detailUnchecked(context, organizationId, productId);
    }

    @Transactional(readOnly = true)
    public List<Offering> listOfferings(UUID subject, UUID organizationId, UUID locationId,
                                        UUID variantId) {
        access.authorizeLocation(subject, organizationId, locationId);
        return offerings(organizationId, Set.of(locationId), variantId);
    }

    @Transactional
    public Offering createOffering(UUID subject, UUID organizationId, UUID locationId,
                                   OfferingInput input) {
        StaffContextService.StaffContext context = access.authorizeLocation(
            subject, organizationId, locationId);
        String currency = locationCurrency(organizationId, locationId);
        validateOfferingReferences(organizationId, input.variantId(), input.recipeVersionId());
        if (jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM menu_variant_offering
                 WHERE location_id = :locationId AND menu_variant_id = :variantId)
                """).param("locationId", locationId).param("variantId", input.variantId())
            .query(Boolean.class).single()) {
            throw new MenuConflictException();
        }
        try {
            UUID id = jdbc.sql("""
                    INSERT INTO menu_variant_offering (
                        organization_id, location_id, menu_variant_id, recipe_version_id,
                        price_minor, currency_code, available
                    ) VALUES (
                        :organizationId, :locationId, :variantId, :recipeVersionId,
                        :priceMinor, :currency, :available
                    ) RETURNING id
                    """).param("organizationId", organizationId).param("locationId", locationId)
                .param("variantId", input.variantId())
                .param("recipeVersionId", input.recipeVersionId())
                .param("priceMinor", input.priceMinor()).param("currency", currency)
                .param("available", input.available()).query(UUID.class).single();
            audit(organizationId, "MENU_OFFERING", id, "CREATE", context.accountId());
            return offering(organizationId, locationId, id);
        } catch (DataIntegrityViolationException exception) {
            throw new MenuConflictException();
        } catch (DataAccessException exception) {
            throw new MenuStateConflictException();
        }
    }

    @Transactional
    public Offering updateOffering(UUID subject, UUID organizationId, UUID locationId,
                                   UUID offeringId, OfferingUpdate input) {
        StaffContextService.StaffContext context = access.authorizeLocation(
            subject, organizationId, locationId);
        Offering current = offering(organizationId, locationId, offeringId);
        validateOfferingReferences(organizationId, current.variantId(), input.recipeVersionId());
        try {
            int changed = jdbc.sql("""
                    UPDATE menu_variant_offering
                       SET recipe_version_id = :recipeVersionId, price_minor = :priceMinor,
                           available = :available, version = version + 1, updated_at = now()
                     WHERE id = :offeringId AND organization_id = :organizationId
                       AND location_id = :locationId AND version = :version
                    """).param("recipeVersionId", input.recipeVersionId())
                .param("priceMinor", input.priceMinor()).param("available", input.available())
                .param("offeringId", offeringId).param("organizationId", organizationId)
                .param("locationId", locationId).param("version", input.version()).update();
            if (changed == 0) {
                offering(organizationId, locationId, offeringId);
                throw new MenuVersionConflictException();
            }
            audit(organizationId, "MENU_OFFERING", offeringId, "UPDATE", context.accountId());
            return offering(organizationId, locationId, offeringId);
        } catch (DataAccessException exception) {
            throw new MenuStateConflictException();
        }
    }

    private ProductDetail detailUnchecked(StaffContextService.StaffContext context,
                                          UUID organizationId, UUID productId) {
        ProductRow product = product(organizationId, productId, false);
        List<Variant> variants = jdbc.sql("""
                SELECT id, name, display_order, is_default, version, archived_at,
                       created_at, updated_at
                  FROM menu_variant
                 WHERE menu_product_id = :productId AND organization_id = :organizationId
              ORDER BY display_order, lower(name), id
                """).param("productId", productId).param("organizationId", organizationId)
            .query(this::mapVariant).list();
        Set<UUID> variantIds = variants.stream().map(Variant::id).collect(java.util.stream.Collectors.toSet());
        Map<UUID, List<VariantChoice>> choices = variantChoices(organizationId, variantIds);
        List<Variant> withChoices = variants.stream().map(variant -> new Variant(
            variant.id(), variant.name(), variant.displayOrder(), variant.defaultVariant(),
            variant.version(), variant.archived(), variant.createdAt(), variant.updatedAt(),
            choices.getOrDefault(variant.id(), List.of()))).toList();
        Set<UUID> locationIds = authorizedLocationIds(context, organizationId);
        List<Offering> offerings = locationIds.isEmpty() ? List.of()
            : offeringsForProduct(organizationId, productId, locationIds);
        return new ProductDetail(product.id(), product.publicSlug(), product.name(),
            product.description(), product.category(), product.artworkKey(), product.imageUrl(),
            product.displayOrder(), product.version(), product.archived(), product.createdAt(),
            product.updatedAt(), withChoices, offerings);
    }

    private Map<UUID, List<VariantChoice>> variantChoices(UUID organizationId, Set<UUID> variantIds) {
        Map<UUID, List<VariantChoice>> result = new HashMap<>();
        if (variantIds.isEmpty()) return result;
        List<ChoiceEffectRow> rows = jdbc.sql("""
                SELECT link.menu_variant_id, link.id AS link_id, link.option_choice_id,
                       choice.name AS choice_name, choice.option_group_id, group_row.name AS group_name,
                       link.price_delta_minor, link.enabled, link.version,
                       effect.ingredient_id, ingredient.name AS ingredient_name,
                       ingredient.base_unit, effect.quantity_delta
                  FROM menu_variant_option_choice link
                  JOIN option_choice choice ON choice.id = link.option_choice_id
                  JOIN option_group group_row ON group_row.id = choice.option_group_id
             LEFT JOIN option_choice_ingredient_effect effect
                    ON effect.menu_variant_option_choice_id = link.id
             LEFT JOIN ingredient ON ingredient.id = effect.ingredient_id
                 WHERE link.organization_id = :organizationId
                   AND link.menu_variant_id IN (:variantIds)
              ORDER BY link.menu_variant_id, group_row.display_order, choice.display_order,
                       lower(ingredient.name) NULLS FIRST, ingredient.id NULLS FIRST
                """).param("organizationId", organizationId).param("variantIds", variantIds)
            .query(this::mapChoiceEffect).list();
        Map<UUID, ChoiceBuilder> builders = new java.util.LinkedHashMap<>();
        for (ChoiceEffectRow row : rows) {
            ChoiceBuilder builder = builders.computeIfAbsent(row.linkId(), ignored ->
                new ChoiceBuilder(row.variantId(), row.linkId(), row.choiceId(), row.choiceName(),
                    row.groupId(), row.groupName(), row.priceDeltaMinor(), row.enabled(), row.version()));
            if (row.ingredientId() != null) builder.effects.add(new IngredientEffect(
                row.ingredientId(), row.ingredientName(), row.baseUnit(), row.quantity()));
        }
        builders.values().forEach(builder -> result.computeIfAbsent(builder.variantId,
            ignored -> new ArrayList<>()).add(builder.build()));
        return result;
    }

    private List<Offering> offeringsForProduct(UUID organizationId, UUID productId,
                                               Set<UUID> locationIds) {
        return jdbc.sql("""
                SELECT offering.id, offering.location_id, location.name AS location_name,
                       offering.menu_variant_id, variant.name AS variant_name,
                       offering.recipe_version_id, recipe.name AS recipe_name,
                       version.version_number, offering.price_minor, offering.currency_code,
                       offering.available, offering.version, offering.created_at, offering.updated_at
                  FROM menu_variant_offering offering
                  JOIN location ON location.id = offering.location_id
                  JOIN menu_variant variant ON variant.id = offering.menu_variant_id
                  JOIN recipe_version version ON version.id = offering.recipe_version_id
                  JOIN recipe ON recipe.id = version.recipe_id
                 WHERE offering.organization_id = :organizationId
                   AND variant.menu_product_id = :productId
                   AND offering.location_id IN (:locationIds)
              ORDER BY lower(location.name), variant.display_order, lower(variant.name), offering.id
                """).param("organizationId", organizationId).param("productId", productId)
            .param("locationIds", locationIds).query(this::mapOffering).list();
    }

    private List<Offering> offerings(UUID organizationId, Set<UUID> locationIds, UUID variantId) {
        return jdbc.sql("""
                SELECT offering.id, offering.location_id, location.name AS location_name,
                       offering.menu_variant_id, variant.name AS variant_name,
                       offering.recipe_version_id, recipe.name AS recipe_name,
                       version.version_number, offering.price_minor, offering.currency_code,
                       offering.available, offering.version, offering.created_at, offering.updated_at
                  FROM menu_variant_offering offering
                  JOIN location ON location.id = offering.location_id
                  JOIN menu_variant variant ON variant.id = offering.menu_variant_id
                  JOIN recipe_version version ON version.id = offering.recipe_version_id
                  JOIN recipe ON recipe.id = version.recipe_id
                 WHERE offering.organization_id = :organizationId
                   AND offering.location_id IN (:locationIds)
                   AND (:variantId IS NULL OR offering.menu_variant_id = :variantId)
              ORDER BY variant.display_order, lower(variant.name), offering.id
                """).param("organizationId", organizationId).param("locationIds", locationIds)
            .param("variantId", variantId, Types.OTHER).query(this::mapOffering).list();
    }

    private Offering offering(UUID organizationId, UUID locationId, UUID offeringId) {
        return jdbc.sql("""
                SELECT offering.id, offering.location_id, location.name AS location_name,
                       offering.menu_variant_id, variant.name AS variant_name,
                       offering.recipe_version_id, recipe.name AS recipe_name,
                       version.version_number, offering.price_minor, offering.currency_code,
                       offering.available, offering.version, offering.created_at, offering.updated_at
                  FROM menu_variant_offering offering
                  JOIN location ON location.id = offering.location_id
                  JOIN menu_variant variant ON variant.id = offering.menu_variant_id
                  JOIN recipe_version version ON version.id = offering.recipe_version_id
                  JOIN recipe ON recipe.id = version.recipe_id
                 WHERE offering.id = :offeringId AND offering.organization_id = :organizationId
                   AND offering.location_id = :locationId
                """).param("offeringId", offeringId).param("organizationId", organizationId)
            .param("locationId", locationId).query(this::mapOffering).optional()
            .orElseThrow(MenuNotFoundException::new);
    }

    private void validateOfferingReferences(UUID organizationId, UUID variantId,
                                            UUID recipeVersionId) {
        boolean valid = jdbc.sql("""
                SELECT EXISTS(
                    SELECT 1 FROM menu_variant variant
                    JOIN menu_product product ON product.id = variant.menu_product_id
                    JOIN recipe_version version ON version.id = :recipeVersionId
                    JOIN recipe ON recipe.id = version.recipe_id
                     WHERE variant.id = :variantId
                       AND variant.organization_id = :organizationId
                       AND version.organization_id = :organizationId
                       AND variant.archived_at IS NULL AND product.archived_at IS NULL
                       AND version.status = 'PUBLISHED' AND recipe.archived_at IS NULL
                )
                """).param("variantId", variantId).param("recipeVersionId", recipeVersionId)
            .param("organizationId", organizationId).query(Boolean.class).single();
        if (!valid) throw new InvalidMenuException();
    }

    private String locationCurrency(UUID organizationId, UUID locationId) {
        return jdbc.sql("""
                SELECT currency_code FROM location
                 WHERE id = :locationId AND organization_id = :organizationId AND active
                """).param("locationId", locationId).param("organizationId", organizationId)
            .query(String.class).optional().orElseThrow(MenuNotFoundException::new);
    }

    private Set<UUID> authorizedLocationIds(StaffContextService.StaffContext context,
                                            UUID organizationId) {
        Set<UUID> ids = new HashSet<>();
        context.memberships().stream()
            .filter(membership -> membership.organizationId().equals(organizationId))
            .flatMap(membership -> membership.locations().stream())
            .forEach(location -> ids.add(location.id()));
        return ids;
    }

    private void clearDefaultVariant(UUID organizationId, UUID productId, UUID excludedVariantId,
                                     UUID actorId) {
        List<UUID> changed = jdbc.sql("""
                UPDATE menu_variant SET is_default = false, version = version + 1, updated_at = now()
                 WHERE menu_product_id = :productId AND is_default AND archived_at IS NULL
                   AND (CAST(:excludedId AS uuid) IS NULL OR id <> CAST(:excludedId AS uuid))
                RETURNING id
                """).param("productId", productId).param("excludedId", excludedVariantId, Types.OTHER)
            .query(UUID.class).list();
        changed.forEach(id -> audit(organizationId, "MENU_VARIANT", id, "UPDATE", actorId));
    }

    private void ensureActiveProduct(UUID organizationId, UUID productId) {
        if (product(organizationId, productId, true).archived()) throw new MenuStateConflictException();
    }

    private ProductRow product(UUID organizationId, UUID productId, boolean lock) {
        return jdbc.sql("""
                SELECT id, public_slug, name, description, category, artwork_key, image_url,
                       display_order, version, archived_at, created_at, updated_at
                  FROM menu_product WHERE id = :productId AND organization_id = :organizationId
                """ + (lock ? " FOR UPDATE" : ""))
            .param("productId", productId).param("organizationId", organizationId)
            .query(this::mapProduct).optional().orElseThrow(MenuNotFoundException::new);
    }

    private VariantRow variant(UUID organizationId, UUID productId, UUID variantId, boolean lock) {
        return jdbc.sql("""
                SELECT id, version, archived_at FROM menu_variant
                 WHERE id = :variantId AND menu_product_id = :productId
                   AND organization_id = :organizationId
                """ + (lock ? " FOR UPDATE" : ""))
            .param("variantId", variantId).param("productId", productId)
            .param("organizationId", organizationId)
            .query((rs, row) -> new VariantRow(rs.getObject("id", UUID.class), rs.getLong("version"),
                rs.getTimestamp("archived_at") != null)).optional()
            .orElseThrow(MenuNotFoundException::new);
    }

    private RuntimeException productMutationFailure(UUID organizationId, UUID productId) {
        return product(organizationId, productId, false).archived()
            ? new MenuStateConflictException() : new MenuVersionConflictException();
    }

    private RuntimeException variantMutationFailure(UUID organizationId, UUID productId,
                                                    UUID variantId) {
        return variant(organizationId, productId, variantId, false).archived()
            ? new MenuStateConflictException() : new MenuVersionConflictException();
    }

    private NormalizedProduct normalize(ProductInput input) {
        String imageUrl = normalizeOptional(input.imageUrl());
        if (imageUrl != null) {
            try {
                URI uri = URI.create(imageUrl);
                if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                    throw new InvalidMenuException();
                }
            } catch (IllegalArgumentException exception) {
                throw new InvalidMenuException();
            }
        }
        return new NormalizedProduct(normalizeName(input.publicSlug()), normalizeName(input.name()),
            normalizeOptional(input.description()), imageUrl, normalizeOptional(input.category()),
            normalizeOptional(input.artworkKey()), input.displayOrder());
    }

    private String normalizeName(String raw) {
        if (raw == null || raw.trim().isBlank()) throw new InvalidMenuException();
        return raw.trim();
    }

    private String normalizeOptional(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    private String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private ProductRow mapProduct(ResultSet rs, int row) throws SQLException {
        return new ProductRow(rs.getObject("id", UUID.class), rs.getString("public_slug"),
            rs.getString("name"), rs.getString("description"), rs.getString("category"),
            rs.getString("artwork_key"), rs.getString("image_url"), rs.getInt("display_order"),
            rs.getLong("version"), rs.getTimestamp("archived_at") != null,
            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }

    private Variant mapVariant(ResultSet rs, int row) throws SQLException {
        return new Variant(rs.getObject("id", UUID.class), rs.getString("name"),
            rs.getInt("display_order"), rs.getBoolean("is_default"), rs.getLong("version"),
            rs.getTimestamp("archived_at") != null, rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("updated_at").toInstant(), List.of());
    }

    private Offering mapOffering(ResultSet rs, int row) throws SQLException {
        return new Offering(rs.getObject("id", UUID.class), rs.getObject("location_id", UUID.class),
            rs.getString("location_name"), rs.getObject("menu_variant_id", UUID.class),
            rs.getString("variant_name"), rs.getObject("recipe_version_id", UUID.class),
            rs.getString("recipe_name"), rs.getInt("version_number"), rs.getLong("price_minor"),
            rs.getString("currency_code"), rs.getBoolean("available"), rs.getLong("version"),
            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }

    private ChoiceEffectRow mapChoiceEffect(ResultSet rs, int row) throws SQLException {
        return new ChoiceEffectRow(rs.getObject("menu_variant_id", UUID.class),
            rs.getObject("link_id", UUID.class), rs.getObject("option_choice_id", UUID.class),
            rs.getString("choice_name"), rs.getObject("option_group_id", UUID.class),
            rs.getString("group_name"), rs.getLong("price_delta_minor"), rs.getBoolean("enabled"),
            rs.getLong("version"), rs.getObject("ingredient_id", UUID.class),
            rs.getString("ingredient_name"), rs.getString("base_unit"),
            rs.getBigDecimal("quantity_delta") == null ? null : rs.getBigDecimal("quantity_delta").toPlainString());
    }

    private void audit(UUID organizationId, String entityType, UUID entityId, String action,
                       UUID actorId) {
        jdbc.sql("""
                INSERT INTO catalog_change (
                    organization_id, entity_type, entity_id, action, actor_account_id
                ) VALUES (:organizationId, :entityType, :entityId, :action, :actorId)
                """).param("organizationId", organizationId).param("entityType", entityType)
            .param("entityId", entityId).param("action", action).param("actorId", actorId).update();
    }

    private record NormalizedProduct(String publicSlug, String name, String description,
                                     String imageUrl, String category, String artworkKey,
                                     int displayOrder) { }
    private record ProductRow(UUID id, String publicSlug, String name, String description,
                              String category, String artworkKey, String imageUrl, int displayOrder,
                              long version, boolean archived, Instant createdAt, Instant updatedAt) { }
    private record VariantRow(UUID id, long version, boolean archived) { }
    private record ChoiceEffectRow(UUID variantId, UUID linkId, UUID choiceId, String choiceName,
                                   UUID groupId, String groupName, long priceDeltaMinor,
                                   boolean enabled, long version, UUID ingredientId,
                                   String ingredientName, String baseUnit, String quantity) { }
    private static final class ChoiceBuilder {
        private final UUID variantId;
        private final UUID linkId;
        private final UUID choiceId;
        private final String choiceName;
        private final UUID groupId;
        private final String groupName;
        private final long priceDeltaMinor;
        private final boolean enabled;
        private final long version;
        private final List<IngredientEffect> effects = new ArrayList<>();

        private ChoiceBuilder(UUID variantId, UUID linkId, UUID choiceId, String choiceName,
                              UUID groupId, String groupName, long priceDeltaMinor,
                              boolean enabled, long version) {
            this.variantId = variantId;
            this.linkId = linkId;
            this.choiceId = choiceId;
            this.choiceName = choiceName;
            this.groupId = groupId;
            this.groupName = groupName;
            this.priceDeltaMinor = priceDeltaMinor;
            this.enabled = enabled;
            this.version = version;
        }

        private VariantChoice build() {
            return new VariantChoice(linkId, choiceId, choiceName, groupId, groupName,
                priceDeltaMinor, enabled, version, effects);
        }
    }

    public record ProductInput(String publicSlug, String name, String description, String imageUrl,
                               String category, String artworkKey, int displayOrder, long version) { }
    public record VariantInput(String name, int displayOrder, boolean defaultVariant, long version) { }
    public record OfferingInput(UUID variantId, UUID recipeVersionId, long priceMinor,
                                boolean available) { }
    public record OfferingUpdate(UUID recipeVersionId, long priceMinor, boolean available,
                                 long version) { }
    @Schema(name = "StaffMenuProductSummary")
    public record ProductSummary(UUID id, String publicSlug, String name,
                                 @Schema(nullable = true) String description,
                                 @Schema(nullable = true) String category,
                                 @Schema(nullable = true) String artworkKey,
                                 @Schema(nullable = true) String imageUrl,
                                 int displayOrder, long version, boolean archived,
                                 int activeVariantCount) { }
    @Schema(name = "StaffMenuProductPage")
    public record ProductPage(List<ProductSummary> items, int page, int size, long totalItems,
                              long totalPages) {
        public ProductPage { items = List.copyOf(items); }
    }
    @Schema(name = "StaffMenuProductDetail")
    public record ProductDetail(UUID id, String publicSlug, String name,
                                @Schema(nullable = true) String description,
                                @Schema(nullable = true) String category,
                                @Schema(nullable = true) String artworkKey,
                                @Schema(nullable = true) String imageUrl,
                                int displayOrder, long version, boolean archived,
                                Instant createdAt, Instant updatedAt, List<Variant> variants,
                                List<Offering> offerings) {
        public ProductDetail {
            variants = List.copyOf(variants);
            offerings = List.copyOf(offerings);
        }
    }
    @Schema(name = "StaffMenuVariant")
    public record Variant(UUID id, String name, int displayOrder, boolean defaultVariant,
                          long version, boolean archived, Instant createdAt, Instant updatedAt,
                          List<VariantChoice> choices) {
        public Variant { choices = List.copyOf(choices); }
    }
    @Schema(name = "StaffVariantOptionChoice")
    public record VariantChoice(UUID id, UUID choiceId, String choiceName, UUID groupId,
                                String groupName, long priceDeltaMinor, boolean enabled,
                                long version, List<IngredientEffect> ingredientEffects) {
        public VariantChoice { ingredientEffects = List.copyOf(ingredientEffects); }
    }
    @Schema(name = "StaffOptionIngredientEffect")
    public record IngredientEffect(UUID ingredientId, String ingredientName, String baseUnit,
                                   String quantityDelta) { }
    @Schema(name = "StaffMenuOffering")
    public record Offering(UUID id, UUID locationId, String locationName, UUID variantId,
                           String variantName, UUID recipeVersionId, String recipeName,
                           int recipeVersionNumber, long priceMinor, String currencyCode,
                           boolean available, long version, Instant createdAt, Instant updatedAt) { }
}
