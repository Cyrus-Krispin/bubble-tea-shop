package com.bubbletea.shop.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest(properties = {
    "app.security.supabase.enabled=true",
    "app.security.supabase.issuer=http://localhost:8000/auth/v1",
    "app.security.supabase.jwk-set-uri=http://localhost:8000/auth/v1/.well-known/jwks.json"
})
@AutoConfigureMockMvc
class IngredientManagementApiIntegrationTest {
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
    void ownerCreatesNormalizedIngredientWithAnAttributedAuditRecord() throws Exception {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = account(authSubject);
        UUID organizationId = organization();
        membership(organizationId, accountId, "OWNER");

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json")
                .content("""
                    {
                      "name": "  Assam Tea  ",
                      "sku": " tea-001 ",
                      "baseUnit": "GRAM",
                      "reorderThreshold": "1250.500000"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Assam Tea"))
            .andExpect(jsonPath("$.sku").value("TEA-001"))
            .andExpect(jsonPath("$.baseUnit").value("GRAM"))
            .andExpect(jsonPath("$.reorderThreshold").value("1250.500000"))
            .andExpect(jsonPath("$.version").value(0))
            .andExpect(jsonPath("$.archived").value(false));

        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM catalog_change WHERE actor_account_id = ? AND action = 'CREATE'",
            Integer.class,
            accountId)).isEqualTo(1);
    }

    @Test
    void managerNeedsAnActiveLocationAssignmentForCatalogAccess() throws Exception {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = account(authSubject);
        UUID organizationId = organization();
        UUID membershipId = membership(organizationId, accountId, "MANAGER");

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json")
                .content(validIngredientJson("Pearls", "PEARL-1")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("STAFF_ACCESS_DENIED"));

        assignActiveLocation(organizationId, membershipId);
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json")
                .content(validIngredientJson("Pearls", "PEARL-1")))
            .andExpect(status().isCreated());
    }

    @Test
    void listsOnlyAuthorizedOrganizationWithSearchPaginationAndArchiveFilter() throws Exception {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = account(authSubject);
        UUID organizationId = organization();
        membership(organizationId, accountId, "OWNER");
        ingredient(organizationId, "Black Tea", "TEA-2", false);
        ingredient(organizationId, "Assam Tea", "TEA-1", false);
        ingredient(organizationId, "Archived Tea", "TEA-0", true);
        ingredient(organizationId, "50% Syrup", "SYRUP-50", false);
        ingredient(organization(), "Other Tea", "OTHER-1", false);

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .queryParam("page", "0")
                .queryParam("size", "1")
                .queryParam("query", "tea"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].name").value("Assam Tea"))
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(1))
            .andExpect(jsonPath("$.totalItems").value(2))
            .andExpect(jsonPath("$.totalPages").value(2));

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .queryParam("includeArchived", "true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(4));

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .queryParam("query", "%"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].name").value("50% Syrup"));
    }

    @Test
    void updateRejectsStaleVersionsAndArchiveIsRetrySafe() throws Exception {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = account(authSubject);
        UUID organizationId = organization();
        membership(organizationId, accountId, "OWNER");
        UUID ingredientId = ingredient(organizationId, "Milk", "MILK-1", false);

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}",
                organizationId, ingredientId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json")
                .content("""
                    {"name":"Oat Milk","sku":"milk-2","reorderThreshold":"20.000000","version":0}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Oat Milk"))
            .andExpect(jsonPath("$.sku").value("MILK-2"))
            .andExpect(jsonPath("$.baseUnit").value("MILLILITER"))
            .andExpect(jsonPath("$.version").value(1));

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}",
                organizationId, ingredientId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json")
                .content("""
                    {"name":"Stale Milk","sku":"MILK-3","reorderThreshold":null,"version":0}
                    """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INGREDIENT_VERSION_CONFLICT"));

        String archive = "{\"version\":1}";
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}/archive",
                organizationId, ingredientId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json").content(archive))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.archived").value(true))
            .andExpect(jsonPath("$.version").value(2));
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}/archive",
                organizationId, ingredientId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json").content(archive))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(2));

        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM catalog_change WHERE entity_id = ?", Integer.class, ingredientId))
            .isEqualTo(2);
    }

    @Test
    void rejectsDuplicateNormalizedNamesInvalidQuantitiesAndCrossOrganizationIds() throws Exception {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = account(authSubject);
        UUID organizationId = organization();
        membership(organizationId, accountId, "OWNER");
        ingredient(organizationId, "Brown Sugar", "SUGAR-1", false);

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json")
                .content(validIngredientJson("brown sugar", "SUGAR-2")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INGREDIENT_CONFLICT"));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json")
                .content("""
                    {"name":"Bad","baseUnit":"GRAM","reorderThreshold":"1.0000001"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INGREDIENT_INVALID"));

        UUID foreignIngredient = ingredient(organization(), "Foreign", "FOREIGN-1", false);
        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}",
                organizationId, foreignIngredient)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType("application/json")
                .content("""
                    {"name":"Hidden","sku":null,"reorderThreshold":null,"version":0}
                    """))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("INGREDIENT_NOT_FOUND"));
    }

    @Test
    void enforcesAuthenticationOrganizationScopeAndRequiredVersions() throws Exception {
        UUID authSubject = UUID.randomUUID();
        UUID accountId = account(authSubject);
        UUID organizationId = organization();
        membership(organizationId, accountId, "OWNER");
        UUID ingredientId = ingredient(organizationId, "Tapioca", "TAP-1", false);

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId))
            .andExpect(status().isUnauthorized());

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/ingredients", organization())
                .with(jwt().jwt(token -> token.subject(authSubject.toString()))))
            .andExpect(status().isForbidden())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.code").value("STAFF_ACCESS_DENIED"));

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .queryParam("size", "0"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INGREDIENT_INVALID"));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/ingredients", organizationId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Bad unit","sku":null,"baseUnit":"LITER","reorderThreshold":null}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INGREDIENT_INVALID"));

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}",
                organizationId, ingredientId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Tapioca Pearls","sku":"TAP-2","reorderThreshold":null}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INGREDIENT_INVALID"));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/ingredients/{ingredientId}/archive",
                organizationId, ingredientId)
                .with(jwt().jwt(token -> token.subject(authSubject.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INGREDIENT_INVALID"));
    }

    private UUID account(UUID authSubject) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)",
            id, authSubject);
        return id;
    }

    private UUID organization() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, 'Ingredient Test Shop')", id);
        return id;
    }

    private UUID membership(UUID organizationId, UUID accountId, String role) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO organization_membership (id, organization_id, account_id, role, active)
            VALUES (?, ?, ?, ?, true)
            """, id, organizationId, accountId, role);
        return id;
    }

    private void assignActiveLocation(UUID organizationId, UUID membershipId) {
        UUID locationId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, 'Assigned Shop', 'Asia/Singapore', 'SGD')
            """, locationId, organizationId);
        jdbc.update("""
            INSERT INTO location_assignment (organization_id, membership_id, location_id)
            VALUES (?, ?, ?)
            """, organizationId, membershipId, locationId);
    }

    private UUID ingredient(UUID organizationId, String name, String sku, boolean archived) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO ingredient (
                id, organization_id, name, sku, base_unit, reorder_threshold, archived_at
            ) VALUES (?, ?, ?, ?, 'MILLILITER', 10.000000,
                      CASE WHEN ? THEN now() ELSE NULL END)
            """, id, organizationId, name, sku, archived);
        return id;
    }

    private String validIngredientJson(String name, String sku) {
        return """
            {"name":"%s","sku":"%s","baseUnit":"EACH","reorderThreshold":"10.000000"}
            """.formatted(name, sku);
    }
}
