package com.bubbletea.shop;

import com.bubbletea.shop.inventory.InsufficientStockException;
import com.bubbletea.shop.inventory.InventoryLedgerService;
import com.bubbletea.shop.inventory.InventoryMovementType;
import com.bubbletea.shop.ordering.OrderCompletionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@SpringBootTest(properties = "spring.main.web-application-type=none")
class SchemaFoundationIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:18.4-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    InventoryLedgerService inventoryLedger;

    @Autowired
    OrderCompletionService orderCompletion;

    @Test
    void flywayCreatesAllMvpTablesAndHibernateValidatesThem() {
        Integer tableCount = jdbc.queryForObject("""
            SELECT count(*)
              FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name IN (
                   'organization', 'location', 'account', 'organization_membership',
                   'location_assignment', 'ingredient', 'recipe', 'recipe_version', 'recipe_component',
                   'menu_product', 'menu_variant', 'menu_variant_offering',
                   'option_group', 'option_choice', 'menu_variant_option_choice',
                   'option_choice_ingredient_effect', 'inventory_balance',
                   'inventory_movement', 'customer_order', 'order_item',
                   'order_item_option', 'order_item_consumption',
                   'order_status_history', 'payment', 'refresh_session'
               )
            """, Integer.class);

        assertThat(tableCount).isEqualTo(25);
    }

    @Test
    void manualMovementsUpdateBalanceAndRemainImmutable() {
        Fixture fixture = fixture("ledger");

        UUID opening = inventoryLedger.recordManualMovement(movement(
            fixture, InventoryMovementType.OPENING, "10.000000"));
        inventoryLedger.recordManualMovement(movement(
            fixture, InventoryMovementType.RECEIPT, "5.000000"));
        inventoryLedger.recordManualMovement(movement(
            fixture, InventoryMovementType.ADJUSTMENT, "-2.000000"));

        assertThat(balance(fixture)).isEqualByComparingTo("13.000000");
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM inventory_movement
             WHERE location_id = ? AND ingredient_id = ?
            """, Integer.class, fixture.locationId(), fixture.ingredientId())).isEqualTo(3);

        assertThatThrownBy(() -> jdbc.update(
            "UPDATE inventory_movement SET note = 'changed' WHERE id = ?", opening))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("inventory movements are immutable");
    }

    @Test
    void organizationOwnedRelationshipsRejectCrossOrganizationReferences() {
        Fixture first = fixture("first-org");
        Fixture second = fixture("second-org");

        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO inventory_balance (
                organization_id, location_id, ingredient_id, quantity
            )
            VALUES (?, ?, ?, 1)
            """,
            first.organizationId(), first.locationId(), second.ingredientId()))
            .isInstanceOf(DataAccessException.class);
    }

    @Test
    void recipeComponentsMustBePositiveAndPublishedVersionsAreImmutable() {
        Fixture fixture = fixture("recipes");
        UUID recipeId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();

        jdbc.update("INSERT INTO recipe (id, organization_id, name) VALUES (?, ?, ?)",
            recipeId, fixture.organizationId(), "Classic Milk Tea");
        jdbc.update("""
            INSERT INTO recipe_version (
                id, organization_id, recipe_id, version_number, status
            )
            VALUES (?, ?, ?, 1, 'DRAFT')
            """, versionId, fixture.organizationId(), recipeId);

        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO recipe_component (
                organization_id, recipe_version_id, ingredient_id, quantity
            )
            VALUES (?, ?, ?, -1)
            """, fixture.organizationId(), versionId, fixture.ingredientId()))
            .isInstanceOf(DataAccessException.class);

        jdbc.update("""
            INSERT INTO recipe_component (
                organization_id, recipe_version_id, ingredient_id, quantity
            )
            VALUES (?, ?, ?, 25)
            """, fixture.organizationId(), versionId, fixture.ingredientId());
        jdbc.update("""
            UPDATE recipe_version
               SET status = 'PUBLISHED', published_at = now()
             WHERE id = ?
            """, versionId);

        assertThatThrownBy(() -> jdbc.update("""
            UPDATE recipe_component SET quantity = 30
             WHERE recipe_version_id = ? AND ingredient_id = ?
            """, versionId, fixture.ingredientId()))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("published recipe versions are immutable");

        UUID productId = UUID.randomUUID();
        UUID variantId = UUID.randomUUID();
        jdbc.update("INSERT INTO menu_product (id, organization_id, name) VALUES (?, ?, ?)",
            productId, fixture.organizationId(), "Classic Milk Tea");
        jdbc.update("""
            INSERT INTO menu_variant (id, organization_id, menu_product_id, name)
            VALUES (?, ?, ?, 'Medium')
            """, variantId, fixture.organizationId(), productId);
        jdbc.update("UPDATE recipe SET archived_at = now() WHERE id = ?", recipeId);

        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO menu_variant_offering (
                id, organization_id, location_id, menu_variant_id,
                recipe_version_id, price_minor, currency_code
            )
            VALUES (?, ?, ?, ?, ?, 500, 'SGD')
            """,
            UUID.randomUUID(),
            fixture.organizationId(),
            fixture.locationId(),
            variantId,
            versionId))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("published, active recipe");

        jdbc.update("UPDATE ingredient SET archived_at = now() WHERE id = ?",
            fixture.ingredientId());
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM recipe_component
             WHERE recipe_version_id = ? AND ingredient_id = ?
            """, Integer.class, versionId, fixture.ingredientId())).isEqualTo(1);

        UUID nextVersionId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO recipe_version (
                id, organization_id, recipe_id, version_number, status
            )
            VALUES (?, ?, ?, 2, 'DRAFT')
            """, nextVersionId, fixture.organizationId(), recipeId);
        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO recipe_component (
                organization_id, recipe_version_id, ingredient_id, quantity
            )
            VALUES (?, ?, ?, 10)
            """, fixture.organizationId(), nextVersionId, fixture.ingredientId()))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("archived ingredients");
    }

    @Test
    void completingAnOrderDeductsItsSnapshotExactlyOnce() {
        Fixture fixture = fixture("complete-once");
        inventoryLedger.recordManualMovement(movement(
            fixture, InventoryMovementType.OPENING, "10.000000"));
        UUID orderId = pendingOrder(fixture, "A-001", "4.250000");

        OrderCompletionService.CompletionResult first =
            orderCompletion.complete(orderId, fixture.accountId());
        OrderCompletionService.CompletionResult repeated =
            orderCompletion.complete(orderId, fixture.accountId());

        assertThat(first.alreadyCompleted()).isFalse();
        assertThat(repeated.alreadyCompleted()).isTrue();
        assertThat(balance(fixture)).isEqualByComparingTo("5.750000");
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM inventory_movement
             WHERE customer_order_id = ? AND movement_type = 'SALE'
            """, Integer.class, orderId)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            "SELECT status FROM customer_order WHERE id = ?",
            String.class, orderId)).isEqualTo("COMPLETED");
        assertThatThrownBy(() -> jdbc.update("""
            UPDATE order_item SET product_name_snapshot = 'Changed'
             WHERE customer_order_id = ?
            """, orderId))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("order snapshots");
    }

    @Test
    void concurrentCompletionsCannotOversellStock() throws Exception {
        Fixture fixture = fixture("concurrent");
        inventoryLedger.recordManualMovement(movement(
            fixture, InventoryMovementType.OPENING, "10.000000"));
        UUID firstOrder = pendingOrder(fixture, "B-001", "8.000000");
        UUID secondOrder = pendingOrder(fixture, "B-002", "8.000000");

        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            List<Future<String>> attempts = List.of(
                executor.submit(() -> completeAfter(start, firstOrder, fixture.accountId())),
                executor.submit(() -> completeAfter(start, secondOrder, fixture.accountId())));
            start.countDown();

            assertThat(attempts.get(0).get() + attempts.get(1).get())
                .contains("completed")
                .contains("shortage");
        }

        assertThat(balance(fixture)).isEqualByComparingTo("2.000000");
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM customer_order
             WHERE id IN (?, ?) AND status = 'COMPLETED'
            """, Integer.class, firstOrder, secondOrder)).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM customer_order
             WHERE id IN (?, ?) AND status = 'PENDING'
            """, Integer.class, firstOrder, secondOrder)).isEqualTo(1);
    }

    private String completeAfter(CountDownLatch start, UUID orderId, UUID actorId)
        throws InterruptedException {
        start.await();
        try {
            orderCompletion.complete(orderId, actorId);
            return "completed";
        } catch (InsufficientStockException expected) {
            return "shortage";
        }
    }

    private Fixture fixture(String prefix) {
        UUID organizationId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();
        UUID ingredientId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        jdbc.update("INSERT INTO organization (id, name) VALUES (?, ?)",
            organizationId, prefix + "-organization");
        jdbc.update("""
            INSERT INTO location (
                id, organization_id, name, timezone, currency_code
            )
            VALUES (?, ?, ?, 'Asia/Singapore', 'SGD')
            """, locationId, organizationId, prefix + "-location");
        jdbc.update("""
            INSERT INTO ingredient (
                id, organization_id, name, base_unit
            )
            VALUES (?, ?, ?, 'MILLILITER')
            """, ingredientId, organizationId, prefix + "-ingredient");
        jdbc.update("""
            INSERT INTO account (
                id, username, normalized_username, password_hash
            )
            VALUES (?, ?, ?, ?)
            """, accountId, prefix + "-manager", prefix + "-manager", "$2a$12$test-hash");

        return new Fixture(organizationId, locationId, ingredientId, accountId);
    }

    private InventoryLedgerService.ManualMovement movement(
        Fixture fixture,
        InventoryMovementType type,
        String quantity
    ) {
        return new InventoryLedgerService.ManualMovement(
            fixture.organizationId(),
            fixture.locationId(),
            fixture.ingredientId(),
            type,
            new BigDecimal(quantity),
            fixture.accountId(),
            "test",
            null,
            null,
            null);
    }

    private UUID pendingOrder(Fixture fixture, String publicNumber, String consumption) {
        UUID orderId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();

        jdbc.update("""
            INSERT INTO customer_order (
                id, organization_id, location_id, public_order_number,
                status, payment_method, currency_code, subtotal_minor, total_minor
            )
            VALUES (?, ?, ?, ?, 'PENDING', 'CASH', 'SGD', 500, 500)
            """, orderId, fixture.organizationId(), fixture.locationId(), publicNumber);
        jdbc.update("""
            INSERT INTO order_item (
                id, organization_id, customer_order_id, line_number, product_name_snapshot,
                variant_name_snapshot, quantity, unit_price_minor, line_total_minor
            )
            VALUES (?, ?, ?, 1, 'Milk Tea', 'Medium', 1, 500, 500)
            """, itemId, fixture.organizationId(), orderId);
        jdbc.update("""
            INSERT INTO order_item_consumption (
                id, organization_id, order_item_id, ingredient_id, quantity
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            UUID.randomUUID(),
            fixture.organizationId(),
            itemId,
            fixture.ingredientId(),
            new BigDecimal(consumption));

        return orderId;
    }

    private BigDecimal balance(Fixture fixture) {
        return jdbc.queryForObject("""
            SELECT quantity FROM inventory_balance
             WHERE location_id = ? AND ingredient_id = ?
            """, BigDecimal.class, fixture.locationId(), fixture.ingredientId());
    }

    private record Fixture(
        UUID organizationId,
        UUID locationId,
        UUID ingredientId,
        UUID accountId
    ) {
    }
}
