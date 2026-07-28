package com.bubbletea.shop.ordering;

import com.bubbletea.shop.inventory.InsufficientStockException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OrderCompletionService {
    private final JdbcTemplate jdbc;

    public OrderCompletionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public CompletionResult complete(UUID orderId, UUID actorAccountId) {
        OrderRecord order = findAndLockOrder(orderId);
        if (order.status() == OrderStatus.COMPLETED) {
            return new CompletionResult(orderId, true);
        }
        if (order.status() != OrderStatus.PENDING) {
            throw new InvalidOrderTransitionException(orderId, order.status());
        }

        List<Consumption> consumption = loadConsumption(orderId);
        Map<UUID, BigDecimal> available = lockBalances(order.locationId(), consumption);
        Map<UUID, InsufficientStockException.StockShortage> shortages = findShortages(consumption, available);
        if (!shortages.isEmpty()) {
            throw new InsufficientStockException(shortages);
        }

        for (Consumption item : consumption) {
            jdbc.update("""
                UPDATE inventory_balance
                   SET quantity = quantity - ?, version = version + 1, updated_at = now()
                 WHERE location_id = ? AND ingredient_id = ?
                """,
                item.quantity(), order.locationId(), item.ingredientId());

            jdbc.update("""
                INSERT INTO inventory_movement (
                    id, organization_id, location_id, ingredient_id, movement_type,
                    quantity_delta, customer_order_id, actor_account_id, source_reference
                )
                VALUES (?, ?, ?, ?, 'SALE', ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                order.organizationId(),
                order.locationId(),
                item.ingredientId(),
                item.quantity().negate(),
                orderId,
                actorAccountId,
                order.publicOrderNumber());
        }

        int changed = jdbc.update("""
            UPDATE customer_order
               SET status = 'COMPLETED', completed_at = now(), updated_at = now()
             WHERE id = ? AND status = 'PENDING'
            """,
            orderId);
        if (changed != 1) {
            throw new InvalidOrderTransitionException(orderId, order.status());
        }

        jdbc.update("""
            INSERT INTO order_status_history (
                id, organization_id, customer_order_id, from_status, to_status,
                changed_by_account_id
            )
            VALUES (?, ?, ?, 'PENDING', 'COMPLETED', ?)
            """,
            UUID.randomUUID(), order.organizationId(), orderId, actorAccountId);

        return new CompletionResult(orderId, false);
    }

    private OrderRecord findAndLockOrder(UUID orderId) {
        List<OrderRecord> orders = jdbc.query("""
            SELECT organization_id, location_id, public_order_number, status
              FROM customer_order
             WHERE id = ?
             FOR UPDATE
            """,
            (rs, rowNum) -> new OrderRecord(
                rs.getObject("organization_id", UUID.class),
                rs.getObject("location_id", UUID.class),
                rs.getString("public_order_number"),
                OrderStatus.valueOf(rs.getString("status"))),
            orderId);
        if (orders.isEmpty()) {
            throw new OrderNotFoundException(orderId);
        }
        return orders.getFirst();
    }

    private List<Consumption> loadConsumption(UUID orderId) {
        return jdbc.query("""
            SELECT consumption.ingredient_id, SUM(consumption.quantity) AS quantity
              FROM order_item_consumption consumption
              JOIN order_item item ON item.id = consumption.order_item_id
             WHERE item.customer_order_id = ?
             GROUP BY consumption.ingredient_id
             ORDER BY consumption.ingredient_id
            """,
            (rs, rowNum) -> new Consumption(
                rs.getObject("ingredient_id", UUID.class),
                rs.getBigDecimal("quantity")),
            orderId);
    }

    private Map<UUID, BigDecimal> lockBalances(UUID locationId, List<Consumption> consumption) {
        if (consumption.isEmpty()) {
            return Map.of();
        }

        String placeholders = consumption.stream().map(ignored -> "?").collect(Collectors.joining(","));
        List<Object> parameters = new ArrayList<>();
        parameters.add(locationId);
        consumption.forEach(item -> parameters.add(item.ingredientId()));

        return jdbc.query("""
                SELECT ingredient_id, quantity
                  FROM inventory_balance
                 WHERE location_id = ?
                   AND ingredient_id IN (%s)
                 ORDER BY ingredient_id
                 FOR UPDATE
                """.formatted(placeholders),
            rs -> {
                Map<UUID, BigDecimal> balances = new LinkedHashMap<>();
                while (rs.next()) {
                    balances.put(
                        rs.getObject("ingredient_id", UUID.class),
                        rs.getBigDecimal("quantity"));
                }
                return balances;
            },
            parameters.toArray());
    }

    private static Map<UUID, InsufficientStockException.StockShortage> findShortages(
        List<Consumption> consumption,
        Map<UUID, BigDecimal> available
    ) {
        Map<UUID, InsufficientStockException.StockShortage> shortages = new LinkedHashMap<>();
        for (Consumption item : consumption) {
            BigDecimal availableQuantity = available.getOrDefault(item.ingredientId(), BigDecimal.ZERO);
            if (availableQuantity.compareTo(item.quantity()) < 0) {
                shortages.put(
                    item.ingredientId(),
                    new InsufficientStockException.StockShortage(item.quantity(), availableQuantity));
            }
        }
        return shortages;
    }

    private record OrderRecord(
        UUID organizationId,
        UUID locationId,
        String publicOrderNumber,
        OrderStatus status
    ) {
    }

    private record Consumption(UUID ingredientId, BigDecimal quantity) {
    }

    public record CompletionResult(UUID orderId, boolean alreadyCompleted) {
    }
}

