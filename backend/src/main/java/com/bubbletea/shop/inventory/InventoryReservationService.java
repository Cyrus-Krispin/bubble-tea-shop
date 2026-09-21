package com.bubbletea.shop.inventory;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** All writers serialize through the balance rows, in ingredient UUID order. */
@Service
public class InventoryReservationService {
    private final JdbcTemplate jdbc;
    public InventoryReservationService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public void reserve(UUID order, UUID organization, UUID location, Map<UUID, BigDecimal> demand) {
        if (demand.isEmpty() || demand.values().stream().anyMatch(q -> q.signum() <= 0)) {
            throw new IllegalArgumentException("Reservation must have positive demand");
        }
        var shortages = new LinkedHashMap<UUID, InsufficientStockException.StockShortage>();
        // PostgreSQL UUID ordering is unsigned, unlike UUID.compareTo.
        for (UUID ingredient : demand.keySet().stream().sorted(java.util.Comparator.comparing(UUID::toString)).toList()) {
            jdbc.update("""
                INSERT INTO inventory_balance (organization_id, location_id, ingredient_id, quantity, version)
                VALUES (?, ?, ?, 0, 0) ON CONFLICT (location_id, ingredient_id) DO NOTHING
                """, organization, location, ingredient);
            BigDecimal balance = jdbc.queryForObject("SELECT quantity FROM inventory_balance WHERE location_id = ? AND ingredient_id = ? FOR UPDATE",
                BigDecimal.class, location, ingredient);
            BigDecimal available = balance.subtract(reserved(location, ingredient, null));
            if (available.compareTo(demand.get(ingredient)) < 0) {
                shortages.put(ingredient, new InsufficientStockException.StockShortage(demand.get(ingredient), available));
            }
        }
        if (!shortages.isEmpty()) throw new InsufficientStockException(shortages);
        demand.forEach((ingredient, quantity) -> jdbc.update("""
            INSERT INTO inventory_reservation (customer_order_id, organization_id, location_id, ingredient_id, quantity)
            VALUES (?, ?, ?, ?, ?)
            """, order, organization, location, ingredient, quantity));
    }

    public BigDecimal reserved(UUID location, UUID ingredient, UUID excludeOrder) {
        return jdbc.queryForObject("""
            SELECT COALESCE(SUM(quantity), 0) FROM inventory_reservation
             WHERE location_id = ? AND ingredient_id = ? AND active
               AND (?::uuid IS NULL OR customer_order_id <> ?)
            """, BigDecimal.class, location, ingredient, excludeOrder, excludeOrder);
    }

    @Transactional
    public void release(UUID order) {
        jdbc.query("""
            SELECT b.ingredient_id FROM inventory_balance b
            JOIN inventory_reservation r ON r.location_id = b.location_id AND r.ingredient_id = b.ingredient_id
            WHERE r.customer_order_id = ? AND r.active ORDER BY b.ingredient_id FOR UPDATE OF b
            """, (rs, row) -> rs.getObject(1, UUID.class), order);
        jdbc.update("UPDATE inventory_reservation SET active = false, released_at = now() WHERE customer_order_id = ? AND active", order);
    }

    public boolean covers(UUID order, UUID ingredient, BigDecimal quantity) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM inventory_reservation
                WHERE customer_order_id = ? AND ingredient_id = ? AND active AND quantity = ?)
            """, Boolean.class, order, ingredient, quantity));
    }
}
