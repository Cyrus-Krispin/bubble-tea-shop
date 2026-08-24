package com.bubbletea.shop.ordering;

import com.bubbletea.shop.catalog.GuestCatalogProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class GuestOrderPlacementService {
    private static final int MAX_TOTAL_QUANTITY = 50;
    private final JdbcClient jdbc;
    private final GuestCatalogProperties properties;

    public GuestOrderPlacementService(JdbcClient jdbc, GuestCatalogProperties properties) {
        this.jdbc = jdbc;
        this.properties = properties;
    }

    @Transactional
    public PlacedOrder place(UUID placementKey, UUID authSubject, List<CreateLine> requestedLines) {
        return place(properties.guestLocationSlug(), placementKey, authSubject, requestedLines);
    }

    @Transactional
    public PlacedOrder place(
        String locationSlug,
        UUID placementKey,
        UUID authSubject,
        List<CreateLine> requestedLines
    ) {
        if (placementKey == null || requestedLines == null || requestedLines.isEmpty()
            || requestedLines.size() > 25) throw new InvalidGuestOrderException();
        long totalQuantity = requestedLines.stream().mapToLong(CreateLine::quantity).sum();
        if (totalQuantity > MAX_TOTAL_QUANTITY
            || requestedLines.stream().anyMatch(line -> line.quantity() < 1 || line.quantity() > 20)) {
            throw new InvalidGuestOrderException();
        }

        Location location = findLocation(locationSlug);
        UUID customerAccountId = resolveCustomerAccount(authSubject);
        String fingerprint = fingerprint(customerAccountId, requestedLines);
        PlacedOrder replay = findByPlacementKey(location.id(), placementKey, fingerprint, true);
        if (replay != null) return replay;

        List<ResolvedLine> lines = new ArrayList<>();
        long total = 0;
        for (CreateLine requested : requestedLines) {
            ResolvedLine line = resolveLine(location, requested);
            lines.add(line);
            try {
                total = Math.addExact(total, line.lineTotalMinor());
            } catch (ArithmeticException exception) {
                throw new InvalidGuestOrderException();
            }
        }

        UUID orderId = UUID.randomUUID();
        String publicNumber = jdbc.sql("SELECT 'BT' || lpad(nextval('customer_order_public_number_seq')::text, 10, '0')")
            .query(String.class).single();
        int inserted = jdbc.sql("""
                INSERT INTO customer_order (
                    id, organization_id, location_id, customer_account_id,
                    placement_key, placement_fingerprint, public_order_number, status,
                    payment_method, currency_code, subtotal_minor, total_minor
                ) VALUES (
                    :id, :organizationId, :locationId, :customerAccountId,
                    :placementKey, :fingerprint, :publicNumber, 'PENDING',
                    'CASH', :currency, :total, :total
                )
                ON CONFLICT (location_id, placement_key) WHERE placement_key IS NOT NULL DO NOTHING
                """)
            .param("id", orderId).param("organizationId", location.organizationId())
            .param("locationId", location.id()).param("customerAccountId", customerAccountId)
            .param("placementKey", placementKey).param("fingerprint", fingerprint)
            .param("publicNumber", publicNumber).param("currency", location.currency())
            .param("total", total).update();
        if (inserted == 0) return requiredReplay(location.id(), placementKey, fingerprint);

        for (int index = 0; index < lines.size(); index++) {
            insertLine(orderId, location.organizationId(), index + 1, lines.get(index));
        }
        jdbc.sql("""
                INSERT INTO order_status_history (
                    id, organization_id, customer_order_id, from_status, to_status
                ) VALUES (:id, :organizationId, :orderId, NULL, 'PENDING')
                """)
            .param("id", UUID.randomUUID()).param("organizationId", location.organizationId())
            .param("orderId", orderId).update();
        jdbc.sql("""
                INSERT INTO payment (
                    id, organization_id, customer_order_id, method, status,
                    amount_minor, currency_code
                ) VALUES (:id, :organizationId, :orderId, 'CASH', 'PENDING', :total, :currency)
                """)
            .param("id", UUID.randomUUID()).param("organizationId", location.organizationId())
            .param("orderId", orderId).param("total", total).param("currency", location.currency())
            .update();
        return loadOrder(orderId, false);
    }

    private Location findLocation(String locationSlug) {
        return jdbc.sql("""
                SELECT id, organization_id, currency_code
                  FROM location
                 WHERE public_slug = :slug AND active
                """)
            .param("slug", locationSlug)
            .query((rs, row) -> new Location(
                rs.getObject("id", UUID.class),
                rs.getObject("organization_id", UUID.class),
                rs.getString("currency_code")))
            .optional().orElseThrow(GuestOrderCatalogChangedException::new);
    }

    private UUID resolveCustomerAccount(UUID authSubject) {
        if (authSubject == null) return null;
        Account account = jdbc.sql("SELECT id, enabled FROM account WHERE auth_subject = :subject")
            .param("subject", authSubject)
            .query((rs, row) -> new Account(
                rs.getObject("id", UUID.class), rs.getBoolean("enabled")))
            .optional().orElseThrow(CustomerAccountDisabledException::new);
        if (!account.enabled()) throw new CustomerAccountDisabledException();
        return account.id();
    }

    private ResolvedLine resolveLine(Location location, CreateLine requested) {
        if (requested.variantId() == null || requested.quantity() < 1 || requested.quantity() > 20
            || requested.optionChoiceIds() == null) throw new InvalidGuestOrderException();
        Set<UUID> selectedIds = new LinkedHashSet<>(requested.optionChoiceIds());
        if (selectedIds.size() != requested.optionChoiceIds().size()) throw new InvalidGuestOrderException();

        Variant variant = jdbc.sql("""
                SELECT product.name AS product_name, variant.name AS variant_name,
                       offering.price_minor, offering.currency_code, offering.recipe_version_id
                  FROM menu_variant variant
                  JOIN menu_product product
                    ON product.id = variant.menu_product_id
                   AND product.organization_id = variant.organization_id
                  JOIN menu_variant_offering offering
                    ON offering.menu_variant_id = variant.id
                   AND offering.organization_id = variant.organization_id
                  JOIN recipe_version recipe_version
                    ON recipe_version.id = offering.recipe_version_id
                   AND recipe_version.organization_id = offering.organization_id
                 WHERE variant.id = :variantId
                   AND variant.organization_id = :organizationId
                   AND offering.location_id = :locationId
                   AND offering.available
                   AND variant.archived_at IS NULL
                   AND product.archived_at IS NULL
                   AND recipe_version.status = 'PUBLISHED'
                """)
            .param("variantId", requested.variantId())
            .param("organizationId", location.organizationId())
            .param("locationId", location.id())
            .query((rs, row) -> new Variant(
                rs.getString("product_name"), rs.getString("variant_name"),
                rs.getLong("price_minor"), rs.getString("currency_code"),
                rs.getObject("recipe_version_id", UUID.class)))
            .optional().orElseThrow(GuestOrderCatalogChangedException::new);
        if (!location.currency().equals(variant.currency())) throw new GuestOrderCatalogChangedException();

        List<Choice> availableChoices = jdbc.sql("""
                SELECT option_group.id AS group_id, option_group.name AS group_name,
                       option_group.minimum_selections, option_group.maximum_selections,
                       choice.id AS choice_id, choice.name AS choice_name,
                       variant_choice.id AS variant_choice_id, variant_choice.price_delta_minor
                  FROM menu_variant_option_choice variant_choice
                  JOIN option_choice choice
                    ON choice.id = variant_choice.option_choice_id
                   AND choice.organization_id = variant_choice.organization_id
                  JOIN option_group
                    ON option_group.id = choice.option_group_id
                   AND option_group.organization_id = choice.organization_id
                 WHERE variant_choice.organization_id = :organizationId
                   AND variant_choice.menu_variant_id = :variantId
                   AND variant_choice.enabled
                   AND choice.archived_at IS NULL
                   AND option_group.archived_at IS NULL
              ORDER BY option_group.display_order, choice.display_order, choice.id
                """)
            .param("organizationId", location.organizationId())
            .param("variantId", requested.variantId())
            .query((rs, row) -> new Choice(
                rs.getObject("group_id", UUID.class), rs.getString("group_name"),
                rs.getInt("minimum_selections"), rs.getInt("maximum_selections"),
                rs.getObject("choice_id", UUID.class), rs.getString("choice_name"),
                rs.getObject("variant_choice_id", UUID.class), rs.getLong("price_delta_minor")))
            .list();
        Map<UUID, Group> groups = new LinkedHashMap<>();
        availableChoices.forEach(choice -> groups.computeIfAbsent(choice.groupId(), ignored ->
            new Group(choice.minimumSelections(), choice.maximumSelections(), new ArrayList<>()))
            .choices().add(choice));
        List<Choice> selected = availableChoices.stream()
            .filter(choice -> selectedIds.contains(choice.choiceId())).toList();
        if (selected.size() != selectedIds.size()) throw new GuestOrderCatalogChangedException();
        for (Group group : groups.values()) {
            long count = group.choices().stream().filter(selected::contains).count();
            if (count < group.minimumSelections() || count > group.maximumSelections()) {
                throw new GuestOrderCatalogChangedException();
            }
        }

        long unitPrice = variant.priceMinor();
        try {
            for (Choice choice : selected) unitPrice = Math.addExact(unitPrice, choice.priceDeltaMinor());
            if (unitPrice < 0) throw new ArithmeticException();
            long lineTotal = Math.multiplyExact(unitPrice, requested.quantity());
            Map<UUID, BigDecimal> consumption = loadConsumption(
                location.organizationId(), variant.recipeVersionId(), selected, requested.quantity());
            return new ResolvedLine(requested.variantId(), variant.productName(), variant.variantName(),
                requested.quantity(), unitPrice, lineTotal, selected, consumption);
        } catch (ArithmeticException exception) {
            throw new InvalidGuestOrderException();
        }
    }

    private Map<UUID, BigDecimal> loadConsumption(
        UUID organizationId,
        UUID recipeVersionId,
        List<Choice> selected,
        int quantity
    ) {
        Map<UUID, BigDecimal> result = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT ingredient_id, quantity
                  FROM recipe_component
                 WHERE organization_id = :organizationId AND recipe_version_id = :recipeVersionId
                """)
            .param("organizationId", organizationId).param("recipeVersionId", recipeVersionId)
            .query((rs, row) -> new IngredientDelta(
                rs.getObject("ingredient_id", UUID.class), rs.getBigDecimal("quantity")))
            .list().forEach(delta -> result.merge(delta.ingredientId(), delta.quantity(), BigDecimal::add));
        for (Choice choice : selected) {
            jdbc.sql("""
                    SELECT ingredient_id, quantity_delta
                      FROM option_choice_ingredient_effect
                     WHERE organization_id = :organizationId
                       AND menu_variant_option_choice_id = :variantChoiceId
                    """)
                .param("organizationId", organizationId).param("variantChoiceId", choice.variantChoiceId())
                .query((rs, row) -> new IngredientDelta(
                    rs.getObject("ingredient_id", UUID.class), rs.getBigDecimal("quantity_delta")))
                .list().forEach(delta -> result.merge(delta.ingredientId(), delta.quantity(), BigDecimal::add));
        }
        Map<UUID, BigDecimal> scaled = new LinkedHashMap<>();
        result.forEach((ingredientId, amount) -> {
            BigDecimal finalAmount;
            try {
                finalAmount = amount.multiply(BigDecimal.valueOf(quantity))
                    .setScale(6, RoundingMode.UNNECESSARY);
                if (finalAmount.precision() > 19 || finalAmount.signum() < 0) throw new ArithmeticException();
            } catch (ArithmeticException exception) {
                throw new GuestOrderCatalogChangedException();
            }
            if (finalAmount.signum() > 0) scaled.put(ingredientId, finalAmount);
        });
        return scaled;
    }

    private void insertLine(UUID orderId, UUID organizationId, int lineNumber, ResolvedLine line) {
        UUID itemId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO order_item (
                    id, organization_id, customer_order_id, menu_variant_id, line_number,
                    product_name_snapshot, variant_name_snapshot, quantity,
                    unit_price_minor, line_total_minor
                ) VALUES (
                    :id, :organizationId, :orderId, :variantId, :lineNumber,
                    :productName, :variantName, :quantity, :unitPrice, :lineTotal
                )
                """)
            .param("id", itemId).param("organizationId", organizationId).param("orderId", orderId)
            .param("variantId", line.variantId()).param("lineNumber", lineNumber)
            .param("productName", line.productName())
            .param("variantName", line.variantName()).param("quantity", line.quantity())
            .param("unitPrice", line.unitPriceMinor()).param("lineTotal", line.lineTotalMinor()).update();
        for (int index = 0; index < line.selectedChoices().size(); index++) {
            Choice choice = line.selectedChoices().get(index);
            jdbc.sql("""
                    INSERT INTO order_item_option (
                        id, organization_id, order_item_id, option_choice_id, selection_number,
                        group_name_snapshot, choice_name_snapshot, price_delta_minor
                    ) VALUES (
                        :id, :organizationId, :itemId, :choiceId, :selectionNumber,
                        :groupName, :choiceName, :priceDelta
                    )
                    """)
                .param("id", UUID.randomUUID()).param("organizationId", organizationId)
                .param("itemId", itemId).param("choiceId", choice.choiceId())
                .param("selectionNumber", index + 1)
                .param("groupName", choice.groupName()).param("choiceName", choice.choiceName())
                .param("priceDelta", choice.priceDeltaMinor()).update();
        }
        line.consumption().forEach((ingredientId, amount) -> jdbc.sql("""
                INSERT INTO order_item_consumption (
                    id, organization_id, order_item_id, ingredient_id, quantity
                ) VALUES (:id, :organizationId, :itemId, :ingredientId, :quantity)
                """)
            .param("id", UUID.randomUUID()).param("organizationId", organizationId)
            .param("itemId", itemId).param("ingredientId", ingredientId).param("quantity", amount)
            .update());
    }

    private PlacedOrder findByPlacementKey(
        UUID locationId,
        UUID placementKey,
        String fingerprint,
        boolean replayed
    ) {
        Existing existing = jdbc.sql("""
                SELECT id, placement_fingerprint
                  FROM customer_order
                 WHERE location_id = :locationId AND placement_key = :placementKey
                """)
            .param("locationId", locationId).param("placementKey", placementKey)
            .query((rs, row) -> new Existing(
                rs.getObject("id", UUID.class), rs.getString("placement_fingerprint")))
            .optional().orElse(null);
        if (existing == null) return null;
        if (!fingerprint.equals(existing.fingerprint().trim())) {
            throw new GuestOrderIdempotencyConflictException();
        }
        return loadOrder(existing.id(), replayed);
    }

    private PlacedOrder requiredReplay(UUID locationId, UUID key, String fingerprint) {
        PlacedOrder replay = findByPlacementKey(locationId, key, fingerprint, true);
        if (replay == null) throw new GuestOrderUnavailableException(null);
        return replay;
    }

    private PlacedOrder loadOrder(UUID orderId, boolean replayed) {
        OrderHeader header = jdbc.sql("""
                SELECT public_order_number, status, payment_method, currency_code,
                       subtotal_minor, total_minor, created_at
                  FROM customer_order WHERE id = :orderId
                """)
            .param("orderId", orderId)
            .query((rs, row) -> new OrderHeader(
                rs.getString("public_order_number"), rs.getString("status"),
                rs.getString("payment_method"), rs.getString("currency_code"),
                rs.getLong("subtotal_minor"), rs.getLong("total_minor"),
                rs.getTimestamp("created_at").toInstant()))
            .single();
        List<PlacedLine> lines = jdbc.sql("""
                SELECT id, product_name_snapshot, variant_name_snapshot, quantity,
                       unit_price_minor, line_total_minor
                  FROM order_item WHERE customer_order_id = :orderId
              ORDER BY line_number
                """)
            .param("orderId", orderId)
            .query((rs, row) -> {
                UUID itemId = rs.getObject("id", UUID.class);
                List<PlacedOption> options = jdbc.sql("""
                        SELECT group_name_snapshot, choice_name_snapshot, price_delta_minor
                          FROM order_item_option WHERE order_item_id = :itemId
                      ORDER BY selection_number
                        """)
                    .param("itemId", itemId)
                    .query((optionRs, optionRow) -> new PlacedOption(
                        optionRs.getString("group_name_snapshot"),
                        optionRs.getString("choice_name_snapshot"),
                        optionRs.getLong("price_delta_minor")))
                    .list();
                return new PlacedLine(rs.getString("product_name_snapshot"),
                    rs.getString("variant_name_snapshot"), rs.getInt("quantity"),
                    rs.getLong("unit_price_minor"), rs.getLong("line_total_minor"), options);
            }).list();
        return new PlacedOrder(orderId, header.publicNumber(), header.status(), header.paymentMethod(),
            header.currency(), header.subtotalMinor(), header.totalMinor(), header.createdAt(),
            replayed, lines);
    }

    private String fingerprint(UUID accountId, List<CreateLine> lines) {
        StringBuilder canonical = new StringBuilder(accountId == null ? "guest" : accountId.toString());
        for (CreateLine line : lines) {
            canonical.append('|').append(line.variantId()).append(':').append(line.quantity()).append(':');
            if (line.optionChoiceIds() != null) line.optionChoiceIds().stream()
                .sorted(Comparator.comparing(UUID::toString))
                .forEach(id -> canonical.append(id).append(','));
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(canonical.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public record CreateLine(UUID variantId, int quantity, List<UUID> optionChoiceIds) { }

    @Schema(name = "GuestOrderOption")
    public record PlacedOption(String groupName, String choiceName, long priceDeltaMinor) { }

    @Schema(name = "GuestOrderLine")
    public record PlacedLine(
        String productName,
        String variantName,
        int quantity,
        long unitPriceMinor,
        long lineTotalMinor,
        List<PlacedOption> options
    ) { }

    @Schema(name = "GuestOrder")
    public record PlacedOrder(
        UUID id,
        String publicOrderNumber,
        String status,
        String paymentMethod,
        String currencyCode,
        long subtotalMinor,
        long totalMinor,
        Instant createdAt,
        boolean replayed,
        List<PlacedLine> items
    ) { }

    private record Location(UUID id, UUID organizationId, String currency) { }
    private record Account(UUID id, boolean enabled) { }
    private record Variant(String productName, String variantName, long priceMinor,
                           String currency, UUID recipeVersionId) { }
    private record Choice(UUID groupId, String groupName, int minimumSelections,
                          int maximumSelections, UUID choiceId, String choiceName,
                          UUID variantChoiceId, long priceDeltaMinor) { }
    private record Group(int minimumSelections, int maximumSelections, List<Choice> choices) { }
    private record IngredientDelta(UUID ingredientId, BigDecimal quantity) { }
    private record ResolvedLine(UUID variantId, String productName, String variantName, int quantity,
                                long unitPriceMinor, long lineTotalMinor, List<Choice> selectedChoices,
                                Map<UUID, BigDecimal> consumption) { }
    private record Existing(UUID id, String fingerprint) { }
    private record OrderHeader(String publicNumber, String status, String paymentMethod,
                               String currency, long subtotalMinor, long totalMinor,
                               Instant createdAt) { }
}
