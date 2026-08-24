package com.bubbletea.shop.ordering;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest(properties = {
    "app.security.supabase.enabled=true",
    "app.security.supabase.issuer=http://localhost:8000/auth/v1",
    "app.security.supabase.jwk-set-uri=http://localhost:8000/auth/v1/.well-known/jwks.json"
})
@AutoConfigureMockMvc
class CustomerOrderHistoryApiIntegrationTest {
    private static final UUID ORGANIZATION =
        UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID LOCATION =
        UUID.fromString("20000000-0000-0000-0000-000000000001");

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
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void listsOnlyOwnedOrdersNewestFirstWithBoundedPaginationAndSnapshotPreviews() throws Exception {
        Customer customer = customer(true);
        Customer otherCustomer = customer(true);
        Order oldest = order(customer.accountId(), "BT-HISTORY-OLDEST",
            Instant.parse("2026-08-20T08:00:00Z"), "Moonlit Milk Tea", "Medium", 1, 720);
        Order newest = order(customer.accountId(), "BT-HISTORY-NEWEST",
            Instant.parse("2026-08-22T08:00:00Z"), "Mossy Matcha", "Large", 2, 1520);
        order(customer.accountId(), "BT-HISTORY-MIDDLE",
            Instant.parse("2026-08-21T08:00:00Z"), "Sunberry Oolong", "Regular", 1, 650);
        order(otherCustomer.accountId(), "BT-OTHER-CUSTOMER",
            Instant.parse("2026-08-23T08:00:00Z"), "Cloudberry Taro", "Large", 1, 780);

        mvc.perform(get("/api/v1/customer/orders?page=0&size=2")
                .with(jwt().jwt(token -> token.subject(customer.subject().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(2))
            .andExpect(jsonPath("$.totalItems").value(3))
            .andExpect(jsonPath("$.totalPages").value(2))
            .andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.items[0].id").value(newest.id().toString()))
            .andExpect(jsonPath("$.items[0].publicOrderNumber").value("BT-HISTORY-NEWEST"))
            .andExpect(jsonPath("$.items[0].location.name").value("Orchard Central"))
            .andExpect(jsonPath("$.items[0].location.slug").value("orchard-central"))
            .andExpect(jsonPath("$.items[0].itemQuantity").value(2))
            .andExpect(jsonPath("$.items[0].items[0].productName").value("Mossy Matcha"))
            .andExpect(jsonPath("$.items[0].items[0].variantName").value("Large"))
            .andExpect(jsonPath("$.items[1].publicOrderNumber").value("BT-HISTORY-MIDDLE"));

        mvc.perform(get("/api/v1/customer/orders?page=1&size=2")
                .with(jwt().jwt(token -> token.subject(customer.subject().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].id").value(oldest.id().toString()));
    }

    @Test
    void returnsOwnedImmutableReceiptWithLineAndOptionSnapshots() throws Exception {
        Customer customer = customer(true);
        Order order = order(customer.accountId(), "BT-HISTORY-DETAIL",
            Instant.parse("2026-08-22T09:30:00Z"), "Moonlit Milk Tea", "Medium", 2, 1440);
        jdbc.update("""
            INSERT INTO order_item_option (
                id, organization_id, order_item_id, option_choice_id, selection_number,
                group_name_snapshot, choice_name_snapshot, price_delta_minor
            ) VALUES (?, ?, ?, NULL, 1, 'Toppings', 'Brown Sugar Pearls', 70)
            """, UUID.randomUUID(), ORGANIZATION, order.itemId());

        mvc.perform(get("/api/v1/customer/orders/{orderId}", order.id())
                .with(jwt().jwt(token -> token.subject(customer.subject().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.publicOrderNumber").value("BT-HISTORY-DETAIL"))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.paymentMethod").value("CASH"))
            .andExpect(jsonPath("$.currencyCode").value("SGD"))
            .andExpect(jsonPath("$.subtotalMinor").value(1440))
            .andExpect(jsonPath("$.totalMinor").value(1440))
            .andExpect(jsonPath("$.location.name").value("Orchard Central"))
            .andExpect(jsonPath("$.items[0].lineNumber").value(1))
            .andExpect(jsonPath("$.items[0].productName").value("Moonlit Milk Tea"))
            .andExpect(jsonPath("$.items[0].quantity").value(2))
            .andExpect(jsonPath("$.items[0].options[0].groupName").value("Toppings"))
            .andExpect(jsonPath("$.items[0].options[0].choiceName").value("Brown Sugar Pearls"))
            .andExpect(jsonPath("$.items[0].options[0].priceDeltaMinor").value(70));
    }

    @Test
    void hidesCrossAccountOrdersBehindTheSameNotFoundResponse() throws Exception {
        Customer owner = customer(true);
        Customer requester = customer(true);
        Order order = order(owner.accountId(), "BT-HISTORY-PRIVATE", Instant.now(),
            "Moonlit Milk Tea", "Medium", 1, 720);

        mvc.perform(get("/api/v1/customer/orders/{orderId}", order.id())
                .with(jwt().jwt(token -> token.subject(requester.subject().toString()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("CUSTOMER_ORDER_NOT_FOUND"));

        mvc.perform(get("/api/v1/customer/orders/{orderId}", UUID.randomUUID())
                .with(jwt().jwt(token -> token.subject(requester.subject().toString()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("CUSTOMER_ORDER_NOT_FOUND"));
    }

    @Test
    void handlesEmptyHistoryAndRejectsUnavailableAccountsAndInvalidRequests() throws Exception {
        Customer emptyCustomer = customer(true);
        Customer disabledCustomer = customer(false);

        mvc.perform(get("/api/v1/customer/orders")
                .with(jwt().jwt(token -> token.subject(emptyCustomer.subject().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(0))
            .andExpect(jsonPath("$.totalItems").value(0))
            .andExpect(jsonPath("$.totalPages").value(0));

        mvc.perform(get("/api/v1/customer/orders")
                .with(jwt().jwt(token -> token.subject(disabledCustomer.subject().toString()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("CUSTOMER_ACCOUNT_UNAVAILABLE"));

        mvc.perform(get("/api/v1/customer/orders")
                .with(jwt().jwt(token -> token.subject(UUID.randomUUID().toString()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("CUSTOMER_ACCOUNT_UNAVAILABLE"));

        mvc.perform(get("/api/v1/customer/orders?page=-1&size=21")
                .with(jwt().jwt(token -> token.subject(emptyCustomer.subject().toString()))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("CUSTOMER_ORDER_HISTORY_INVALID"));

        mvc.perform(get("/api/v1/customer/orders")
                .with(jwt().jwt(token -> token.subject("not-a-uuid"))))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("CUSTOMER_IDENTITY_INVALID"));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/customer/orders"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void returnsTheExactLatestOrderAtCurrentPricesOnlyWhileFullyInStock() throws Exception {
        Customer customer = customer(true);
        Order order = reorderableOrder(customer.accountId(), "BT-REORDER-LATEST",
            Instant.parse("2026-08-23T09:30:00Z"));
        stockOrchardIngredients("10000.000000");

        mvc.perform(get("/api/v1/customer/orders/latest-reorder")
                .param("locationSlug", "orchard-central")
                .with(jwt().jwt(token -> token.subject(customer.subject().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.orderId").value(order.id().toString()))
            .andExpect(jsonPath("$.publicOrderNumber").value("BT-REORDER-LATEST"))
            .andExpect(jsonPath("$.location.slug").value("orchard-central"))
            .andExpect(jsonPath("$.currencyCode").value("SGD"))
            .andExpect(jsonPath("$.totalMinor").value(1440))
            .andExpect(jsonPath("$.items[0].productSlug").value("moonlit-milk-tea"))
            .andExpect(jsonPath("$.items[0].variantId")
                .value("50000000-0000-0000-0000-000000000002"))
            .andExpect(jsonPath("$.items[0].variantName").value("Medium"))
            .andExpect(jsonPath("$.items[0].quantity").value(2))
            .andExpect(jsonPath("$.items[0].unitPriceMinor").value(720))
            .andExpect(jsonPath("$.items[0].selections.length()").value(3))
            .andExpect(jsonPath("$.items[0].selections[0].groupName").value("Sweetness"))
            .andExpect(jsonPath("$.items[0].selections[0].choiceNames[0]").value("50%"))
            .andExpect(jsonPath("$.items[0].selections[2].choiceNames[0]").value("Pearls"));

        jdbc.update("UPDATE inventory_balance SET quantity = 0 WHERE location_id = ? AND ingredient_id = ?",
            LOCATION, UUID.fromString("90000000-0000-0000-0000-000000000005"));

        mvc.perform(get("/api/v1/customer/orders/latest-reorder")
                .param("locationSlug", "orchard-central")
                .with(jwt().jwt(token -> token.subject(customer.subject().toString()))))
            .andExpect(status().isNoContent());
    }

    @Test
    @Transactional
    void hidesTheLatestOrderAtAnotherShopOrWhenItsConfigurationIsNoLongerAvailable() throws Exception {
        Customer customer = customer(true);
        reorderableOrder(customer.accountId(), "BT-REORDER-HIDDEN",
            Instant.parse("2026-08-23T10:30:00Z"));
        stockOrchardIngredients("10000.000000");

        mvc.perform(get("/api/v1/customer/orders/latest-reorder")
                .param("locationSlug", "tiong-bahru")
                .with(jwt().jwt(token -> token.subject(customer.subject().toString()))))
            .andExpect(status().isNoContent());

        jdbc.update("UPDATE menu_variant_offering SET available = false WHERE location_id = ? AND menu_variant_id = ?",
            LOCATION, UUID.fromString("50000000-0000-0000-0000-000000000002"));

        mvc.perform(get("/api/v1/customer/orders/latest-reorder")
                .param("locationSlug", "orchard-central")
                .with(jwt().jwt(token -> token.subject(customer.subject().toString()))))
            .andExpect(status().isNoContent());
    }

    private Customer customer(boolean enabled) {
        UUID subject = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, ?)",
            accountId, subject, enabled);
        return new Customer(subject, accountId);
    }

    private Order order(
        UUID accountId,
        String publicNumber,
        Instant createdAt,
        String productName,
        String variantName,
        int quantity,
        long totalMinor
    ) {
        UUID orderId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO customer_order (
                id, organization_id, location_id, customer_account_id, public_order_number,
                status, payment_method, currency_code, subtotal_minor, total_minor, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'PENDING', 'CASH', 'SGD', ?, ?, ?, ?)
            """, orderId, ORGANIZATION, LOCATION, accountId, publicNumber,
            totalMinor, totalMinor, Timestamp.from(createdAt), Timestamp.from(createdAt));
        jdbc.update("""
            INSERT INTO order_item (
                id, organization_id, customer_order_id, menu_variant_id, line_number,
                product_name_snapshot, variant_name_snapshot, quantity,
                unit_price_minor, line_total_minor, created_at
            ) VALUES (?, ?, ?, NULL, 1, ?, ?, ?, ?, ?, ?)
            """, itemId, ORGANIZATION, orderId, productName, variantName, quantity,
            totalMinor / quantity, totalMinor, Timestamp.from(createdAt));
        return new Order(orderId, itemId);
    }

    private Order reorderableOrder(UUID accountId, String publicNumber, Instant createdAt) {
        UUID orderId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID variantId = UUID.fromString("50000000-0000-0000-0000-000000000002");
        jdbc.update("""
            INSERT INTO customer_order (
                id, organization_id, location_id, customer_account_id, public_order_number,
                status, payment_method, currency_code, subtotal_minor, total_minor,
                created_at, completed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'COMPLETED', 'CASH', 'SGD', 1440, 1440, ?, ?, ?)
            """, orderId, ORGANIZATION, LOCATION, accountId, publicNumber,
            Timestamp.from(createdAt), Timestamp.from(createdAt.plusSeconds(300)),
            Timestamp.from(createdAt));
        jdbc.update("""
            INSERT INTO order_item (
                id, organization_id, customer_order_id, menu_variant_id, line_number,
                product_name_snapshot, variant_name_snapshot, quantity,
                unit_price_minor, line_total_minor, created_at
            ) VALUES (?, ?, ?, ?, 1, 'Moonlit Milk Tea', 'Medium', 2, 720, 1440, ?)
            """, itemId, ORGANIZATION, orderId, variantId, Timestamp.from(createdAt));
        UUID[] choices = {
            UUID.fromString("71000000-0000-0000-0000-000000000003"),
            UUID.fromString("71000000-0000-0000-0000-000000000007"),
            UUID.fromString("71000000-0000-0000-0000-000000000010")
        };
        String[] groups = { "Sweetness", "Ice", "Toppings" };
        String[] names = { "50%", "Less ice", "Pearls" };
        long[] deltas = { 0, 0, 60 };
        for (int index = 0; index < choices.length; index++) {
            jdbc.update("""
                INSERT INTO order_item_option (
                    id, organization_id, order_item_id, option_choice_id, selection_number,
                    group_name_snapshot, choice_name_snapshot, price_delta_minor
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), ORGANIZATION, itemId, choices[index], index + 1,
                groups[index], names[index], deltas[index]);
        }
        return new Order(orderId, itemId);
    }

    private void stockOrchardIngredients(String quantity) {
        jdbc.update("""
            INSERT INTO inventory_balance (organization_id, location_id, ingredient_id, quantity)
            SELECT ?, ?, id, ?::numeric FROM ingredient WHERE organization_id = ?
            ON CONFLICT (location_id, ingredient_id) DO UPDATE SET quantity = EXCLUDED.quantity
            """, ORGANIZATION, LOCATION, quantity, ORGANIZATION);
    }

    private record Customer(UUID subject, UUID accountId) { }
    private record Order(UUID id, UUID itemId) { }
}
