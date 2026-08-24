package com.bubbletea.shop.ordering;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CustomerOrderHistoryService {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate namedJdbc;

    public CustomerOrderHistoryService(
        JdbcTemplate jdbc,
        NamedParameterJdbcTemplate namedJdbc
    ) {
        this.jdbc = jdbc;
        this.namedJdbc = namedJdbc;
    }

    @Transactional(readOnly = true)
    public CustomerOrderPage list(UUID authSubject, int page, int size) {
        UUID accountId = accountId(authSubject);
        long totalItems = jdbc.queryForObject("""
            SELECT count(*) FROM customer_order WHERE customer_account_id = ?
            """, Long.class, accountId);

        List<SummaryHeader> headers = jdbc.query("""
            SELECT orders.id, orders.public_order_number, orders.status, orders.payment_method,
                   orders.currency_code, orders.total_minor, orders.created_at,
                   orders.completed_at, orders.cancelled_at,
                   location.id AS location_id, location.public_slug AS location_slug,
                   location.name AS location_name,
                   COALESCE((SELECT SUM(item.quantity) FROM order_item item
                              WHERE item.customer_order_id = orders.id), 0) AS item_quantity
              FROM customer_order orders
              JOIN location ON location.id = orders.location_id
             WHERE orders.customer_account_id = ?
             ORDER BY orders.created_at DESC, orders.id DESC
             LIMIT ? OFFSET ?
            """, (rs, rowNum) -> new SummaryHeader(
                rs.getObject("id", UUID.class), rs.getString("public_order_number"),
                OrderStatus.valueOf(rs.getString("status")), rs.getString("payment_method"),
                rs.getString("currency_code"), rs.getLong("total_minor"),
                rs.getInt("item_quantity"), instant(rs, "created_at"),
                nullableInstant(rs, "completed_at"), nullableInstant(rs, "cancelled_at"),
                location(rs)), accountId, size, (long) page * size);

        Map<UUID, List<CustomerOrderItemSummary>> previews = previewItems(
            headers.stream().map(SummaryHeader::id).toList());
        List<CustomerOrderSummary> items = headers.stream().map(header -> new CustomerOrderSummary(
            header.id(), header.publicOrderNumber(), header.status(), header.paymentMethod(),
            header.currencyCode(), header.totalMinor(), header.itemQuantity(), header.createdAt(),
            header.completedAt(), header.cancelledAt(), header.location(),
            List.copyOf(previews.getOrDefault(header.id(), List.of())))).toList();
        int totalPages = totalItems == 0 ? 0 : (int) ((totalItems + size - 1) / size);
        return new CustomerOrderPage(items, page, size, totalItems, totalPages);
    }

    @Transactional(readOnly = true)
    public CustomerOrderDetail get(UUID authSubject, UUID orderId) {
        UUID accountId = accountId(authSubject);
        List<DetailHeader> headers = jdbc.query("""
            SELECT orders.id, orders.public_order_number, orders.status, orders.payment_method,
                   orders.currency_code, orders.subtotal_minor, orders.total_minor,
                   orders.created_at, orders.completed_at, orders.cancelled_at,
                   location.id AS location_id, location.public_slug AS location_slug,
                   location.name AS location_name
              FROM customer_order orders
              JOIN location ON location.id = orders.location_id
             WHERE orders.id = ? AND orders.customer_account_id = ?
            """, (rs, rowNum) -> new DetailHeader(
                rs.getObject("id", UUID.class), rs.getString("public_order_number"),
                OrderStatus.valueOf(rs.getString("status")), rs.getString("payment_method"),
                rs.getString("currency_code"), rs.getLong("subtotal_minor"),
                rs.getLong("total_minor"), instant(rs, "created_at"),
                nullableInstant(rs, "completed_at"), nullableInstant(rs, "cancelled_at"),
                location(rs)), orderId, accountId);
        if (headers.isEmpty()) throw new CustomerOrderNotFoundException();

        Map<UUID, List<CustomerOrderOption>> options = new LinkedHashMap<>();
        jdbc.query("""
            SELECT item.id AS item_id, selected.selection_number,
                   selected.group_name_snapshot, selected.choice_name_snapshot,
                   selected.price_delta_minor
              FROM order_item item
              JOIN order_item_option selected ON selected.order_item_id = item.id
             WHERE item.customer_order_id = ?
             ORDER BY item.line_number, selected.selection_number
            """, rs -> {
                options.computeIfAbsent(rs.getObject("item_id", UUID.class),
                    ignored -> new ArrayList<>()).add(new CustomerOrderOption(
                    rs.getInt("selection_number"), rs.getString("group_name_snapshot"),
                    rs.getString("choice_name_snapshot"), rs.getLong("price_delta_minor")));
            },
            orderId);
        List<CustomerOrderLine> items = jdbc.query("""
            SELECT id, line_number, product_name_snapshot, variant_name_snapshot,
                   quantity, unit_price_minor, line_total_minor
              FROM order_item
             WHERE customer_order_id = ?
             ORDER BY line_number
            """, (rs, rowNum) -> {
                UUID itemId = rs.getObject("id", UUID.class);
                return new CustomerOrderLine(
                    rs.getInt("line_number"), rs.getString("product_name_snapshot"),
                    rs.getString("variant_name_snapshot"), rs.getInt("quantity"),
                    rs.getLong("unit_price_minor"), rs.getLong("line_total_minor"),
                    List.copyOf(options.getOrDefault(itemId, List.of())));
            }, orderId);

        DetailHeader header = headers.getFirst();
        return new CustomerOrderDetail(
            header.id(), header.publicOrderNumber(), header.status(), header.paymentMethod(),
            header.currencyCode(), header.subtotalMinor(), header.totalMinor(), header.createdAt(),
            header.completedAt(), header.cancelledAt(), header.location(), List.copyOf(items));
    }

    private UUID accountId(UUID authSubject) {
        List<UUID> accounts = jdbc.query("""
            SELECT id FROM account WHERE auth_subject = ? AND enabled
            """, (rs, rowNum) -> rs.getObject("id", UUID.class), authSubject);
        if (accounts.isEmpty()) throw new CustomerAccountUnavailableException();
        return accounts.getFirst();
    }

    private Map<UUID, List<CustomerOrderItemSummary>> previewItems(List<UUID> orderIds) {
        if (orderIds.isEmpty()) return Map.of();
        Map<UUID, List<CustomerOrderItemSummary>> previews = new LinkedHashMap<>();
        namedJdbc.query("""
            SELECT customer_order_id, product_name_snapshot, variant_name_snapshot, quantity
              FROM order_item
             WHERE customer_order_id IN (:orderIds)
             ORDER BY customer_order_id, line_number
            """, new MapSqlParameterSource("orderIds", orderIds), rs -> {
                UUID orderId = rs.getObject("customer_order_id", UUID.class);
                previews.computeIfAbsent(orderId, ignored -> new ArrayList<>())
                    .add(new CustomerOrderItemSummary(
                        rs.getString("product_name_snapshot"),
                        rs.getString("variant_name_snapshot"), rs.getInt("quantity")));
            });
        return previews;
    }

    private static CustomerOrderLocation location(ResultSet rs) throws SQLException {
        return new CustomerOrderLocation(rs.getObject("location_id", UUID.class),
            rs.getString("location_slug"), rs.getString("location_name"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, OffsetDateTime.class).toInstant();
    }

    private static Instant nullableInstant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private record SummaryHeader(
        UUID id,
        String publicOrderNumber,
        OrderStatus status,
        String paymentMethod,
        String currencyCode,
        long totalMinor,
        int itemQuantity,
        Instant createdAt,
        Instant completedAt,
        Instant cancelledAt,
        CustomerOrderLocation location
    ) { }

    private record DetailHeader(
        UUID id,
        String publicOrderNumber,
        OrderStatus status,
        String paymentMethod,
        String currencyCode,
        long subtotalMinor,
        long totalMinor,
        Instant createdAt,
        Instant completedAt,
        Instant cancelledAt,
        CustomerOrderLocation location
    ) { }

    public record CustomerOrderPage(
        List<CustomerOrderSummary> items,
        int page,
        int size,
        long totalItems,
        int totalPages
    ) { }

    public record CustomerOrderSummary(
        UUID id,
        String publicOrderNumber,
        OrderStatus status,
        String paymentMethod,
        String currencyCode,
        long totalMinor,
        int itemQuantity,
        Instant createdAt,
        @Schema(nullable = true) Instant completedAt,
        @Schema(nullable = true) Instant cancelledAt,
        CustomerOrderLocation location,
        List<CustomerOrderItemSummary> items
    ) { }

    public record CustomerOrderLocation(UUID id, String slug, String name) { }

    public record CustomerOrderItemSummary(
        String productName,
        String variantName,
        int quantity
    ) { }

    public record CustomerOrderDetail(
        UUID id,
        String publicOrderNumber,
        OrderStatus status,
        String paymentMethod,
        String currencyCode,
        long subtotalMinor,
        long totalMinor,
        Instant createdAt,
        @Schema(nullable = true) Instant completedAt,
        @Schema(nullable = true) Instant cancelledAt,
        CustomerOrderLocation location,
        List<CustomerOrderLine> items
    ) { }

    public record CustomerOrderLine(
        int lineNumber,
        String productName,
        String variantName,
        int quantity,
        long unitPriceMinor,
        long lineTotalMinor,
        List<CustomerOrderOption> options
    ) { }

    public record CustomerOrderOption(
        int selectionNumber,
        String groupName,
        String choiceName,
        long priceDeltaMinor
    ) { }
}
