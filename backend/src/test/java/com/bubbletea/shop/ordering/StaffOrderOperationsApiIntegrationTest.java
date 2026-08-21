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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
class StaffOrderOperationsApiIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:18.4-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder jwtDecoder;

    @Test
    void listsAndLoadsDeterministicServerOwnedOrderSnapshots() throws Exception {
        Fixture fixture = fixture("OWNER", true);
        UUID order = pendingOrder(fixture, "QUEUE-001", "2.500000", 760);

        mvc.perform(get(path(fixture) + "?status=PENDING&page=0&size=25").with(token(fixture)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].id").value(order.toString()))
            .andExpect(jsonPath("$.items[0].publicOrderNumber").value("QUEUE-001"))
            .andExpect(jsonPath("$.items[0].paymentStatus").value("PENDING"))
            .andExpect(jsonPath("$.items[0].itemQuantity").value(1));

        mvc.perform(get(path(fixture) + "/" + order).with(token(fixture)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.lines[0].lineNumber").value(1))
            .andExpect(jsonPath("$.lines[0].productName").value("Moonlit Milk Tea"))
            .andExpect(jsonPath("$.lines[0].options[0].selectionNumber").value(1))
            .andExpect(jsonPath("$.requirements[0].ingredientName").value("Assam Tea"))
            .andExpect(jsonPath("$.requirements[0].requiredQuantity").value("2.500000"))
            .andExpect(jsonPath("$.requirements[0].availableQuantity").value("10.000000"))
            .andExpect(jsonPath("$.requirements[0].sufficient").value(true));
    }

    @Test
    void completesCashPaymentAndInventoryExactlyOnce() throws Exception {
        Fixture fixture = fixture("OWNER", true);
        UUID order = pendingOrder(fixture, "COMPLETE-001", "2.500000", 760);

        mvc.perform(post(path(fixture) + "/" + order + "/completion").with(token(fixture)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("COMPLETED"))
            .andExpect(jsonPath("$.paymentStatus").value("PAID"))
            .andExpect(jsonPath("$.completedAt").isNotEmpty());
        mvc.perform(post(path(fixture) + "/" + order + "/completion").with(token(fixture)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("COMPLETED"));

        assertThat(jdbc.queryForObject("SELECT quantity FROM inventory_balance WHERE location_id = ? AND ingredient_id = ?",
            BigDecimal.class, fixture.locationId(), fixture.ingredientId())).isEqualByComparingTo("7.500000");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movement WHERE customer_order_id = ? AND movement_type = 'SALE'",
            Integer.class, order)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT recorded_by_account_id FROM payment WHERE customer_order_id = ?",
            UUID.class, order)).isEqualTo(fixture.accountId());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM order_status_history WHERE customer_order_id = ? AND to_status = 'COMPLETED'",
            Integer.class, order)).isEqualTo(1);
    }

    @Test
    void returnsNamedShortagesAndRollsBackEveryStateChange() throws Exception {
        Fixture fixture = fixture("OWNER", true);
        UUID order = pendingOrder(fixture, "SHORT-001", "12.000000", 760);

        mvc.perform(post(path(fixture) + "/" + order + "/completion").with(token(fixture)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ORDER_INSUFFICIENT_STOCK"))
            .andExpect(jsonPath("$.shortages[0].ingredientId").value(fixture.ingredientId().toString()))
            .andExpect(jsonPath("$.shortages[0].ingredientName").value("Assam Tea"))
            .andExpect(jsonPath("$.shortages[0].requiredQuantity").value("12.000000"))
            .andExpect(jsonPath("$.shortages[0].availableQuantity").value("10.000000"));

        assertThat(jdbc.queryForObject("SELECT status FROM customer_order WHERE id = ?", String.class, order))
            .isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT status FROM payment WHERE customer_order_id = ?", String.class, order))
            .isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT quantity FROM inventory_balance WHERE location_id = ? AND ingredient_id = ?",
            BigDecimal.class, fixture.locationId(), fixture.ingredientId())).isEqualByComparingTo("10.000000");
    }

    @Test
    void enforcesManagerLocationScopeAndFailsClosedOnInvalidPaymentState() throws Exception {
        Fixture manager = fixture("MANAGER", true);
        Fixture foreign = fixture("OWNER", true);
        UUID order = pendingOrder(manager, "MANAGER-001", "1.000000", 500);

        mvc.perform(get(path(manager)).with(token(manager))).andExpect(status().isOk());
        mvc.perform(get(path(foreign)).with(token(manager)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("STAFF_ACCESS_DENIED"));
        mvc.perform(get(path(manager) + "?status=READY").with(token(manager)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("ORDER_INVALID"));

        jdbc.update("UPDATE payment SET amount_minor = 1 WHERE customer_order_id = ?", order);
        mvc.perform(post(path(manager) + "/" + order + "/completion").with(token(manager)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ORDER_STATE_CONFLICT"));
        assertThat(jdbc.queryForObject("SELECT status FROM customer_order WHERE id = ?", String.class, order))
            .isEqualTo("PENDING");
    }

    private Fixture fixture(String role, boolean assign) {
        UUID subject = UUID.randomUUID();
        UUID account = UUID.randomUUID();
        UUID organization = UUID.randomUUID();
        UUID location = UUID.randomUUID();
        UUID ingredient = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", account, subject);
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, ?)", organization, "Orders " + organization);
        jdbc.update("INSERT INTO organization_membership (organization_id, account_id, role, active) VALUES (?, ?, ?, true)",
            organization, account, role);
        jdbc.update("INSERT INTO location (id, organization_id, name, timezone, currency_code) VALUES (?, ?, 'Test Shop', 'Asia/Singapore', 'SGD')",
            location, organization);
        if (assign && role.equals("MANAGER")) {
            UUID membership = jdbc.queryForObject("SELECT id FROM organization_membership WHERE organization_id = ? AND account_id = ?",
                UUID.class, organization, account);
            jdbc.update("INSERT INTO location_assignment (organization_id, membership_id, location_id) VALUES (?, ?, ?)",
                organization, membership, location);
        }
        jdbc.update("INSERT INTO ingredient (id, organization_id, name, sku, base_unit) VALUES (?, ?, 'Assam Tea', ?, 'GRAM')",
            ingredient, organization, "TEA-" + ingredient);
        jdbc.update("INSERT INTO inventory_balance (organization_id, location_id, ingredient_id, quantity) VALUES (?, ?, ?, 10)",
            organization, location, ingredient);
        return new Fixture(subject, account, organization, location, ingredient);
    }

    private UUID pendingOrder(Fixture fixture, String number, String consumption, long total) {
        UUID order = UUID.randomUUID();
        UUID item = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO customer_order (id, organization_id, location_id, public_order_number,
                status, payment_method, currency_code, subtotal_minor, total_minor)
            VALUES (?, ?, ?, ?, 'PENDING', 'CASH', 'SGD', ?, ?)
            """, order, fixture.organizationId(), fixture.locationId(), number, total, total);
        jdbc.update("""
            INSERT INTO order_item (id, organization_id, customer_order_id, line_number,
                product_name_snapshot, variant_name_snapshot, quantity, unit_price_minor, line_total_minor)
            VALUES (?, ?, ?, 1, 'Moonlit Milk Tea', 'Medium', 1, ?, ?)
            """, item, fixture.organizationId(), order, total, total);
        jdbc.update("""
            INSERT INTO order_item_option (id, organization_id, order_item_id, selection_number,
                group_name_snapshot, choice_name_snapshot, price_delta_minor)
            VALUES (?, ?, ?, 1, 'Sweetness', '50%', 0)
            """, UUID.randomUUID(), fixture.organizationId(), item);
        jdbc.update("""
            INSERT INTO order_item_consumption (id, organization_id, order_item_id, ingredient_id, quantity)
            VALUES (?, ?, ?, ?, ?::numeric)
            """, UUID.randomUUID(), fixture.organizationId(), item, fixture.ingredientId(), consumption);
        jdbc.update("""
            INSERT INTO payment (id, organization_id, customer_order_id, method, status, amount_minor, currency_code)
            VALUES (?, ?, ?, 'CASH', 'PENDING', ?, 'SGD')
            """, UUID.randomUUID(), fixture.organizationId(), order, total);
        jdbc.update("""
            INSERT INTO order_status_history (id, organization_id, customer_order_id, from_status, to_status)
            VALUES (?, ?, ?, NULL, 'PENDING')
            """, UUID.randomUUID(), fixture.organizationId(), order);
        return order;
    }

    private String path(Fixture fixture) {
        return "/api/v1/staff/organizations/%s/locations/%s/orders"
            .formatted(fixture.organizationId(), fixture.locationId());
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor token(Fixture fixture) {
        return jwt().jwt(value -> value.subject(fixture.authSubject().toString()));
    }

    private record Fixture(UUID authSubject, UUID accountId, UUID organizationId,
                           UUID locationId, UUID ingredientId) { }
}
