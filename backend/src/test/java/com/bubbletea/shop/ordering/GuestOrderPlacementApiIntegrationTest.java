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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
    private static final UUID ORGANIZATION =
        UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID LOCATION =
        UUID.fromString("20000000-0000-0000-0000-000000000001");
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

    @Autowired com.bubbletea.shop.catalog.CurrencyPriceService currencyPrices;
    @Autowired com.bubbletea.shop.catalog.OptionManagementService optionManagement;

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
    void placesOrderAgainstTheSelectedPublicLocation() throws Exception {
        UUID key = UUID.randomUUID();
        mvc.perform(post("/api/v1/guest/locations/tiong-bahru/orders")
                .header("Idempotency-Key", key)
                .contentType("application/json")
                .content(orderBody(1)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.totalMinor").value(700));

        assertThat(jdbc.queryForObject(
            "SELECT location_id FROM customer_order WHERE placement_key = ?", UUID.class, key))
            .isEqualTo(UUID.fromString("20000000-0000-0000-0000-000000000002"));
    }

    @Test
    void placesThenCompletesOrderAcrossGuestAndStaffApisWithExactInventoryDeduction() throws Exception {
        UUID subject = UUID.randomUUID();
        UUID account = UUID.randomUUID();
        UUID placementKey = UUID.randomUUID();
        UUID blackTea = UUID.fromString("90000000-0000-0000-0000-000000000001");
        UUID freshMilk = UUID.fromString("90000000-0000-0000-0000-000000000005");
        UUID pearls = UUID.fromString("90000000-0000-0000-0000-000000000007");

        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", account, subject);
        jdbc.update("""
            INSERT INTO organization_membership (organization_id, account_id, role, active)
            VALUES (?, ?, 'OWNER', true)
            """, ORGANIZATION, account);
        jdbc.update("""
            INSERT INTO inventory_balance (organization_id, location_id, ingredient_id, quantity)
            VALUES (?, ?, ?, 100), (?, ?, ?, 1000), (?, ?, ?, 500)
            ON CONFLICT (location_id, ingredient_id) DO UPDATE
                SET quantity = EXCLUDED.quantity,
                    organization_id = EXCLUDED.organization_id,
                    updated_at = now()
            """, ORGANIZATION, LOCATION, blackTea,
            ORGANIZATION, LOCATION, freshMilk,
            ORGANIZATION, LOCATION, pearls);

        mvc.perform(post("/api/v1/guest/orders")
                .header("Idempotency-Key", placementKey)
                .contentType("application/json")
                .content(orderBody(1)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.totalMinor").value(720));

        UUID orderId = jdbc.queryForObject(
            "SELECT id FROM customer_order WHERE placement_key = ?", UUID.class, placementKey);
        String staffPath = "/api/v1/staff/organizations/%s/locations/%s/orders/%s/completion"
            .formatted(ORGANIZATION, LOCATION, orderId);
        mvc.perform(post(staffPath).with(jwt().jwt(token -> token.subject(subject.toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("COMPLETED"))
            .andExpect(jsonPath("$.paymentStatus").value("PAID"));

        assertThat(balance(blackTea)).isEqualByComparingTo("92.000000");
        assertThat(balance(freshMilk)).isEqualByComparingTo("800.000000");
        assertThat(balance(pearls)).isEqualByComparingTo("450.000000");
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM inventory_movement
             WHERE customer_order_id = ? AND movement_type = 'SALE'
            """, Integer.class, orderId)).isEqualTo(3);
        assertThat(jdbc.queryForObject("""
            SELECT recorded_by_account_id FROM payment WHERE customer_order_id = ?
            """, UUID.class, orderId)).isEqualTo(account);
        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM order_status_history
             WHERE customer_order_id = ? AND to_status = 'COMPLETED'
            """, Integer.class, orderId)).isEqualTo(1);
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

    @Test
    void staffCreatesAttributedCounterOrderWithoutBecomingCustomerAndReplaysSafely() throws Exception {
        UUID subject = UUID.randomUUID();
        UUID account = UUID.randomUUID();
        UUID key = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", account, subject);
        jdbc.update("INSERT INTO organization_membership (organization_id, account_id, role, active) VALUES (?, ?, 'OWNER', true)", ORGANIZATION, account);
        String path = "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/counter-orders";
        mvc.perform(post(path, ORGANIZATION, LOCATION).with(jwt().jwt(value -> value.subject(subject.toString())))
                .header("Idempotency-Key", key).contentType("application/json").content(orderBody(1)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.paymentMethod").value("CASH"));
        mvc.perform(post(path, ORGANIZATION, LOCATION).with(jwt().jwt(value -> value.subject(subject.toString())))
                .header("Idempotency-Key", UUID.randomUUID()).contentType("application/json").content("{\"items\":[null]}"))
            .andExpect(status().isBadRequest());
        UUID orderId = jdbc.queryForObject("SELECT id FROM customer_order WHERE placement_key = ?", UUID.class, key);
        assertThat(jdbc.queryForObject("SELECT customer_account_id FROM customer_order WHERE id = ?", UUID.class, orderId)).isNull();
        assertThat(jdbc.queryForObject("SELECT changed_by_account_id FROM order_status_history WHERE customer_order_id = ? AND from_status IS NULL", UUID.class, orderId)).isEqualTo(account);
        mvc.perform(post(path, ORGANIZATION, LOCATION).with(jwt().jwt(value -> value.subject(subject.toString())))
                .header("Idempotency-Key", key).contentType("application/json").content(orderBody(1)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(true));
        mvc.perform(post("/api/v1/guest/orders").header("Idempotency-Key", key)
                .contentType("application/json").content(orderBody(1)))
            .andExpect(status().isConflict());
        mvc.perform(post(path, ORGANIZATION, UUID.randomUUID()).with(jwt().jwt(value -> value.subject(subject.toString())))
                .header("Idempotency-Key", UUID.randomUUID()).contentType("application/json").content(orderBody(1)))
            .andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movement WHERE customer_order_id = ?", Integer.class, orderId)).isZero();
    }

    @Test
    void favoriteDiscountIsServerPricedOncePerOrderAndRetainedOnReplay() throws Exception {
        UUID subject = UUID.randomUUID(), account = UUID.randomUUID(), key = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", account, subject);
        String favoritePath = "/api/v1/customer/locations/orchard-central/favorite";
        String favoriteRecipe = "40000000-0000-0000-0000-000000000001";
        mvc.perform(put(favoritePath).with(jwt().jwt(t -> t.subject(subject.toString())))
                .contentType("application/json").content("{\"recipeId\":\"" + favoriteRecipe + "\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.recipeId").value(favoriteRecipe));
        mvc.perform(post("/api/v1/customer/locations/orchard-central/order-quote")
                .with(jwt().jwt(t -> t.subject(subject.toString()))).contentType("application/json").content(orderBody(2)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.subtotalMinor").value(1440))
            .andExpect(jsonPath("$.discountMinor").value(33)).andExpect(jsonPath("$.totalMinor").value(1407));
        mvc.perform(post("/api/v1/guest/orders").with(jwt().jwt(t -> t.subject(subject.toString())))
                .header("Idempotency-Key", key).contentType("application/json").content(orderBody(2)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.totalMinor").value(1407));
        UUID otherSubject = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", UUID.randomUUID(), otherSubject);
        mvc.perform(get(favoritePath).with(jwt().jwt(t -> t.subject(otherSubject.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.recipeId").isEmpty());
        UUID orderId = jdbc.queryForObject("SELECT id FROM customer_order WHERE placement_key = ?", UUID.class, key);
        assertThat(jdbc.queryForObject("SELECT discount_minor FROM customer_order WHERE id = ?", Long.class, orderId)).isEqualTo(33L);
        assertThat(jdbc.queryForObject("SELECT amount_minor FROM payment WHERE customer_order_id = ?", Long.class, orderId)).isEqualTo(1407L);
        mvc.perform(delete(favoritePath).with(jwt().jwt(t -> t.subject(subject.toString())))).andExpect(status().isOk());
        mvc.perform(post("/api/v1/guest/orders").with(jwt().jwt(t -> t.subject(subject.toString())))
                .header("Idempotency-Key", key).contentType("application/json").content(orderBody(2)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.replayed").value(true)).andExpect(jsonPath("$.totalMinor").value(1407));
        mvc.perform(post("/api/v1/guest/orders").with(jwt().jwt(t -> t.subject(subject.toString())))
                .header("Idempotency-Key", UUID.randomUUID()).contentType("application/json").content(orderBody(2)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.totalMinor").value(1440));
    }

    @Test
    void favoriteIsPrivateAndRejectsRecipesOutsideTheCurrentMenu() throws Exception {
        UUID subject = UUID.randomUUID(), account = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", account, subject);
        String path = "/api/v1/customer/locations/orchard-central/favorite";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(put(path).with(jwt().jwt(t -> t.subject(subject.toString())))
                .contentType("application/json").content("{\"recipeId\":\"" + UUID.randomUUID() + "\"}"))
            .andExpect(status().isNotFound());
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(subject.toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.recipeId").isEmpty());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM customer_favorite WHERE account_id = ?", Long.class, account)).isZero();
    }

    @Test
    void favoriteChoosesOneLargestBaseDiscountCapsNegativeOptionsAndExcludesCounterOrders() {
        UUID subject = UUID.randomUUID(), account = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", account, subject);
        jdbc.update("INSERT INTO customer_favorite (account_id, organization_id, recipe_id) VALUES (?, ?, '40000000-0000-0000-0000-000000000001')", account, ORGANIZATION);
        UUID small = UUID.fromString("50000000-0000-0000-0000-000000000001"), large = UUID.fromString("50000000-0000-0000-0000-000000000003");
        var choices = List.of(SWEETNESS_50, LESS_ICE, PEARLS);
        var lines = List.of(new GuestOrderPlacementService.CreateLine(small, 2, choices), new GuestOrderPlacementService.CreateLine(large, 2, choices));
        var quote = placement.quote("orchard-central", subject, lines);
        assertThat(quote.subtotalMinor()).isEqualTo(2940);
        assertThat(quote.discountMinor()).isEqualTo(37);
        assertThat(quote.totalMinor()).isEqualTo(2903);
        jdbc.update("INSERT INTO organization_membership (organization_id, account_id, role) VALUES (?, ?, 'OWNER')", ORGANIZATION, account);
        assertThat(placement.placeCounter(subject, ORGANIZATION, LOCATION, UUID.randomUUID(), lines).totalMinor()).isEqualTo(2940);
        long original = jdbc.queryForObject("SELECT price_delta_minor FROM menu_variant_option_choice WHERE menu_variant_id = ? AND option_choice_id = ?", Long.class, large, PEARLS);
        try {
            jdbc.update("UPDATE menu_variant_option_choice SET price_delta_minor = -739 WHERE menu_variant_id = ? AND option_choice_id = ?", large, PEARLS);
            var reduced = placement.quote("orchard-central", subject, List.of(new GuestOrderPlacementService.CreateLine(large, 1, choices)));
            assertThat(reduced.subtotalMinor()).isEqualTo(1);
            assertThat(reduced.discountMinor()).isEqualTo(1);
            assertThat(reduced.totalMinor()).isZero();
        } finally {
            jdbc.update("UPDATE menu_variant_option_choice SET price_delta_minor = ? WHERE menu_variant_id = ? AND option_choice_id = ?", original, large, PEARLS);
        }
    }


    @Test
    void createsOwnerLocationsAndUsesExplicitCurrencyPricesWithHistoricalReplay() throws Exception {
        UUID subject = UUID.randomUUID(), account = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", account, subject);
        jdbc.update("INSERT INTO organization_membership (organization_id, account_id, role) VALUES (?, ?, 'OWNER')", ORGANIZATION, account);
        String locations = "/api/v1/staff/organizations/" + ORGANIZATION + "/locations";
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        for (String currency : List.of("MYR", "CNY")) {
            String slug = "currency-" + UUID.randomUUID();
            String body = "{\"name\":\"" + slug + "\",\"slug\":\"" + slug + "\",\"currencyCode\":\"" + currency + "\",\"timezone\":\"Asia/Singapore\",\"defaultLocale\":\"en-SG\"}";
            var created = mvc.perform(post(locations).with(jwt().jwt(t -> t.subject(subject.toString())))
                .contentType("application/json").content(body)).andExpect(status().isCreated()).andReturn();
            UUID loc = UUID.fromString(mapper.readTree(created.getResponse().getContentAsString()).get("id").asText());
            mvc.perform(post(locations).with(jwt().jwt(t -> t.subject(subject.toString())))
                .contentType("application/json").content(body)).andExpect(status().isConflict());
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("UPDATE location SET currency_code = 'SGD' WHERE id = ?", loc))
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
            jdbc.update("""
                INSERT INTO menu_variant_offering (organization_id, location_id, menu_variant_id, recipe_version_id, price_minor, currency_code, available)
                SELECT organization_id, ?, menu_variant_id, recipe_version_id, 1000, ?, true FROM menu_variant_offering WHERE location_id = ? AND menu_variant_id = ?
                """, loc, currency, LOCATION, MEDIUM_MILK_TEA);
            String orderPath = "/api/v1/guest/locations/" + slug + "/orders";
            mvc.perform(post(orderPath).header("Idempotency-Key", UUID.randomUUID()).contentType("application/json").content(orderBody(1)))
                .andExpect(status().isConflict());
            String pricePath = "/api/v1/staff/organizations/" + ORGANIZATION + "/variants/" + MEDIUM_MILK_TEA + "/currency-prices/" + currency;
            var response = mvc.perform(get(pricePath).with(jwt().jwt(t -> t.subject(subject.toString())))).andExpect(status().isOk()).andReturn();
            var priceSet = mapper.readTree(response.getResponse().getContentAsString());
            long version = priceSet.get("version").asLong();
            var inputs = new java.util.ArrayList<java.util.Map<String, Object>>();
            UUID pearlsLink = jdbc.queryForObject("SELECT id FROM menu_variant_option_choice WHERE menu_variant_id = ? AND option_choice_id = ?", UUID.class, MEDIUM_MILK_TEA, PEARLS);
            int delta = currency.equals("MYR") ? 150 : 250;
            for (var choice : priceSet.get("choices")) inputs.add(java.util.Map.of("linkId", choice.get("linkId").asText(), "priceDeltaMinor", choice.get("linkId").asText().equals(pearlsLink.toString()) ? delta : 0));
            String prices = mapper.writeValueAsString(java.util.Map.of("version", version, "prices", inputs));
            mvc.perform(put(pricePath).with(jwt().jwt(t -> t.subject(subject.toString()))).contentType("application/json").content(prices)).andExpect(status().isOk());
            mvc.perform(put(pricePath).with(jwt().jwt(t -> t.subject(subject.toString()))).contentType("application/json").content(prices)).andExpect(status().isConflict());
            mvc.perform(get("/api/v1/guest/locations/" + slug + "/menu/products/moonlit-milk-tea"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.variants[0].available").value(true));
            UUID key = UUID.randomUUID();
            mvc.perform(post(orderPath).header("Idempotency-Key", key).contentType("application/json").content(orderBody(1)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.currencyCode").value(currency)).andExpect(jsonPath("$.totalMinor").value(1000 + delta));
            jdbc.update("UPDATE menu_variant_currency_price SET price_delta_minor = price_delta_minor + 500 WHERE menu_variant_option_choice_id = ? AND currency_code = ?", pearlsLink, currency);
            mvc.perform(post(orderPath).header("Idempotency-Key", key).contentType("application/json").content(orderBody(1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalMinor").value(1000 + delta));
        }
        UUID outsider = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", UUID.randomUUID(), outsider);
        mvc.perform(get(locations).with(jwt().jwt(t -> t.subject(outsider.toString())))).andExpect(status().isForbidden());
        UUID outsiderAccount = jdbc.queryForObject("SELECT id FROM account WHERE auth_subject = ?", UUID.class, outsider);
        UUID membership = UUID.randomUUID();
        jdbc.update("INSERT INTO organization_membership (id, organization_id, account_id, role) VALUES (?, ?, ?, 'MANAGER')", membership, ORGANIZATION, outsiderAccount);
        jdbc.update("INSERT INTO location_assignment (membership_id, organization_id, location_id) VALUES (?, ?, ?)", membership, ORGANIZATION, LOCATION);
        mvc.perform(get(locations).with(jwt().jwt(t -> t.subject(outsider.toString())))).andExpect(status().isForbidden());
        mvc.perform(post(locations).with(jwt().jwt(t -> t.subject(subject.toString()))).contentType("application/json")
            .content("{\"name\":\"Invalid\",\"slug\":\"invalid\",\"currencyCode\":\"USD\",\"timezone\":\"Asia/Singapore\",\"defaultLocale\":\"en-SG\"}"))
            .andExpect(status().isBadRequest());
    }


    @Test
    void currencyEditsRejectStaleLegacyChoiceChangesAndRecordTheActor() {
        UUID subject = UUID.randomUUID(), account = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", account, subject);
        jdbc.update("INSERT INTO organization_membership (organization_id, account_id, role) VALUES (?, ?, 'OWNER')", ORGANIZATION, account);
        var snapshot = currencyPrices.get(subject, ORGANIZATION, MEDIUM_MILK_TEA, "SGD");
        UUID link = jdbc.queryForObject("SELECT id FROM menu_variant_option_choice WHERE menu_variant_id = ? AND option_choice_id = ?", UUID.class, MEDIUM_MILK_TEA, PEARLS);
        long version = jdbc.queryForObject("SELECT version FROM menu_variant_option_choice WHERE id = ?", Long.class, link);
        var effects = jdbc.query("SELECT ingredient_id, quantity_delta FROM option_choice_ingredient_effect WHERE menu_variant_option_choice_id = ?", (rs, row) -> new com.bubbletea.shop.catalog.OptionManagementService.EffectInput(rs.getObject("ingredient_id", UUID.class), rs.getBigDecimal("quantity_delta").toPlainString()), link);
        UUID product = jdbc.queryForObject("SELECT menu_product_id FROM menu_variant WHERE id = ?", UUID.class, MEDIUM_MILK_TEA);
        optionManagement.configure(subject, ORGANIZATION, product, MEDIUM_MILK_TEA, PEARLS, new com.bubbletea.shop.catalog.OptionManagementService.ConfigurationInput(true, 60, version, effects));
        var inputs = snapshot.choices().stream().map(choice -> new com.bubbletea.shop.catalog.CurrencyPriceService.PriceInput(choice.linkId(), choice.priceDeltaMinor())).toList();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> currencyPrices.set(subject, ORGANIZATION, MEDIUM_MILK_TEA, "SGD", snapshot.version(), inputs))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        var current = currencyPrices.get(subject, ORGANIZATION, MEDIUM_MILK_TEA, "SGD");
        currencyPrices.set(subject, ORGANIZATION, MEDIUM_MILK_TEA, "SGD", current.version(), inputs);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM catalog_change WHERE actor_account_id = ? AND entity_id = ? AND entity_type = 'MENU_VARIANT'", Long.class, account, MEDIUM_MILK_TEA)).isEqualTo(1);
    }

    private String orderBody(int quantity) {
        return """
            {"items":[{"variantId":"%s","quantity":%d,
            "optionChoiceIds":["%s","%s","%s"]}]}
            """.formatted(MEDIUM_MILK_TEA, quantity, SWEETNESS_50, LESS_ICE, PEARLS);
    }

    private BigDecimal balance(UUID ingredientId) {
        return jdbc.queryForObject("""
            SELECT quantity FROM inventory_balance
             WHERE location_id = ? AND ingredient_id = ?
            """, BigDecimal.class, LOCATION, ingredientId);
    }
}
