package com.bubbletea.shop.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class RecipeManagementApiIntegrationTest {
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
    private final ObjectMapper json = new ObjectMapper();
    @MockitoBean JwtDecoder jwtDecoder;

    @Test
    void createsARecipeWithAnAttributedEmptyDraft() throws Exception {
        Staff staff = owner();

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes", staff.organizationId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("""
                    {"name":"  Classic Milk Tea  ","description":"  House black tea  "}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Classic Milk Tea"))
            .andExpect(jsonPath("$.description").value("House black tea"))
            .andExpect(jsonPath("$.version").value(0))
            .andExpect(jsonPath("$.archived").value(false))
            .andExpect(jsonPath("$.versions.length()").value(1))
            .andExpect(jsonPath("$.versions[0].versionNumber").value(1))
            .andExpect(jsonPath("$.versions[0].status").value("DRAFT"))
            .andExpect(jsonPath("$.versions[0].version").value(0))
            .andExpect(jsonPath("$.versions[0].components.length()").value(0));

        assertThat(jdbc.queryForObject("""
            SELECT count(*) FROM catalog_change
             WHERE actor_account_id = ? AND action IN ('CREATE', 'CREATE_VERSION')
            """, Integer.class, staff.accountId())).isEqualTo(2);
    }

    @Test
    void replacesADraftFormulaPublishesItAndRejectsFurtherEdits() throws Exception {
        Staff staff = owner();
        UUID ingredientId = ingredient(staff.organizationId(), "Assam Tea", "GRAM");
        JsonNode created = createRecipe(staff, "Milk Tea");
        UUID recipeId = UUID.fromString(created.get("id").asText());
        UUID versionId = UUID.fromString(created.get("versions").get(0).get("id").asText());

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("""
                    {"version":0,"components":[{"ingredientId":"%s","quantity":"12.500000"}]}
                    """.formatted(ingredientId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(1))
            .andExpect(jsonPath("$.components[0].ingredientName").value("Assam Tea"))
            .andExpect(jsonPath("$.components[0].baseUnit").value("GRAM"))
            .andExpect(jsonPath("$.components[0].quantity").value("12.500000"));

        UUID foreignIngredient = ingredient(owner().organizationId(), "Foreign Tea", "GRAM");
        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("""
                    {"version":1,"components":[{"ingredientId":"%s","quantity":"1.000000"}]}
                    """.formatted(foreignIngredient)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("RECIPE_INVALID"));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/publish",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":1}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PUBLISHED"))
            .andExpect(jsonPath("$.version").value(2))
            .andExpect(jsonPath("$.publishedAt").isNotEmpty());

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("{\"version\":2,\"components\":[]}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RECIPE_STATE_CONFLICT"));

        assertThat(jdbc.queryForObject(
            "SELECT count(*) FROM catalog_change WHERE entity_id = ?", Integer.class, versionId))
            .isEqualTo(3);
    }

    @Test
    void clonesThePublishedFormulaIntoOneOptimisticallyCreatedNextDraft() throws Exception {
        Staff staff = owner();
        PublishedRecipe published = publishedRecipe(staff);

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions",
                staff.organizationId(), published.recipeId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("{\"version\":0,\"sourceVersionId\":null}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.versionNumber").value(2))
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.components.length()").value(1))
            .andExpect(jsonPath("$.components[0].ingredientId")
                .value(published.ingredientId().toString()));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions",
                staff.organizationId(), published.recipeId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("{\"version\":1,\"sourceVersionId\":null}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RECIPE_STATE_CONFLICT"));
    }

    @Test
    void listsUpdatesDetailsAndArchivesRecipesWithoutDeletingHistory() throws Exception {
        Staff staff = owner();
        JsonNode created = createRecipe(staff, "Black Tea");
        UUID recipeId = UUID.fromString(created.get("id").asText());
        createRecipe(staff, "Fruit Tea");

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}",
                staff.organizationId(), recipeId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("{\"name\":\"Renamed Tea\",\"description\":null,\"version\":0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Renamed Tea"))
            .andExpect(jsonPath("$.version").value(1));

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/recipes", staff.organizationId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .queryParam("query", "renamed"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].name").value("Renamed Tea"))
            .andExpect(jsonPath("$.items[0].latestVersionNumber").value(1))
            .andExpect(jsonPath("$.items[0].latestStatus").value("DRAFT"));

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}",
                staff.organizationId(), recipeId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.versions[0].versionNumber").value(1));

        String archive = "{\"version\":1}";
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/archive",
                staff.organizationId(), recipeId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content(archive))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.archived").value(true))
            .andExpect(jsonPath("$.version").value(2));
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/archive",
                staff.organizationId(), recipeId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content(archive))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void blocksRetirementAndArchivalWhileAnAvailableOfferingDependsOnTheVersion() throws Exception {
        Staff staff = owner();
        PublishedRecipe published = publishedRecipe(staff);
        UUID offeringId = offering(staff.organizationId(), published.versionId());

        assertThatThrownBy(() -> jdbc.update(
            "UPDATE recipe_version SET status = 'RETIRED' WHERE id = ?", published.versionId()))
            .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update(
            "UPDATE recipe SET archived_at = now() WHERE id = ?", published.recipeId()))
            .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update(
            "UPDATE ingredient SET archived_at = now() WHERE id = ?", published.ingredientId()))
            .isInstanceOf(DataAccessException.class);

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/retire",
                staff.organizationId(), published.recipeId(), published.versionId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":2}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RECIPE_STATE_CONFLICT"));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/archive",
                staff.organizationId(), published.recipeId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":0}"))
            .andExpect(status().isConflict());

        jdbc.update("UPDATE menu_variant_offering SET available = false WHERE id = ?", offeringId);
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/retire",
                staff.organizationId(), published.recipeId(), published.versionId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":2}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("RETIRED"))
            .andExpect(jsonPath("$.version").value(3));
    }

    @Test
    void validatesAuthenticationAuthorizationScopeNamesPaginationAndFormulaInput() throws Exception {
        Staff staff = owner();
        JsonNode created = createRecipe(staff, "Validation Tea");
        UUID recipeId = UUID.fromString(created.get("id").asText());
        UUID versionId = UUID.fromString(created.get("versions").get(0).get("id").asText());
        UUID ingredientId = ingredient(staff.organizationId(), "Validation Ingredient", "GRAM");

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/recipes", staff.organizationId()))
            .andExpect(status().isUnauthorized());

        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/recipes", staff.organizationId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .queryParam("size", "0"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("RECIPE_INVALID"));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes", staff.organizationId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("{\"name\":\"validation tea\",\"description\":null}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RECIPE_CONFLICT"));

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/publish",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":0}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RECIPE_STATE_CONFLICT"));

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("""
                    {"version":0,"components":[
                      {"ingredientId":"%s","quantity":"1.000000"},
                      {"ingredientId":"%s","quantity":"2.000000"}
                    ]}
                    """.formatted(ingredientId, ingredientId)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("RECIPE_INVALID"));

        Staff foreign = owner();
        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}",
                staff.organizationId(), createRecipe(foreign, "Foreign Recipe").get("id").asText())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("RECIPE_NOT_FOUND"));

        Staff unassignedManager = staff("MANAGER");
        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/recipes",
                unassignedManager.organizationId())
                .with(jwt().jwt(token -> token.subject(unassignedManager.authSubject().toString()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("STAFF_ACCESS_DENIED"));

        assignActiveLocation(unassignedManager);
        mvc.perform(get("/api/v1/staff/organizations/{organizationId}/recipes",
                unassignedManager.organizationId())
                .with(jwt().jwt(token -> token.subject(unassignedManager.authSubject().toString()))))
            .andExpect(status().isOk());
    }

    @Test
    void preventsDraftMutationAndPublicationAfterRecipeArchival() throws Exception {
        Staff staff = owner();
        UUID ingredientId = ingredient(staff.organizationId(), "Archived Recipe Ingredient", "GRAM");
        JsonNode created = createRecipe(staff, "Archived Recipe");
        UUID recipeId = UUID.fromString(created.get("id").asText());
        UUID versionId = UUID.fromString(created.get("versions").get(0).get("id").asText());
        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("""
                    {"version":0,"components":[{"ingredientId":"%s","quantity":"1.000000"}]}
                    """.formatted(ingredientId))).andExpect(status().isOk());
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/archive",
                staff.organizationId(), recipeId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":0}"))
            .andExpect(status().isOk());

        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":1,\"components\":[]}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RECIPE_STATE_CONFLICT"));
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/publish",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":1}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RECIPE_STATE_CONFLICT"));
    }

    @Test
    void rejectsPublicationWhenADraftIngredientWasArchivedAfterFormulaEditing() throws Exception {
        Staff staff = owner();
        UUID ingredientId = ingredient(staff.organizationId(), "Soon Archived Ingredient", "GRAM");
        JsonNode created = createRecipe(staff, "Archive-sensitive Recipe");
        UUID recipeId = UUID.fromString(created.get("id").asText());
        UUID versionId = UUID.fromString(created.get("versions").get(0).get("id").asText());
        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("""
                    {"version":0,"components":[{"ingredientId":"%s","quantity":"1.000000"}]}
                    """.formatted(ingredientId))).andExpect(status().isOk());
        jdbc.update("UPDATE ingredient SET archived_at = now() WHERE id = ?", ingredientId);

        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/publish",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":1}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("RECIPE_STATE_CONFLICT"));
    }

    private JsonNode createRecipe(Staff staff, String name) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes",
                staff.organizationId())
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("{\"name\":\"%s\",\"description\":null}".formatted(name)))
            .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    private PublishedRecipe publishedRecipe(Staff staff) throws Exception {
        UUID ingredientId = ingredient(staff.organizationId(), "Tea " + UUID.randomUUID(), "GRAM");
        JsonNode created = createRecipe(staff, "Recipe " + UUID.randomUUID());
        UUID recipeId = UUID.fromString(created.get("id").asText());
        UUID versionId = UUID.fromString(created.get("versions").get(0).get("id").asText());
        mvc.perform(put("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/draft",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json")
                .content("""
                    {"version":0,"components":[{"ingredientId":"%s","quantity":"5.000000"}]}
                    """.formatted(ingredientId))).andExpect(status().isOk());
        mvc.perform(post("/api/v1/staff/organizations/{organizationId}/recipes/{recipeId}/versions/{versionId}/publish",
                staff.organizationId(), recipeId, versionId)
                .with(jwt().jwt(token -> token.subject(staff.authSubject().toString())))
                .contentType("application/json").content("{\"version\":1}"))
            .andExpect(status().isOk());
        return new PublishedRecipe(recipeId, versionId, ingredientId);
    }

    private UUID offering(UUID organizationId, UUID versionId) {
        UUID locationId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID variantId = UUID.randomUUID();
        UUID offeringId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, 'Recipe Shop', 'Asia/Singapore', 'SGD')
            """, locationId, organizationId);
        jdbc.update("INSERT INTO menu_product (id, organization_id, name) VALUES (?, ?, 'Test Drink')",
            productId, organizationId);
        jdbc.update("""
            INSERT INTO menu_variant (id, organization_id, menu_product_id, name)
            VALUES (?, ?, ?, 'Regular')
            """, variantId, organizationId, productId);
        jdbc.update("""
            INSERT INTO menu_variant_offering (
                id, organization_id, location_id, menu_variant_id, recipe_version_id,
                price_minor, currency_code, available
            ) VALUES (?, ?, ?, ?, ?, 500, 'SGD', true)
            """, offeringId, organizationId, locationId, variantId, versionId);
        return offeringId;
    }

    private Staff owner() {
        return staff("OWNER");
    }

    private Staff staff(String role) {
        UUID subject = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        jdbc.update("INSERT INTO account (id, auth_subject, enabled) VALUES (?, ?, true)", accountId, subject);
        jdbc.update("INSERT INTO organization (id, name) VALUES (?, 'Recipe Test Shop')", organizationId);
        jdbc.update("""
            INSERT INTO organization_membership (organization_id, account_id, role, active)
            VALUES (?, ?, ?, true)
            """, organizationId, accountId, role);
        return new Staff(subject, accountId, organizationId);
    }

    private void assignActiveLocation(Staff staff) {
        UUID membershipId = jdbc.queryForObject("""
            SELECT id FROM organization_membership
             WHERE organization_id = ? AND account_id = ?
            """, UUID.class, staff.organizationId(), staff.accountId());
        UUID locationId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO location (id, organization_id, name, timezone, currency_code)
            VALUES (?, ?, 'Assigned Recipe Shop', 'Asia/Singapore', 'SGD')
            """, locationId, staff.organizationId());
        jdbc.update("""
            INSERT INTO location_assignment (organization_id, membership_id, location_id)
            VALUES (?, ?, ?)
            """, staff.organizationId(), membershipId, locationId);
    }

    private UUID ingredient(UUID organizationId, String name, String baseUnit) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO ingredient (id, organization_id, name, base_unit)
            VALUES (?, ?, ?, ?)
            """, id, organizationId, name, baseUnit);
        return id;
    }

    private record Staff(UUID authSubject, UUID accountId, UUID organizationId) { }
    private record PublishedRecipe(UUID recipeId, UUID versionId, UUID ingredientId) { }
}
