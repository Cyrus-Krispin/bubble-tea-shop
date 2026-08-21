package com.bubbletea.shop.inventory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
class InventoryManagementApiIntegrationTest {
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
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void listsZeroBalancesAndRecordsImmutableActorAttributedHistory() throws Exception {
        Staff owner = staff("OWNER");
        UUID locationId = location(owner.organizationId(), "Orchard", "SGD");
        UUID tea = ingredient(owner.organizationId(), "Assam Tea", "TEA-1", "GRAM", "5.000000");
        ingredient(owner.organizationId(), "Pearls", "PEARL-1", "EACH", null);

        mvc.perform(get(balancePath(), owner.organizationId(), locationId).with(token(owner))
                .queryParam("query", "tea"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].quantity").value("0"))
            .andExpect(jsonPath("$.items[0].belowReorderThreshold").value(true))
            .andExpect(jsonPath("$.items[0].openingRecorded").value(false));
        mvc.perform(get(movementPath(), owner.organizationId(), locationId).with(token(owner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0))
            .andExpect(jsonPath("$.items").isEmpty());

        UUID opening = record(owner, locationId, """
            {"ingredientId":"%s","movementType":"OPENING","quantityDelta":"10.000000",
             "sourceReference":"COUNT-1","note":"Opening count","totalCostMinor":null}
            """.formatted(tea)).get("id").traverse(json).readValueAs(UUID.class);
        record(owner, locationId, """
            {"ingredientId":"%s","movementType":"RECEIPT","quantityDelta":"5.500000",
             "sourceReference":"PO-42","note":"Morning delivery","totalCostMinor":2400}
            """.formatted(tea));
        record(owner, locationId, """
            {"ingredientId":"%s","movementType":"ADJUSTMENT","quantityDelta":"-2.250000",
             "sourceReference":null,"note":"Count correction","totalCostMinor":null}
            """.formatted(tea));

        mvc.perform(get(balancePath(), owner.organizationId(), locationId).with(token(owner))
                .queryParam("query", "TEA-1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].quantity").value("13.250000"))
            .andExpect(jsonPath("$.items[0].version").value(3))
            .andExpect(jsonPath("$.items[0].openingRecorded").value(true));
        mvc.perform(get(movementPath(), owner.organizationId(), locationId).with(token(owner))
                .queryParam("ingredientId", tea.toString()).queryParam("movementType", "RECEIPT"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].totalCostMinor").value(2400))
            .andExpect(jsonPath("$.items[0].currencyCode").value("SGD"));

        assertThat(jdbc.queryForObject("SELECT actor_account_id FROM inventory_movement WHERE id = ?",
            UUID.class, opening)).isEqualTo(owner.accountId());
        assertThatThrownBy(() -> jdbc.update(
            "UPDATE inventory_movement SET note = 'rewritten' WHERE id = ?", opening))
            .isInstanceOf(DataAccessException.class)
            .hasMessageContaining("inventory movements are immutable");
    }

    @Test
    void rejectsDuplicateOpeningInvalidManualTypesAndAtomicShortages() throws Exception {
        Staff owner = staff("OWNER");
        UUID locationId = location(owner.organizationId(), "Harbour", "USD");
        UUID tea = ingredient(owner.organizationId(), "Ceylon Tea", null, "GRAM", null);
        record(owner, locationId, """
            {"ingredientId":"%s","movementType":"OPENING","quantityDelta":"2.000000"}
            """.formatted(tea));

        mvc.perform(post(movementPath(), owner.organizationId(), locationId).with(token(owner))
                .contentType("application/json").content("""
                    {"ingredientId":"%s","movementType":"OPENING","quantityDelta":"1.000000"}
                    """.formatted(tea)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INVENTORY_STATE_CONFLICT"));
        mvc.perform(post(movementPath(), owner.organizationId(), locationId).with(token(owner))
                .contentType("application/json").content("""
                    {"ingredientId":"%s","movementType":"ADJUSTMENT","quantityDelta":"-3.000000",
                     "note":"Damaged stock"}
                    """.formatted(tea)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INVENTORY_INSUFFICIENT_STOCK"))
            .andExpect(jsonPath("$.shortages.%s.available".formatted(tea)).value("2.000000"));
        mvc.perform(post(movementPath(), owner.organizationId(), locationId).with(token(owner))
                .contentType("application/json").content("""
                    {"ingredientId":"%s","movementType":"ADJUSTMENT","quantityDelta":"1.000000"}
                    """.formatted(tea)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVENTORY_INVALID"));
        mvc.perform(post(movementPath(), owner.organizationId(), locationId).with(token(owner))
                .contentType("application/json").content("""
                    {"ingredientId":"%s","movementType":"SALE","quantityDelta":"-1.000000"}
                    """.formatted(tea)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVENTORY_INVALID"));

        assertThat(jdbc.queryForObject("SELECT quantity FROM inventory_balance WHERE location_id = ? AND ingredient_id = ?",
            java.math.BigDecimal.class, locationId, tea)).isEqualByComparingTo("2.000000");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movement WHERE location_id = ? AND ingredient_id = ?",
            Integer.class, locationId, tea)).isEqualTo(1);
    }

    @Test
    void enforcesAssignedLocationAndOrganizationIngredientScope() throws Exception {
        Staff manager = staff("MANAGER");
        UUID assigned = location(manager.organizationId(), "Assigned", "JPY");
        UUID unassigned = location(manager.organizationId(), "Unassigned", "JPY");
        assign(manager, assigned);
        UUID ingredient = ingredient(manager.organizationId(), "Matcha", null, "GRAM", null);
        UUID foreignIngredient = ingredient(staff("OWNER").organizationId(), "Foreign", null, "GRAM", null);

        mvc.perform(get(balancePath(), manager.organizationId(), assigned).with(token(manager)))
            .andExpect(status().isOk());
        mvc.perform(get(balancePath(), manager.organizationId(), unassigned).with(token(manager)))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("STAFF_ACCESS_DENIED"));
        mvc.perform(post(movementPath(), manager.organizationId(), assigned).with(token(manager))
                .contentType("application/json").content("""
                    {"ingredientId":"%s","movementType":"OPENING","quantityDelta":"3.000000"}
                    """.formatted(foreignIngredient)))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("INVENTORY_NOT_FOUND"));

        record(manager, assigned, """
            {"ingredientId":"%s","movementType":"RECEIPT","quantityDelta":"3.000000",
             "totalCostMinor":900}
            """.formatted(ingredient));
        assertThat(jdbc.queryForObject("SELECT currency_code FROM inventory_movement WHERE location_id = ?",
            String.class, assigned)).isEqualTo("JPY");
    }

    @Test
    void paginatesBalanceSearchAndIncludesArchivedOnlyWhenRequested() throws Exception {
        Staff owner = staff("OWNER");
        UUID locationId = location(owner.organizationId(), "City", "SGD");
        ingredient(owner.organizationId(), "Alpha Tea", "A-1", "GRAM", null);
        UUID archived = ingredient(owner.organizationId(), "Archived Tea", "A-2", "GRAM", null);
        jdbc.update("UPDATE ingredient SET archived_at = now() WHERE id = ?", archived);
        ingredient(owner.organizationId(), "Beta Pearls", "B-1", "EACH", null);

        mvc.perform(get(balancePath(), owner.organizationId(), locationId).with(token(owner))
                .queryParam("page", "0").queryParam("size", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(2))
            .andExpect(jsonPath("$.totalPages").value(2))
            .andExpect(jsonPath("$.items[0].ingredientName").value("Alpha Tea"));
        mvc.perform(get(balancePath(), owner.organizationId(), locationId).with(token(owner))
                .queryParam("query", "archived").queryParam("includeArchived", "true"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].ingredientArchived").value(true));
    }

    private JsonNode record(Staff staff, UUID locationId, String body) throws Exception {
        MvcResult result = mvc.perform(post(movementPath(), staff.organizationId(), locationId)
                .with(token(staff)).contentType("application/json").content(body))
            .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    private String balancePath() {
        return "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory/balances";
    }

    private String movementPath() {
        return "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory/movements";
    }

    private Staff staff(String role) {
        UUID subject = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", accountId, subject);
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, ?)", organizationId,
            "Inventory Test " + organizationId);
        jdbc.update("""
            INSERT INTO organization_membership (organization_id, account_id, role, active)
            VALUES (?, ?, ?, true)
            """, organizationId, accountId, role);
        return new Staff(subject, accountId, organizationId);
    }

    private UUID location(UUID organizationId, String name, String currency) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, ?, 'Asia/Singapore', ?)
            """, id, organizationId, name, currency);
        return id;
    }

    private UUID ingredient(UUID organizationId, String name, String sku, String unit, String threshold) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO ingredient (id, organization_id, name, sku, base_unit, reorder_threshold)
            VALUES (?, ?, ?, ?, ?, ?::numeric)
            """, id, organizationId, name, sku, unit, threshold);
        return id;
    }

    private void assign(Staff staff, UUID locationId) {
        UUID membershipId = jdbc.queryForObject("""
            SELECT id FROM organization_membership WHERE organization_id = ? AND account_id = ?
            """, UUID.class, staff.organizationId(), staff.accountId());
        jdbc.update("""
            INSERT INTO location_assignment (organization_id, membership_id, location_id)
            VALUES (?, ?, ?)
            """, staff.organizationId(), membershipId, locationId);
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor token(Staff staff) {
        return jwt().jwt(value -> value.subject(staff.authSubject().toString()));
    }

    private record Staff(UUID authSubject, UUID accountId, UUID organizationId) { }
}
