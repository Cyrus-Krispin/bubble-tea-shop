package com.bubbletea.shop.ordering;

import com.bubbletea.shop.inventory.InsufficientStockException;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class StaffOrderOperationsService {
    private static final Logger LOGGER = LoggerFactory.getLogger(StaffOrderOperationsService.class);
    private final JdbcTemplate jdbc;
    private final OrderStaffAccessService access;
    private final OrderCompletionService completion;

    public StaffOrderOperationsService(
        JdbcTemplate jdbc,
        OrderStaffAccessService access,
        OrderCompletionService completion
    ) {
        this.jdbc = jdbc;
        this.access = access;
        this.completion = completion;
    }

    @Transactional(readOnly = true)
    public OrderPage list(
        UUID subject,
        UUID organizationId,
        UUID locationId,
        OrderStatus status,
        int page,
        int size
    ) {
        access.authorize(subject, organizationId, locationId);
        String statusClause = status == null ? "" : " AND orders.status = ?";
        List<Object> countParameters = new ArrayList<>(List.of(organizationId, locationId));
        if (status != null) countParameters.add(status.name());
        long totalItems = jdbc.queryForObject("""
            SELECT count(*)
              FROM customer_order orders
             WHERE orders.organization_id = ? AND orders.location_id = ?
            """ + statusClause, Long.class, countParameters.toArray());

        List<Object> parameters = new ArrayList<>(countParameters);
        parameters.add(size);
        parameters.add((long) page * size);
        List<OrderSummary> items = jdbc.query("""
            SELECT orders.id, orders.public_order_number, orders.status,
                   orders.payment_method, payment.status AS payment_status,
                   orders.currency_code, orders.total_minor, orders.created_at,
                   orders.completed_at,
                   COALESCE((SELECT SUM(item.quantity) FROM order_item item
                              WHERE item.customer_order_id = orders.id), 0) AS item_quantity
              FROM customer_order orders
              JOIN payment ON payment.customer_order_id = orders.id
             WHERE orders.organization_id = ? AND orders.location_id = ?
            """ + statusClause + """
             ORDER BY orders.created_at DESC, orders.id DESC
             LIMIT ? OFFSET ?
            """, (rs, rowNum) -> summary(rs), parameters.toArray());
        int totalPages = totalItems == 0 ? 0 : (int) ((totalItems + size - 1) / size);
        return new OrderPage(List.copyOf(items), page, size, totalItems, totalPages);
    }

    @Transactional(readOnly = true)
    public OrderDetail get(UUID subject, UUID organizationId, UUID locationId, UUID orderId) {
        access.authorize(subject, organizationId, locationId);
        return loadDetail(organizationId, locationId, orderId);
    }

    public OrderDetail complete(UUID subject, UUID organizationId, UUID locationId, UUID orderId) {
        UUID actorId = access.authorize(subject, organizationId, locationId);
        try {
            completion.completeScoped(orderId, organizationId, locationId, actorId);
        } catch (InsufficientStockException exception) {
            LOGGER.warn("Order completion blocked by stock shortage: orderId={}, locationId={}, ingredientCount={}",
                orderId, locationId, exception.shortages().size());
            throw shortage(exception);
        }
        OrderDetail result = loadDetail(organizationId, locationId, orderId);
        LOGGER.info("Order completion confirmed: orderId={}, locationId={}, actorAccountId={}",
            orderId, locationId, actorId);
        return result;
    }

    private OrderStockShortageException shortage(InsufficientStockException exception) {
        List<OrderStockShortageException.Shortage> shortages = new ArrayList<>();
        exception.shortages().forEach((ingredientId, shortage) -> {
            IngredientLabel label = jdbc.queryForObject("""
                SELECT name, base_unit FROM ingredient WHERE id = ?
                """, (rs, rowNum) -> new IngredientLabel(rs.getString("name"), rs.getString("base_unit")),
                ingredientId);
            shortages.add(new OrderStockShortageException.Shortage(
                ingredientId, label.name(), label.baseUnit(), decimal(shortage.required()),
                decimal(shortage.available())));
        });
        return new OrderStockShortageException(shortages);
    }

    private OrderDetail loadDetail(UUID organizationId, UUID locationId, UUID orderId) {
        List<OrderDetailHeader> headers = jdbc.query("""
            SELECT orders.id, orders.public_order_number, orders.status,
                   orders.payment_method, payment.status AS payment_status,
                   orders.currency_code, orders.subtotal_minor, orders.total_minor,
                   orders.created_at, orders.completed_at, payment.paid_at
              FROM customer_order orders
              JOIN payment ON payment.customer_order_id = orders.id
             WHERE orders.id = ? AND orders.organization_id = ? AND orders.location_id = ?
            """, (rs, rowNum) -> new OrderDetailHeader(
                rs.getObject("id", UUID.class), rs.getString("public_order_number"),
                OrderStatus.valueOf(rs.getString("status")), rs.getString("payment_method"),
                rs.getString("payment_status"), rs.getString("currency_code"),
                rs.getLong("subtotal_minor"), rs.getLong("total_minor"),
                rs.getObject("created_at", java.time.OffsetDateTime.class).toInstant(),
                instant(rs, "completed_at"), instant(rs, "paid_at")),
            orderId, organizationId, locationId);
        if (headers.isEmpty()) throw new OrderNotFoundException(orderId);

        Map<UUID, List<OrderOption>> options = new LinkedHashMap<>();
        jdbc.query("""
            SELECT item.id AS item_id, selected.selection_number,
                   selected.group_name_snapshot, selected.choice_name_snapshot,
                   selected.price_delta_minor
              FROM order_item item
              JOIN order_item_option selected ON selected.order_item_id = item.id
             WHERE item.customer_order_id = ?
             ORDER BY item.line_number, selected.selection_number
            """, rs -> {
                UUID itemId = rs.getObject("item_id", UUID.class);
                options.computeIfAbsent(itemId, ignored -> new ArrayList<>()).add(new OrderOption(
                    rs.getInt("selection_number"), rs.getString("group_name_snapshot"),
                    rs.getString("choice_name_snapshot"), rs.getLong("price_delta_minor")));
            }, orderId);
        List<OrderLine> lines = jdbc.query("""
            SELECT id, line_number, product_name_snapshot, variant_name_snapshot,
                   quantity, unit_price_minor, line_total_minor
              FROM order_item
             WHERE customer_order_id = ?
             ORDER BY line_number
            """, (rs, rowNum) -> {
                UUID itemId = rs.getObject("id", UUID.class);
                return new OrderLine(rs.getInt("line_number"), rs.getString("product_name_snapshot"),
                    rs.getString("variant_name_snapshot"), rs.getInt("quantity"),
                    rs.getLong("unit_price_minor"), rs.getLong("line_total_minor"),
                    List.copyOf(options.getOrDefault(itemId, List.of())));
            }, orderId);
        List<StockRequirement> requirements = jdbc.query("""
            SELECT ingredient.id, ingredient.name, ingredient.base_unit,
                   SUM(consumption.quantity) AS required_quantity,
                   COALESCE(balance.quantity, 0) AS available_quantity
              FROM order_item_consumption consumption
              JOIN order_item item ON item.id = consumption.order_item_id
              JOIN ingredient ON ingredient.id = consumption.ingredient_id
         LEFT JOIN inventory_balance balance
                ON balance.location_id = ? AND balance.ingredient_id = ingredient.id
             WHERE item.customer_order_id = ?
             GROUP BY ingredient.id, ingredient.name, ingredient.base_unit, balance.quantity
             ORDER BY lower(ingredient.name), ingredient.id
            """, (rs, rowNum) -> {
                BigDecimal required = rs.getBigDecimal("required_quantity");
                BigDecimal available = rs.getBigDecimal("available_quantity");
                return new StockRequirement(rs.getObject("id", UUID.class), rs.getString("name"),
                    rs.getString("base_unit"), decimal(required), decimal(available),
                    available.compareTo(required) >= 0);
            }, locationId, orderId);

        OrderDetailHeader header = headers.getFirst();
        return new OrderDetail(header.id(), header.publicOrderNumber(), header.status(),
            header.paymentMethod(), header.paymentStatus(), header.currencyCode(),
            header.subtotalMinor(), header.totalMinor(), header.createdAt(), header.completedAt(),
            header.paidAt(), List.copyOf(lines), List.copyOf(requirements));
    }

    private static OrderSummary summary(ResultSet rs) throws SQLException {
        return new OrderSummary(rs.getObject("id", UUID.class), rs.getString("public_order_number"),
            OrderStatus.valueOf(rs.getString("status")), rs.getString("payment_method"),
            rs.getString("payment_status"), rs.getString("currency_code"),
            rs.getLong("total_minor"), rs.getInt("item_quantity"),
            rs.getObject("created_at", java.time.OffsetDateTime.class).toInstant(),
            instant(rs, "completed_at"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        java.time.OffsetDateTime value = rs.getObject(column, java.time.OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private static String decimal(BigDecimal value) {
        return value.setScale(6).toPlainString();
    }

    private record IngredientLabel(String name, String baseUnit) { }
    private record OrderDetailHeader(UUID id, String publicOrderNumber, OrderStatus status,
                                     String paymentMethod, String paymentStatus, String currencyCode,
                                     long subtotalMinor, long totalMinor, Instant createdAt,
                                     Instant completedAt, Instant paidAt) { }

    public record OrderPage(List<OrderSummary> items, int page, int size,
                            long totalItems, int totalPages) { }
    public record OrderSummary(UUID id, String publicOrderNumber, OrderStatus status,
                               String paymentMethod, String paymentStatus, String currencyCode,
                               long totalMinor, int itemQuantity, Instant createdAt,
                               @Schema(nullable = true) Instant completedAt) { }
    public record OrderDetail(UUID id, String publicOrderNumber, OrderStatus status,
                              String paymentMethod, String paymentStatus, String currencyCode,
                              long subtotalMinor, long totalMinor, Instant createdAt,
                              @Schema(nullable = true) Instant completedAt,
                              @Schema(nullable = true) Instant paidAt, List<OrderLine> lines,
                              List<StockRequirement> requirements) { }
    public record OrderLine(int lineNumber, String productName, String variantName, int quantity,
                            long unitPriceMinor, long lineTotalMinor, List<OrderOption> options) { }
    public record OrderOption(int selectionNumber, String groupName, String choiceName,
                              long priceDeltaMinor) { }
    public record StockRequirement(UUID ingredientId, String ingredientName, String baseUnit,
                                   String requiredQuantity, String availableQuantity,
                                   boolean sufficient) { }
}
