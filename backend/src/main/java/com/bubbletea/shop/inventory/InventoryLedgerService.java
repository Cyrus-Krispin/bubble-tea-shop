package com.bubbletea.shop.inventory;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

@Service
public class InventoryLedgerService {
    private final JdbcTemplate jdbc;

    public InventoryLedgerService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public UUID recordManualMovement(ManualMovement command) {
        validateManualMovement(command);

        jdbc.update("""
            INSERT INTO inventory_balance (
                organization_id, location_id, ingredient_id, quantity, version, updated_at
            )
            VALUES (?, ?, ?, 0, 0, now())
            ON CONFLICT (location_id, ingredient_id) DO NOTHING
            """,
            command.organizationId(), command.locationId(), command.ingredientId());

        Balance balance = jdbc.queryForObject("""
            SELECT organization_id, quantity
              FROM inventory_balance
             WHERE location_id = ? AND ingredient_id = ?
             FOR UPDATE
            """,
            (rs, rowNum) -> new Balance(
                rs.getObject("organization_id", UUID.class),
                rs.getBigDecimal("quantity")),
            command.locationId(), command.ingredientId());

        if (balance == null || !balance.organizationId().equals(command.organizationId())) {
            throw new IllegalArgumentException("Inventory balance does not belong to the organization");
        }

        BigDecimal resultingQuantity = balance.quantity().add(command.quantityDelta());
        if (resultingQuantity.signum() < 0) {
            throw new InsufficientStockException(java.util.Map.of(
                command.ingredientId(),
                new InsufficientStockException.StockShortage(
                    command.quantityDelta().abs(), balance.quantity())));
        }

        jdbc.update("""
            UPDATE inventory_balance
               SET quantity = ?, version = version + 1, updated_at = now()
             WHERE location_id = ? AND ingredient_id = ?
            """,
            resultingQuantity, command.locationId(), command.ingredientId());

        UUID movementId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO inventory_movement (
                id, organization_id, location_id, ingredient_id, movement_type,
                quantity_delta, actor_account_id, source_reference, note,
                total_cost_minor, currency_code
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            movementId,
            command.organizationId(),
            command.locationId(),
            command.ingredientId(),
            command.type().name(),
            command.quantityDelta(),
            command.actorAccountId(),
            command.sourceReference(),
            command.note(),
            command.totalCostMinor(),
            command.currencyCode());

        return movementId;
    }

    private static void validateManualMovement(ManualMovement command) {
        Objects.requireNonNull(command, "command");
        Objects.requireNonNull(command.organizationId(), "organizationId");
        Objects.requireNonNull(command.locationId(), "locationId");
        Objects.requireNonNull(command.ingredientId(), "ingredientId");
        Objects.requireNonNull(command.type(), "type");
        Objects.requireNonNull(command.quantityDelta(), "quantityDelta");

        if (command.quantityDelta().signum() == 0) {
            throw new IllegalArgumentException("quantityDelta must be non-zero");
        }
        if (command.type() == InventoryMovementType.SALE
            || command.type() == InventoryMovementType.REVERSAL) {
            throw new IllegalArgumentException("Sale and reversal movements must be created by an order workflow");
        }
        if ((command.type() == InventoryMovementType.OPENING
            || command.type() == InventoryMovementType.RECEIPT)
            && command.quantityDelta().signum() < 0) {
            throw new IllegalArgumentException(command.type() + " quantity must be positive");
        }
        if ((command.totalCostMinor() == null) != (command.currencyCode() == null)) {
            throw new IllegalArgumentException("Cost and currency must be supplied together");
        }
    }

    private record Balance(UUID organizationId, BigDecimal quantity) {
    }

    public record ManualMovement(
        UUID organizationId,
        UUID locationId,
        UUID ingredientId,
        InventoryMovementType type,
        BigDecimal quantityDelta,
        UUID actorAccountId,
        String sourceReference,
        String note,
        Long totalCostMinor,
        String currencyCode
    ) {
    }
}
