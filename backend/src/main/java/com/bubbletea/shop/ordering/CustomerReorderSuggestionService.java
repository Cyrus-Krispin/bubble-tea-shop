package com.bubbletea.shop.ordering;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class CustomerReorderSuggestionService {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate namedJdbc;

    public CustomerReorderSuggestionService(
        JdbcTemplate jdbc,
        NamedParameterJdbcTemplate namedJdbc
    ) {
        this.jdbc = jdbc;
        this.namedJdbc = namedJdbc;
    }

    @Transactional(readOnly = true)
    public Optional<CustomerReorderSuggestion> latest(UUID authSubject, String locationSlug) {
        UUID accountId = accountId(authSubject);
        Optional<OrderHeader> latest = jdbc.query("""
            SELECT orders.id, orders.public_order_number, orders.created_at,
                   location.id AS location_id, location.public_slug AS location_slug,
                   location.name AS location_name, location.active
              FROM customer_order orders
              JOIN location ON location.id = orders.location_id
             WHERE orders.customer_account_id = ?
             ORDER BY orders.created_at DESC, orders.id DESC
             LIMIT 1
            """, (rs, rowNum) -> new OrderHeader(
                rs.getObject("id", UUID.class), rs.getString("public_order_number"),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                new CustomerOrderHistoryService.CustomerOrderLocation(
                    rs.getObject("location_id", UUID.class), rs.getString("location_slug"),
                    rs.getString("location_name")), rs.getBoolean("active")), accountId)
            .stream().findFirst();
        if (latest.isEmpty()) return Optional.empty();
        OrderHeader order = latest.get();
        if (!order.active() || !order.location().slug().equals(locationSlug)) return Optional.empty();

        int expectedLines = jdbc.queryForObject(
            "SELECT count(*) FROM order_item WHERE customer_order_id = ?", Integer.class, order.id());
        List<CurrentLine> lines = currentLines(order.id(), order.location().id());
        if (lines.isEmpty() || lines.size() != expectedLines) return Optional.empty();

        Map<UUID, List<CurrentChoice>> choicesByLine = currentChoices(order.id());
        int expectedChoices = jdbc.queryForObject("""
            SELECT count(*)
              FROM order_item_option selected
              JOIN order_item item ON item.id = selected.order_item_id
             WHERE item.customer_order_id = ?
            """, Integer.class, order.id());
        if (choicesByLine.values().stream().mapToInt(List::size).sum() != expectedChoices) {
            return Optional.empty();
        }

        Map<UUID, LinkedHashMap<UUID, SelectionBuilder>> selectionsByLine =
            currentGroups(order.id());
        for (CurrentLine line : lines) {
            LinkedHashMap<UUID, SelectionBuilder> groups = selectionsByLine.get(line.itemId());
            if (groups == null) return Optional.empty();
            for (CurrentChoice choice : choicesByLine.getOrDefault(line.itemId(), List.of())) {
                SelectionBuilder group = groups.get(choice.groupId());
                if (group == null) return Optional.empty();
                group.add(choice);
            }
            if (groups.values().stream().anyMatch(group -> !group.valid())) return Optional.empty();
        }

        if (!stockSufficient(order.location().id(), lines, choicesByLine)) return Optional.empty();

        String currency = lines.getFirst().currencyCode();
        long total = 0;
        List<CustomerReorderLine> items = new ArrayList<>();
        try {
            for (CurrentLine line : lines) {
                if (!currency.equals(line.currencyCode())) return Optional.empty();
                long unitPrice = line.basePriceMinor();
                for (CurrentChoice choice : choicesByLine.getOrDefault(line.itemId(), List.of())) {
                    unitPrice = Math.addExact(unitPrice, choice.priceDeltaMinor());
                }
                if (unitPrice < 0) return Optional.empty();
                total = Math.addExact(total, Math.multiplyExact(unitPrice, line.quantity()));
                List<CustomerReorderSelection> selections = selectionsByLine.get(line.itemId())
                    .values().stream().map(SelectionBuilder::toDto).toList();
                items.add(new CustomerReorderLine(
                    line.productSlug(), line.productName(), line.variantId(), line.variantName(),
                    line.quantity(), unitPrice, selections));
            }
        } catch (ArithmeticException exception) {
            return Optional.empty();
        }

        return Optional.of(new CustomerReorderSuggestion(
            order.id(), order.publicOrderNumber(), order.createdAt(), order.location(), currency,
            total, List.copyOf(items)));
    }

    private UUID accountId(UUID authSubject) {
        List<UUID> accounts = jdbc.query("""
            SELECT id FROM account WHERE auth_subject = ? AND enabled
            """, (rs, rowNum) -> rs.getObject("id", UUID.class), authSubject);
        if (accounts.isEmpty()) throw new CustomerAccountUnavailableException();
        return accounts.getFirst();
    }

    private List<CurrentLine> currentLines(UUID orderId, UUID locationId) {
        return jdbc.query("""
            SELECT item.id AS item_id, item.quantity, product.public_slug AS product_slug,
                   product.name AS product_name, variant.id AS variant_id,
                   variant.name AS variant_name, offering.price_minor,
                   offering.currency_code, offering.recipe_version_id
              FROM order_item item
              JOIN menu_variant variant
                ON variant.id = item.menu_variant_id
               AND variant.organization_id = item.organization_id
               AND variant.archived_at IS NULL
              JOIN menu_product product
                ON product.id = variant.menu_product_id
               AND product.organization_id = variant.organization_id
               AND product.archived_at IS NULL
               AND product.public_slug IS NOT NULL
              JOIN menu_variant_offering offering
                ON offering.menu_variant_id = variant.id
               AND offering.organization_id = variant.organization_id
               AND offering.location_id = ?
               AND offering.available
              JOIN recipe_version recipe_version
                ON recipe_version.id = offering.recipe_version_id
               AND recipe_version.organization_id = offering.organization_id
               AND recipe_version.status = 'PUBLISHED'
             WHERE item.customer_order_id = ?
             ORDER BY item.line_number
            """, (rs, rowNum) -> new CurrentLine(
                rs.getObject("item_id", UUID.class), rs.getString("product_slug"),
                rs.getString("product_name"), rs.getObject("variant_id", UUID.class),
                rs.getString("variant_name"), rs.getInt("quantity"),
                rs.getLong("price_minor"), rs.getString("currency_code"),
                rs.getObject("recipe_version_id", UUID.class)), locationId, orderId);
    }

    private Map<UUID, List<CurrentChoice>> currentChoices(UUID orderId) {
        Map<UUID, List<CurrentChoice>> result = new LinkedHashMap<>();
        jdbc.query("""
            SELECT item.id AS item_id, option_group.id AS group_id,
                   option_group.name AS group_name, choice.id AS choice_id,
                   choice.name AS choice_name, variant_choice.id AS variant_choice_id,
                   variant_choice.price_delta_minor
              FROM order_item item
              JOIN order_item_option selected ON selected.order_item_id = item.id
              JOIN menu_variant_option_choice variant_choice
                ON variant_choice.menu_variant_id = item.menu_variant_id
               AND variant_choice.option_choice_id = selected.option_choice_id
               AND variant_choice.organization_id = item.organization_id
               AND variant_choice.enabled
              JOIN option_choice choice
                ON choice.id = variant_choice.option_choice_id
               AND choice.organization_id = variant_choice.organization_id
               AND choice.archived_at IS NULL
              JOIN option_group
                ON option_group.id = choice.option_group_id
               AND option_group.organization_id = choice.organization_id
               AND option_group.archived_at IS NULL
             WHERE item.customer_order_id = ?
             ORDER BY item.line_number, option_group.display_order,
                      choice.display_order, choice.id
            """, rs -> {
                result.computeIfAbsent(rs.getObject("item_id", UUID.class),
                    ignored -> new ArrayList<>()).add(new CurrentChoice(
                    rs.getObject("group_id", UUID.class), rs.getString("group_name"),
                    rs.getObject("choice_id", UUID.class), rs.getString("choice_name"),
                    rs.getObject("variant_choice_id", UUID.class),
                    rs.getLong("price_delta_minor")));
            }, orderId);
        return result;
    }

    private Map<UUID, LinkedHashMap<UUID, SelectionBuilder>> currentGroups(UUID orderId) {
        Map<UUID, LinkedHashMap<UUID, SelectionBuilder>> result = new LinkedHashMap<>();
        jdbc.query("""
            SELECT DISTINCT item.id AS item_id, option_group.id AS group_id,
                   option_group.name AS group_name, option_group.minimum_selections,
                   option_group.maximum_selections, option_group.display_order
              FROM order_item item
              JOIN menu_variant_option_choice variant_choice
                ON variant_choice.menu_variant_id = item.menu_variant_id
               AND variant_choice.organization_id = item.organization_id
               AND variant_choice.enabled
              JOIN option_choice choice
                ON choice.id = variant_choice.option_choice_id
               AND choice.organization_id = variant_choice.organization_id
               AND choice.archived_at IS NULL
              JOIN option_group
                ON option_group.id = choice.option_group_id
               AND option_group.organization_id = choice.organization_id
               AND option_group.archived_at IS NULL
             WHERE item.customer_order_id = ?
             ORDER BY item_id, option_group.display_order, group_id
            """, rs -> {
                UUID itemId = rs.getObject("item_id", UUID.class);
                UUID groupId = rs.getObject("group_id", UUID.class);
                result.computeIfAbsent(itemId, ignored -> new LinkedHashMap<>())
                    .putIfAbsent(groupId, new SelectionBuilder(
                        groupId, rs.getString("group_name"),
                        rs.getInt("minimum_selections"), rs.getInt("maximum_selections")));
            }, orderId);
        return result;
    }

    private boolean stockSufficient(
        UUID locationId,
        List<CurrentLine> lines,
        Map<UUID, List<CurrentChoice>> choicesByLine
    ) {
        List<UUID> recipeIds = lines.stream().map(CurrentLine::recipeVersionId).distinct().toList();
        Map<UUID, List<IngredientDelta>> components = new LinkedHashMap<>();
        namedJdbc.query("""
            SELECT recipe_version_id, ingredient_id, quantity
              FROM recipe_component
             WHERE recipe_version_id IN (:recipeIds)
            """, new MapSqlParameterSource("recipeIds", recipeIds), rs -> {
                components.computeIfAbsent(rs.getObject("recipe_version_id", UUID.class),
                    ignored -> new ArrayList<>()).add(new IngredientDelta(
                        rs.getObject("ingredient_id", UUID.class), rs.getBigDecimal("quantity")));
            });

        List<UUID> linkIds = choicesByLine.values().stream().flatMap(List::stream)
            .map(CurrentChoice::variantChoiceId).toList();
        Map<UUID, List<IngredientDelta>> effects = new LinkedHashMap<>();
        if (!linkIds.isEmpty()) {
            namedJdbc.query("""
                SELECT menu_variant_option_choice_id, ingredient_id, quantity_delta
                  FROM option_choice_ingredient_effect
                 WHERE menu_variant_option_choice_id IN (:linkIds)
                """, new MapSqlParameterSource("linkIds", linkIds), rs -> {
                    effects.computeIfAbsent(
                        rs.getObject("menu_variant_option_choice_id", UUID.class),
                        ignored -> new ArrayList<>()).add(new IngredientDelta(
                            rs.getObject("ingredient_id", UUID.class),
                            rs.getBigDecimal("quantity_delta")));
                });
        }

        Map<UUID, BigDecimal> required = new LinkedHashMap<>();
        try {
            for (CurrentLine line : lines) {
                Map<UUID, BigDecimal> perUnit = new LinkedHashMap<>();
                components.getOrDefault(line.recipeVersionId(), List.of()).forEach(delta ->
                    perUnit.merge(delta.ingredientId(), delta.quantity(), BigDecimal::add));
                choicesByLine.getOrDefault(line.itemId(), List.of()).forEach(choice ->
                    effects.getOrDefault(choice.variantChoiceId(), List.of()).forEach(delta ->
                        perUnit.merge(delta.ingredientId(), delta.quantity(), BigDecimal::add)));
                perUnit.forEach((ingredientId, quantity) -> {
                    BigDecimal scaled = quantity.multiply(BigDecimal.valueOf(line.quantity()))
                        .setScale(6, RoundingMode.UNNECESSARY);
                    if (scaled.signum() < 0 || scaled.precision() > 19) throw new ArithmeticException();
                    if (scaled.signum() > 0) required.merge(ingredientId, scaled, BigDecimal::add);
                });
            }
        } catch (ArithmeticException exception) {
            return false;
        }
        if (required.isEmpty()) return true;

        Map<UUID, BigDecimal> available = new LinkedHashMap<>();
        namedJdbc.query("""
            SELECT ingredient_id, quantity
              FROM inventory_balance
             WHERE location_id = :locationId AND ingredient_id IN (:ingredientIds)
            """, new MapSqlParameterSource()
                .addValue("locationId", locationId)
                .addValue("ingredientIds", required.keySet()), rs ->
            {
                available.put(rs.getObject("ingredient_id", UUID.class),
                    rs.getBigDecimal("quantity"));
            });
        return required.entrySet().stream().allMatch(entry ->
            available.getOrDefault(entry.getKey(), BigDecimal.ZERO).compareTo(entry.getValue()) >= 0);
    }

    private record OrderHeader(
        UUID id,
        String publicOrderNumber,
        Instant createdAt,
        CustomerOrderHistoryService.CustomerOrderLocation location,
        boolean active
    ) { }

    private record CurrentLine(
        UUID itemId,
        String productSlug,
        String productName,
        UUID variantId,
        String variantName,
        int quantity,
        long basePriceMinor,
        String currencyCode,
        UUID recipeVersionId
    ) { }

    private record CurrentChoice(
        UUID groupId,
        String groupName,
        UUID choiceId,
        String choiceName,
        UUID variantChoiceId,
        long priceDeltaMinor
    ) { }

    private record IngredientDelta(UUID ingredientId, BigDecimal quantity) { }

    private static final class SelectionBuilder {
        private final UUID groupId;
        private final String groupName;
        private final int minimumSelections;
        private final int maximumSelections;
        private final List<UUID> choiceIds = new ArrayList<>();
        private final List<String> choiceNames = new ArrayList<>();

        private SelectionBuilder(
            UUID groupId,
            String groupName,
            int minimumSelections,
            int maximumSelections
        ) {
            this.groupId = groupId;
            this.groupName = groupName;
            this.minimumSelections = minimumSelections;
            this.maximumSelections = maximumSelections;
        }

        private void add(CurrentChoice choice) {
            choiceIds.add(choice.choiceId());
            choiceNames.add(choice.choiceName());
        }

        private boolean valid() {
            return choiceIds.size() >= minimumSelections && choiceIds.size() <= maximumSelections;
        }

        private CustomerReorderSelection toDto() {
            return new CustomerReorderSelection(
                groupId, groupName, List.copyOf(choiceIds), List.copyOf(choiceNames));
        }
    }

    public record CustomerReorderSuggestion(
        UUID orderId,
        String publicOrderNumber,
        Instant createdAt,
        CustomerOrderHistoryService.CustomerOrderLocation location,
        String currencyCode,
        long totalMinor,
        List<CustomerReorderLine> items
    ) { }

    public record CustomerReorderLine(
        String productSlug,
        String productName,
        UUID variantId,
        String variantName,
        int quantity,
        long unitPriceMinor,
        List<CustomerReorderSelection> selections
    ) { }

    public record CustomerReorderSelection(
        UUID groupId,
        String groupName,
        List<UUID> choiceIds,
        List<String> choiceNames
    ) { }
}
