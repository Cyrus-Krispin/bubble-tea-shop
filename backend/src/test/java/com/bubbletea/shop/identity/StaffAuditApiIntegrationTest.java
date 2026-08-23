package com.bubbletea.shop.identity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
class StaffAuditApiIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18.4-alpine");

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
    void ownerSeesUnifiedDeterministicTimelineAndCategoryFilter() throws Exception {
        Fixture fixture = fixture("OWNER", true);
        UUID catalogEvent = events(fixture);

        mvc.perform(get(path(fixture) + "?size=10").with(token(fixture)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(4))
            .andExpect(jsonPath("$.items[0].category").value("STAFF"))
            .andExpect(jsonPath("$.items[0].entityType").value("MANAGER_MEMBERSHIP"))
            .andExpect(jsonPath("$.items[1].category").value("ORDER"))
            .andExpect(jsonPath("$.items[1].entityLabel").value("AUDIT-001"))
            .andExpect(jsonPath("$.items[2].category").value("INVENTORY"))
            .andExpect(jsonPath("$.items[2].detail").value("5.000000 GRAM"))
            .andExpect(jsonPath("$.items[3].id").value(catalogEvent.toString()))
            .andExpect(jsonPath("$.items[3].entityLabel").value("Audit Tea"));

        mvc.perform(get(path(fixture) + "?category=CATALOG").with(token(fixture)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].category").value("CATALOG"));
    }

    @Test
    void managerSeesCatalogAndAssignedLocationEventsButNotForeignOperations() throws Exception {
        Fixture assigned = fixture("MANAGER", true);
        events(assigned);
        UUID foreignLocation = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, 'Foreign', 'Asia/Singapore', 'SGD')
            """,
            foreignLocation, assigned.organization());
        jdbc.update("""
            INSERT INTO inventory_movement (organization_id, location_id, ingredient_id,
                movement_type, quantity_delta, actor_account_id)
            VALUES (?, ?, ?, 'RECEIPT', 9, ?)
            """, assigned.organization(), foreignLocation, assigned.ingredient(), assigned.account());

        mvc.perform(get(path(assigned)).with(token(assigned)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(3));

        Fixture other = fixture("OWNER", true);
        mvc.perform(get(path(other)).with(token(assigned)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("STAFF_ACCESS_DENIED"));
    }

    @Test
    void sourceAuditRowsAreDatabaseImmutable() {
        Fixture fixture = fixture("OWNER", true);
        UUID event = events(fixture);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM catalog_change WHERE id = ?", event))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("catalog changes are immutable");
        UUID history = jdbc.queryForObject(
            "SELECT id FROM order_status_history WHERE organization_id = ?",
            UUID.class,
            fixture.organization());
        assertThatThrownBy(() -> jdbc.update(
            "UPDATE order_status_history SET to_status = 'COMPLETED' WHERE id = ?",
            history))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("order snapshots and status history are immutable");
    }

    private Fixture fixture(String role, boolean assigned) {
        UUID subject = UUID.randomUUID();
        UUID account = UUID.randomUUID();
        UUID organization = UUID.randomUUID();
        UUID location = UUID.randomUUID();
        UUID ingredient = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", account, subject);
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, 'Audit Org')", organization);
        jdbc.update("INSERT INTO organization_membership (organization_id, account_id, role, active) VALUES (?, ?, ?, true)",
            organization, account, role);
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, 'Audit Shop', 'Asia/Singapore', 'SGD')
            """,
            location, organization);
        if (role.equals("MANAGER") && assigned) {
            UUID membership = jdbc.queryForObject("SELECT id FROM organization_membership WHERE organization_id = ? AND account_id = ?",
                UUID.class, organization, account);
            jdbc.update("INSERT INTO location_assignment (organization_id, membership_id, location_id) VALUES (?, ?, ?)",
                organization, membership, location);
        }
        jdbc.update("INSERT INTO ingredient (id, organization_id, name, sku, base_unit) VALUES (?, ?, 'Audit Tea', ?, 'GRAM')",
            ingredient, organization, "AUDIT-" + ingredient);
        return new Fixture(subject, account, organization, location, ingredient);
    }

    private UUID events(Fixture fixture) {
        UUID catalogEvent = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO catalog_change (id, organization_id, entity_type, entity_id, action,
                actor_account_id, occurred_at)
            VALUES (?, ?, 'INGREDIENT', ?, 'CREATE', ?, now() - interval '2 minutes')
            """, catalogEvent, fixture.organization(), fixture.ingredient(), fixture.account());
        jdbc.update("""
            INSERT INTO inventory_movement (organization_id, location_id, ingredient_id,
                movement_type, quantity_delta, actor_account_id, created_at)
            VALUES (?, ?, ?, 'RECEIPT', 5, ?, now() - interval '1 minute')
            """, fixture.organization(), fixture.location(), fixture.ingredient(), fixture.account());
        UUID order = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO customer_order (id, organization_id, location_id, public_order_number,
                status, payment_method, currency_code, subtotal_minor, total_minor)
            VALUES (?, ?, ?, 'AUDIT-001', 'PENDING', 'CASH', 'SGD', 500, 500)
            """, order, fixture.organization(), fixture.location());
        jdbc.update("""
            INSERT INTO order_status_history (organization_id, customer_order_id, from_status,
                to_status, changed_by_account_id)
            VALUES (?, ?, NULL, 'PENDING', ?)
            """, fixture.organization(), order, fixture.account());
        UUID managerAccount = UUID.randomUUID();
        UUID managerMembership = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, email, enabled) VALUES (?, ?, true)",
            managerAccount, "audit-manager-" + managerAccount.toString().substring(0, 8) + "@example.test");
        jdbc.update("""
            INSERT INTO organization_membership (id, organization_id, account_id, role)
            VALUES (?, ?, ?, 'MANAGER')
            """, managerMembership, fixture.organization(), managerAccount);
        jdbc.update("""
            INSERT INTO staff_access_change
                (organization_id, membership_id, action, actor_account_id, occurred_at)
            VALUES (?, ?, 'CREATE', ?, now() + interval '1 minute')
            """, fixture.organization(), managerMembership, fixture.account());
        return catalogEvent;
    }

    private String path(Fixture fixture) {
        return "/api/v1/staff/organizations/%s/audit-events".formatted(fixture.organization());
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor token(Fixture fixture) {
        return jwt().jwt(value -> value.subject(fixture.subject().toString()));
    }

    private record Fixture(UUID subject, UUID account, UUID organization, UUID location, UUID ingredient) { }
}
