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
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest(properties = {
    "app.security.supabase.enabled=true",
    "app.security.supabase.issuer=http://localhost:8000/auth/v1",
    "app.security.supabase.jwk-set-uri=http://localhost:8000/auth/v1/.well-known/jwks.json"
})
@AutoConfigureMockMvc
class GuestOrderPlacementApiIntegrationTest {
    private static final UUID MEDIUM_MILK_TEA =
        UUID.fromString("50000000-0000-0000-0000-000000000002");
    private static final UUID SWEETNESS_50 =
        UUID.fromString("71000000-0000-0000-0000-000000000003");
    private static final UUID LESS_ICE =
        UUID.fromString("71000000-0000-0000-0000-000000000007");
    private static final UUID PEARLS =
        UUID.fromString("71000000-0000-0000-0000-000000000010");

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

    @Autowired
    GuestOrderPlacementService placement;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void placesGuestCashOrderFromServerOwnedCatalogAndConsumptionSnapshots() throws Exception {
        UUID key = UUID.randomUUID();
        mvc.perform(post("/api/v1/guest/orders")
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(orderBody(2)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.publicOrderNumber").value(org.hamcrest.Matchers.matchesPattern("BT[0-9]{10}")))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.paymentMethod").value("CASH"))
            .andExpect(jsonPath("$.currencyCode").value("SGD"))
            .andExpect(jsonPath("$.subtotalMinor").value(1440))
            .andExpect(jsonPath("$.totalMinor").value(1440))
            .andExpect(jsonPath("$.replayed").value(false))
            .andExpect(jsonPath("$.items[0].productName").value("Moonlit Milk Tea"))
            .andExpect(jsonPath("$.items[0].variantName").value("Medium"))
            .andExpect(jsonPath("$.items[0].unitPriceMinor").value(720))
            .andExpect(jsonPath("$.items[0].options.length()").value(3));

        UUID orderId = jdbc.queryForObject(
            "SELECT id FROM customer_order WHERE placement_key = ?", UUID.class, key);
        assertThat(jdbc.queryForObject(
            "SELECT customer_account_id FROM customer_order WHERE id = ?", UUID.class, orderId))
            .isNull();
        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM payment WHERE customer_order_id = ? AND status = 'PENDING'",
            Integer.class, orderId)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM order_status_history WHERE customer_order_id = ? AND from_status IS NULL",
            Integer.class, orderId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
            SELECT consumption.quantity
              FROM order_item_consumption consumption
              JOIN order_item item ON item.id = consumption.order_item_id
             WHERE item.customer_order_id = ?
               AND consumption.ingredient_id = '90000000-0000-0000-0000-000000000007'
            """, BigDecimal.class, orderId)).isEqualByComparingTo("100.000000");
    }

    @Test
    void replaysMatchingKeyAndRejectsMismatchedReuseWithoutDuplicateWrites() throws Exception {
        UUID key = UUID.randomUUID();
        mvc.perform(post("/api/v1/guest/orders").header("Idempotency-Key", key)
                .contentType("application/json").content(orderBody(1)))
            .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/guest/orders").header("Idempotency-Key", key)
                .contentType("application/json").content(orderBody(1)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(true));
        mvc.perform(post("/api/v1/guest/orders").header("Idempotency-Key", key)
                .contentType("application/json").content(orderBody(2)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ORDER_IDEMPOTENCY_CONFLICT"));

        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM customer_order WHERE placement_key = ?", Integer.class, key))
            .isEqualTo(1);
    }

    @Test
    void rejectsUnavailableInvalidAndClientOwnedOrderFieldsWithoutPartialWrites() throws Exception {
        int before = jdbc.queryForObject("SELECT count(*) FROM customer_order", Integer.class);
        mvc.perform(post("/api/v1/guest/orders").header("Idempotency-Key", UUID.randomUUID())
                .contentType("application/json").content("""
                    {"items":[{"variantId":"50000000-0000-0000-0000-000000000011",
                    "quantity":1,"optionChoiceIds":[]}]}
                    """))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_CATALOG_CHANGED"));
        mvc.perform(post("/api/v1/guest/orders").header("Idempotency-Key", UUID.randomUUID())
                .contentType("application/json").content("""
                    {"items":[{"variantId":"%s","quantity":1,"optionChoiceIds":[],"unitPriceMinor":1}]}
                    """.formatted(MEDIUM_MILK_TEA)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("ORDER_INVALID"));
        mvc.perform(post("/api/v1/guest/orders").header("Idempotency-Key", UUID.randomUUID())
                .contentType("application/json").content("""
                    {"items":[{"variantId":"%s","quantity":1,"optionChoiceIds":[]}]}
                    """.formatted(MEDIUM_MILK_TEA)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_CATALOG_CHANGED"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM customer_order", Integer.class)).isEqualTo(before);
    }

    @Test
    void linksVerifiedEnabledCustomerAndDeniesDisabledAccount() throws Exception {
        UUID enabledSubject = UUID.randomUUID();
        UUID enabledAccount = UUID.randomUUID();
        UUID disabledSubject = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)",
            enabledAccount, enabledSubject);
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, false)",
            UUID.randomUUID(), disabledSubject);

        UUID key = UUID.randomUUID();
        mvc.perform(post("/api/v1/guest/orders").header("Idempotency-Key", key)
                .with(jwt().jwt(token -> token.subject(enabledSubject.toString())))
                .contentType("application/json").content(orderBody(1)))
            .andExpect(status().isCreated());
        assertThat(jdbc.queryForObject(
            "SELECT customer_account_id FROM customer_order WHERE placement_key = ?", UUID.class, key))
            .isEqualTo(enabledAccount);

        mvc.perform(post("/api/v1/guest/orders").header("Idempotency-Key", UUID.randomUUID())
                .with(jwt().jwt(token -> token.subject(disabledSubject.toString())))
                .contentType("application/json").content(orderBody(1)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("CUSTOMER_ACCOUNT_DISABLED"));
    }

    @Test
    void concurrentMatchingPlacementKeysCreateExactlyOneOrder() throws Exception {
        UUID key = UUID.randomUUID();
        var lines = List.of(new GuestOrderPlacementService.CreateLine(
            MEDIUM_MILK_TEA, 1, List.of(SWEETNESS_50, LESS_ICE, PEARLS)));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                ready.countDown();
                start.await(10, TimeUnit.SECONDS);
                return placement.place(key, null, lines);
            });
            var second = executor.submit(() -> {
                ready.countDown();
                start.await(10, TimeUnit.SECONDS);
                return placement.place(key, null, lines);
            });
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var firstOrder = first.get(15, TimeUnit.SECONDS);
            var secondOrder = second.get(15, TimeUnit.SECONDS);
            assertThat(firstOrder.id()).isEqualTo(secondOrder.id());
            assertThat(List.of(firstOrder.replayed(), secondOrder.replayed()))
                .containsExactlyInAnyOrder(false, true);
        }
        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM customer_order WHERE placement_key = ?", Integer.class, key))
            .isEqualTo(1);
    }

    private String orderBody(int quantity) {
        return """
            {"items":[{"variantId":"%s","quantity":%d,
            "optionChoiceIds":["%s","%s","%s"]}]}
            """.formatted(MEDIUM_MILK_TEA, quantity, SWEETNESS_50, LESS_ICE, PEARLS);
    }
}
