package com.bubbletea.shop.inventory;

import com.bubbletea.shop.catalog.BaseUnit;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class InventoryManagementService {
    private final JdbcClient jdbc;
    private final InventoryLedgerService ledger;
    private final InventoryStaffAccessService access;

    public InventoryManagementService(
        JdbcClient jdbc,
        InventoryLedgerService ledger,
        InventoryStaffAccessService access
    ) {
        this.jdbc = jdbc;
        this.ledger = ledger;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public BalancePage listBalances(
        UUID subject,
        UUID organizationId,
        UUID locationId,
        int page,
        int size,
        String query,
        boolean includeArchived
    ) {
        access.authorize(subject, organizationId, locationId);
        String pattern = query == null || query.isBlank()
            ? null : "%" + escapeLike(query.trim().toLowerCase(Locale.ROOT)) + "%";
        long total = jdbc.sql("""
                SELECT count(*)
                  FROM ingredient
                 WHERE organization_id = :organizationId
                   AND (:includeArchived OR archived_at IS NULL)
                   AND (:query IS NULL OR lower(name) LIKE :query ESCAPE '\\'
                        OR lower(coalesce(sku, '')) LIKE :query ESCAPE '\\')
                """)
            .param("organizationId", organizationId)
            .param("includeArchived", includeArchived)
            .param("query", pattern, Types.VARCHAR)
            .query(Long.class).single();
        List<Balance> items = jdbc.sql("""
                SELECT ingredient.id AS ingredient_id, ingredient.name AS ingredient_name,
                       ingredient.sku, ingredient.base_unit, ingredient.reorder_threshold,
                       ingredient.archived_at, coalesce(balance.quantity, 0) AS quantity,
                       coalesce(balance.version, 0) AS balance_version, balance.updated_at,
                       EXISTS (
                           SELECT 1 FROM inventory_movement opening
                            WHERE opening.location_id = :locationId
                              AND opening.ingredient_id = ingredient.id
                              AND opening.movement_type = 'OPENING'
                       ) AS opening_recorded
                  FROM ingredient
             LEFT JOIN inventory_balance balance
                    ON balance.organization_id = ingredient.organization_id
                   AND balance.location_id = :locationId
                   AND balance.ingredient_id = ingredient.id
                 WHERE ingredient.organization_id = :organizationId
                   AND (:includeArchived OR ingredient.archived_at IS NULL)
                   AND (:query IS NULL OR lower(ingredient.name) LIKE :query ESCAPE '\\'
                        OR lower(coalesce(ingredient.sku, '')) LIKE :query ESCAPE '\\')
              ORDER BY lower(ingredient.name), ingredient.id
                 LIMIT :size OFFSET :offset
                """)
            .param("organizationId", organizationId)
            .param("locationId", locationId)
            .param("includeArchived", includeArchived)
            .param("query", pattern, Types.VARCHAR)
            .param("size", size)
            .param("offset", (long) page * size)
            .query(this::mapBalance).list();
        return new BalancePage(items, page, size, total,
            total == 0 ? 0 : (total + size - 1) / size);
    }

    @Transactional(readOnly = true)
    public MovementPage listMovements(
        UUID subject,
        UUID organizationId,
        UUID locationId,
        int page,
        int size,
        UUID ingredientId,
        InventoryMovementType movementType
    ) {
        access.authorize(subject, organizationId, locationId);
        if (ingredientId != null) requireIngredient(organizationId, ingredientId, false);
        long total = jdbc.sql("""
                SELECT count(*) FROM inventory_movement
                 WHERE organization_id = :organizationId AND location_id = :locationId
                   AND (:ingredientId IS NULL OR ingredient_id = :ingredientId)
                   AND (:movementType IS NULL OR movement_type = :movementType)
                """)
            .param("organizationId", organizationId).param("locationId", locationId)
            .param("ingredientId", ingredientId, Types.OTHER)
            .param("movementType", movementType == null ? null : movementType.name(), Types.VARCHAR)
            .query(Long.class).single();
        List<Movement> items = jdbc.sql("""
                SELECT movement.id, movement.ingredient_id, ingredient.name AS ingredient_name,
                       ingredient.base_unit, movement.movement_type, movement.quantity_delta,
                       movement.customer_order_id, movement.source_reference, movement.note,
                       movement.total_cost_minor, movement.currency_code, movement.created_at
                  FROM inventory_movement movement
                  JOIN ingredient ON ingredient.id = movement.ingredient_id
                                 AND ingredient.organization_id = movement.organization_id
                 WHERE movement.organization_id = :organizationId
                   AND movement.location_id = :locationId
                   AND (:ingredientId IS NULL OR movement.ingredient_id = :ingredientId)
                   AND (:movementType IS NULL OR movement.movement_type = :movementType)
              ORDER BY movement.created_at DESC, movement.id DESC
                 LIMIT :size OFFSET :offset
                """)
            .param("organizationId", organizationId).param("locationId", locationId)
            .param("ingredientId", ingredientId, Types.OTHER)
            .param("movementType", movementType == null ? null : movementType.name(), Types.VARCHAR)
            .param("size", size).param("offset", (long) page * size)
            .query(this::mapMovement).list();
        return new MovementPage(items, page, size, total,
            total == 0 ? 0 : (total + size - 1) / size);
    }

    @Transactional
    public Movement record(
        UUID subject,
        UUID organizationId,
        UUID locationId,
        CreateMovement command
    ) {
        InventoryStaffAccessService.AuthorizedLocation authorized =
            access.authorize(subject, organizationId, locationId);
        requireIngredient(organizationId, command.ingredientId(), true);
        BigDecimal quantity = normalizeQuantity(command.quantityDelta());
        validate(command, quantity);
        String sourceReference = trimToNull(command.sourceReference());
        String note = trimToNull(command.note());
        String currency = command.totalCostMinor() == null ? null : authorized.currencyCode();
        UUID movementId;
        try {
            movementId = ledger.recordManualMovement(new InventoryLedgerService.ManualMovement(
                organizationId, locationId, command.ingredientId(),
                InventoryMovementType.valueOf(command.movementType().name()), quantity,
                authorized.accountId(), sourceReference, note, command.totalCostMinor(), currency));
        } catch (DataIntegrityViolationException exception) {
            throw new InventoryStateConflictException();
        }
        return findMovement(organizationId, locationId, movementId);
    }

    private void validate(CreateMovement command, BigDecimal quantity) {
        if (quantity.signum() == 0) throw new InvalidInventoryException();
        if ((command.movementType() == ManualMovementType.OPENING
            || command.movementType() == ManualMovementType.RECEIPT)
            && quantity.signum() < 0) throw new InvalidInventoryException();
        if (command.movementType() == ManualMovementType.ADJUSTMENT
            && trimToNull(command.note()) == null) throw new InvalidInventoryException();
        if (command.movementType() != ManualMovementType.RECEIPT
            && command.totalCostMinor() != null) throw new InvalidInventoryException();
    }

    private BigDecimal normalizeQuantity(String value) {
        try {
            BigDecimal quantity = new BigDecimal(value).setScale(6, RoundingMode.UNNECESSARY);
            if (quantity.precision() > 19) throw new InvalidInventoryException();
            return quantity;
        } catch (NumberFormatException | ArithmeticException exception) {
            throw new InvalidInventoryException();
        }
    }

    private void requireIngredient(UUID organizationId, UUID ingredientId, boolean active) {
        boolean exists = jdbc.sql("""
                SELECT EXISTS (
                    SELECT 1 FROM ingredient
                     WHERE id = :ingredientId AND organization_id = :organizationId
                       AND (NOT :active OR archived_at IS NULL)
                )
                """)
            .param("ingredientId", ingredientId).param("organizationId", organizationId)
            .param("active", active).query(Boolean.class).single();
        if (!exists) throw new InventoryNotFoundException();
    }

    private Movement findMovement(UUID organizationId, UUID locationId, UUID movementId) {
        return jdbc.sql("""
                SELECT movement.id, movement.ingredient_id, ingredient.name AS ingredient_name,
                       ingredient.base_unit, movement.movement_type, movement.quantity_delta,
                       movement.customer_order_id, movement.source_reference, movement.note,
                       movement.total_cost_minor, movement.currency_code, movement.created_at
                  FROM inventory_movement movement
                  JOIN ingredient ON ingredient.id = movement.ingredient_id
                                 AND ingredient.organization_id = movement.organization_id
                 WHERE movement.id = :movementId AND movement.organization_id = :organizationId
                   AND movement.location_id = :locationId
                """)
            .param("movementId", movementId).param("organizationId", organizationId)
            .param("locationId", locationId).query(this::mapMovement).optional()
            .orElseThrow(InventoryNotFoundException::new);
    }

    private Balance mapBalance(ResultSet rs, int rowNumber) throws SQLException {
        BigDecimal quantity = rs.getBigDecimal("quantity");
        BigDecimal threshold = rs.getBigDecimal("reorder_threshold");
        java.sql.Timestamp updated = rs.getTimestamp("updated_at");
        return new Balance(rs.getObject("ingredient_id", UUID.class),
            rs.getString("ingredient_name"), rs.getString("sku"),
            BaseUnit.valueOf(rs.getString("base_unit")),
            quantity.toPlainString(), threshold == null ? null : threshold.toPlainString(),
            threshold != null && quantity.compareTo(threshold) <= 0, rs.getLong("balance_version"),
            rs.getBoolean("opening_recorded"), rs.getTimestamp("archived_at") != null,
            updated == null ? null : updated.toInstant());
    }

    private Movement mapMovement(ResultSet rs, int rowNumber) throws SQLException {
        Long cost = rs.getObject("total_cost_minor", Long.class);
        return new Movement(rs.getObject("id", UUID.class),
            rs.getObject("ingredient_id", UUID.class), rs.getString("ingredient_name"),
            BaseUnit.valueOf(rs.getString("base_unit")),
            InventoryMovementType.valueOf(rs.getString("movement_type")),
            rs.getBigDecimal("quantity_delta").toPlainString(),
            rs.getObject("customer_order_id", UUID.class), rs.getString("source_reference"),
            rs.getString("note"), cost, rs.getString("currency_code"),
            rs.getTimestamp("created_at").toInstant());
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public enum ManualMovementType { OPENING, RECEIPT, ADJUSTMENT }
    @Schema(name = "CreateInventoryMovement")
    public record CreateMovement(UUID ingredientId, ManualMovementType movementType,
                                 String quantityDelta, String sourceReference, String note,
                                 Long totalCostMinor) { }
    @Schema(name = "StaffInventoryBalancePage")
    public record BalancePage(List<Balance> items, int page, int size,
                              long totalItems, long totalPages) {
        public BalancePage { items = List.copyOf(items); }
    }
    @Schema(name = "StaffInventoryBalance")
    public record Balance(UUID ingredientId, String ingredientName,
                          @Schema(nullable = true) String sku, BaseUnit baseUnit,
                          String quantity, @Schema(nullable = true) String reorderThreshold,
                          boolean belowReorderThreshold, long version, boolean openingRecorded,
                          boolean ingredientArchived,
                          @Schema(nullable = true) Instant updatedAt) { }
    @Schema(name = "StaffInventoryMovementPage")
    public record MovementPage(List<Movement> items, int page, int size,
                               long totalItems, long totalPages) {
        public MovementPage { items = List.copyOf(items); }
    }
    @Schema(name = "StaffInventoryMovement")
    public record Movement(UUID id, UUID ingredientId, String ingredientName, BaseUnit baseUnit,
                           InventoryMovementType movementType, String quantityDelta,
                           @Schema(nullable = true) UUID customerOrderId,
                           @Schema(nullable = true) String sourceReference,
                           @Schema(nullable = true) String note,
                           @Schema(nullable = true) Long totalCostMinor,
                           @Schema(nullable = true) String currencyCode, Instant createdAt) { }
}
