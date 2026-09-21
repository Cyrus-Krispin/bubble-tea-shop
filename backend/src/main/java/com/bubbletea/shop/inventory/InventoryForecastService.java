package com.bubbletea.shop.inventory;

import com.bubbletea.shop.catalog.BaseUnit;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class InventoryForecastService {
    private static final int ALERT_HORIZON_DAYS = 7;
    private static final String ROWS = """
        WITH forecast_rows AS (

            WITH observed AS (
                SELECT i.id, i.name, i.base_unit, i.reorder_threshold,
                       coalesce(b.quantity, 0) AS quantity, l.timezone,
                       (now() AT TIME ZONE l.timezone)::date AS end_day,
                       greatest((now() AT TIME ZONE l.timezone)::date - 30,
                           (greatest(i.created_at, l.created_at) AT TIME ZONE l.timezone)::date + 1) AS start_day
                  FROM ingredient i
                  JOIN location l ON l.organization_id = i.organization_id AND l.id = :loc
                  LEFT JOIN inventory_balance b ON b.location_id = l.id AND b.ingredient_id = i.id
                 WHERE i.organization_id = :org AND i.archived_at IS NULL
            )
            SELECT observed.*, greatest(0, end_day - start_day) AS observed_days,
                   coalesce(sales.consumed, 0) AS consumed
              FROM observed
              LEFT JOIN LATERAL (
                  SELECT sum(-m.quantity_delta) AS consumed
                    FROM inventory_movement m
                    JOIN customer_order o ON o.id = m.customer_order_id AND o.status = 'COMPLETED'
                   WHERE m.organization_id = :org AND m.location_id = :loc AND m.ingredient_id = observed.id
                     AND m.movement_type = 'SALE'
                     AND m.created_at >= (observed.start_day::timestamp AT TIME ZONE observed.timezone)
                     AND m.created_at < (observed.end_day::timestamp AT TIME ZONE observed.timezone)
              ) sales ON true
        )
        """;
    private final JdbcClient jdbc;
    private final InventoryStaffAccessService access;

    InventoryForecastService(JdbcClient jdbc, InventoryStaffAccessService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ForecastPage forecasts(UUID subject, UUID organizationId, UUID locationId, int page, int size) {
        return load(subject, organizationId, locationId, page, size, Selection.ALL);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AlertSummary alerts(UUID subject, UUID organizationId, UUID locationId) {
        ForecastPage page = load(subject, organizationId, locationId, 0, 5, Selection.PROJECTED);
        return new AlertSummary(page.items(), page.totalItems(), ALERT_HORIZON_DAYS, page.calculatedAt());
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ForecastPage reorder(UUID subject, UUID organizationId, UUID locationId, int page, int size) {
        return load(subject, organizationId, locationId, page, size, Selection.REORDER);
    }

    private enum Selection { ALL, PROJECTED, REORDER }

    private ForecastPage load(UUID subject, UUID organizationId, UUID locationId, int page, int size, Selection selection) {
        if (page < 0 || size < 1 || size > 100) throw new InvalidInventoryException();
        access.authorize(subject, organizationId, locationId);
        Instant asOf = jdbc.sql("SELECT now()").query(Timestamp.class).single().toInstant();
        String filter = switch (selection) {
            case ALL -> " WHERE :horizon > 0";
            case PROJECTED -> " WHERE quantity = 0 OR (observed_days > 0 AND consumed > 0 AND quantity * observed_days <= consumed * :horizon)";
            case REORDER -> " WHERE quantity = 0 OR quantity <= reorder_threshold OR (observed_days > 0 AND consumed > 0 AND quantity * observed_days <= consumed * :horizon)";
        };
        long total = jdbc.sql(ROWS + " SELECT count(*) FROM forecast_rows" + filter)
            .param("org", organizationId).param("loc", locationId).param("horizon", ALERT_HORIZON_DAYS)
            .query(Long.class).single();
        List<Forecast> items = jdbc.sql(ROWS + " SELECT * FROM forecast_rows" + filter
            + " ORDER BY CASE WHEN quantity = 0 THEN 0 ELSE 1 END, quantity * observed_days / nullif(consumed, 0), lower(name), id LIMIT :size OFFSET :offset")
            .param("org", organizationId).param("loc", locationId).param("horizon", ALERT_HORIZON_DAYS)
            .param("size", size).param("offset", (long) page * size)
            .query((rs, row) -> calculate(rs.getObject("id", UUID.class), rs.getString("name"),
                BaseUnit.valueOf(rs.getString("base_unit")), rs.getBigDecimal("quantity"),
                rs.getBigDecimal("reorder_threshold"), rs.getBigDecimal("consumed"), rs.getInt("observed_days")))
            .list();
        return new ForecastPage(items, page, size, total, (total + size - 1) / size, asOf);
    }

    static Forecast calculate(UUID id, String name, BaseUnit unit, BigDecimal quantity,
                              BigDecimal threshold, BigDecimal consumed, int days) {
        BigDecimal rate = days == 0 ? null : consumed.divide(BigDecimal.valueOf(days), 12, RoundingMode.HALF_UP);
        String status = quantity.signum() == 0 ? "OUT_OF_STOCK" : days == 0 ? "INSUFFICIENT_HISTORY"
            : consumed.signum() == 0 ? "NO_OBSERVED_DEMAND" : "ESTIMATED";
        // Divide by the unrounded consumption total, so very small rates cannot round to zero.
        BigDecimal remaining = quantity.signum() == 0 ? BigDecimal.ZERO
            : days == 0 || consumed.signum() == 0 ? null
            : quantity.multiply(BigDecimal.valueOf(days)).divide(consumed, 2, RoundingMode.DOWN);
        boolean belowThreshold = threshold != null && quantity.compareTo(threshold) <= 0;
        boolean projected = days > 0 && consumed.signum() > 0
            && quantity.multiply(BigDecimal.valueOf(days)).compareTo(consumed.multiply(BigDecimal.valueOf(ALERT_HORIZON_DAYS))) <= 0;
        String reason = quantity.signum() == 0 ? "OUT_OF_STOCK" : belowThreshold && projected ? "BOTH"
            : belowThreshold ? "THRESHOLD" : projected ? "PROJECTED" : "NONE";
        return new Forecast(id, name, unit, decimal(quantity), decimal(threshold), decimal(rate),
            decimal(remaining), days, status, reason);
    }

    private static String decimal(BigDecimal number) {
        return number == null ? null : number.stripTrailingZeros().toPlainString();
    }

    @Schema(name = "InventoryForecast")
    public record Forecast(UUID ingredientId, String ingredientName, BaseUnit baseUnit, String quantity,
                           @Schema(nullable = true) String reorderThreshold,
                           @Schema(nullable = true) String dailyConsumption,
                           @Schema(nullable = true) String daysRemaining,
                           int observedDays, String status, String reorderReason) { }

    @Schema(name = "InventoryAlertSummary")
    public record AlertSummary(List<Forecast> items, long totalItems, int horizonDays, Instant calculatedAt) { }

    @Schema(name = "InventoryForecastPage")
    public record ForecastPage(List<Forecast> items, int page, int size, long totalItems,
                               long totalPages, Instant calculatedAt) { }
}
